/**
 * The honest world-time and persistence model for scale-to-zero, generic over any FeltOS
 * world: request-driven catch-up (no `setInterval` loop — CPU-throttled hosts don't reliably
 * schedule one between requests) plus flush-on-mutation persistence, both single-flight with
 * trailing-edge coalescing so concurrent requests never race a stale snapshot's write past a
 * newer one's. Extracted from farstone.561.group's src/world-runtime.mts; already generic.
 * @module world-runtime
 */

/** @typedef {{save: (engine: unknown) => Promise<void>}} WorldRuntimeStore */
/** @typedef {{save: (state: {lastTickAt: number}) => Promise<void>}} WorldRuntimeClockStore */
/** tick() may be sync or async (always awaited — required once an async re-entrant tick, e.g. a qwzspace room's stepOnce(), is wired in). */
/** @typedef {{tick: () => (unknown|Promise<unknown>), engine: () => unknown}} WorldRuntimeMud */
/** @typedef {{reason: "tick"|"mutation"|"shutdown", ticksRun: number, durationMs: number, engineBytes: number}} FlushInfo */
/** @typedef {{ticksOwed: number, ticksRun: number, ticksRemaining: number}} CatchUpInfo */

/**
 * @typedef {Object} WorldRuntimeOptions
 * @property {number} tickIntervalMs - real ms per world tick
 * @property {number} maxCatchUpTicksPerRequest - ticks bound per request
 * @property {() => number} [now] @property {number} lastTickAt - epoch ms already caught up to
 * @property {WorldRuntimeStore|null} store @property {WorldRuntimeClockStore|null} clockStore
 * @property {(info: FlushInfo) => void} [onFlush] @property {(info: CatchUpInfo) => void} [onCatchUp]
 */

/**
 * Byte length of what `store.save()` will actually serialize, purely for `onFlush` reporting.
 * @param {unknown} engine
 * @returns {number}
 */
function measureEngineBytes(engine) {
  try {
    return Buffer.byteLength(JSON.stringify(engine), "utf8");
  } catch {
    return 0;
  }
}

/** Request-driven tick catch-up plus flush-on-mutation persistence, single-flight both ways. */
export class WorldRuntime {
  #mud;
  #store;
  #clockStore;
  #now;
  #tickIntervalMs;
  #maxCatchUpTicksPerRequest;
  #lastTickAt;
  #onFlush;
  #onCatchUp;

  // Single-flight + trailing-edge coalescing for #flush() and catch-up: #flushing/#catchingUp
  // hold the run in progress (or null); at most one queued follow-up is ever pending — every
  // caller arriving while busy merges into it and shares its one promise, resolved only once
  // that follow-up itself completes, so a coalesced caller never sees "done" before a run that
  // started after it arrived has actually happened.
  #flushing = null;
  #queuedFlush = null;
  #catchingUp = null;
  #queuedCatchUp = null;

  /**
   * @param {WorldRuntimeMud} mud
   * @param {WorldRuntimeOptions} opts
   */
  constructor(mud, opts) {
    if (!Number.isFinite(opts.tickIntervalMs) || opts.tickIntervalMs <= 0) {
      throw new TypeError("tickIntervalMs must be a positive number");
    }
    if (!Number.isSafeInteger(opts.maxCatchUpTicksPerRequest) || opts.maxCatchUpTicksPerRequest < 1) {
      throw new TypeError("maxCatchUpTicksPerRequest must be a positive integer");
    }
    this.#mud = mud;
    this.#store = opts.store;
    this.#clockStore = opts.clockStore;
    this.#now = opts.now ?? (() => Date.now());
    this.#tickIntervalMs = opts.tickIntervalMs;
    this.#maxCatchUpTicksPerRequest = opts.maxCatchUpTicksPerRequest;
    this.#lastTickAt = opts.lastTickAt;
    this.#onFlush = opts.onFlush ?? (() => {});
    this.#onCatchUp = opts.onCatchUp ?? (() => {});
  }

  /**
   * How many ticks a request finds owed right now, without running any — pure inspection.
   * @returns {number}
   */
  ticksOwed() {
    return Math.max(0, Math.floor((this.#now() - this.#lastTickAt) / this.#tickIntervalMs));
  }

  /**
   * Call once at the top of every incoming request, before any route-specific handling. Runs
   * (and flushes) whatever real-time ticks are owed, capped per request — a no-op, zero-cost
   * past one arithmetic check, when nothing is owed.
   * @returns {Promise<CatchUpInfo>}
   */
  async preRequestCatchUp() {
    if (this.#catchingUp) {
      if (!this.#queuedCatchUp) {
        let resolve, reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        this.#queuedCatchUp = { promise, resolve, reject };
      }
      return this.#queuedCatchUp.promise;
    }
    return this.#startCatchUp();
  }

  async #startCatchUp() {
    const promise = this.#runCatchUp();
    this.#catchingUp = promise;
    try {
      return await promise;
    } finally {
      this.#catchingUp = null;
      const queued = this.#queuedCatchUp;
      if (queued) {
        this.#queuedCatchUp = null;
        this.#startCatchUp().then(queued.resolve, queued.reject);
      }
    }
  }

  async #runCatchUp() {
    const owed = this.ticksOwed();
    const run = Math.min(owed, this.#maxCatchUpTicksPerRequest);
    for (let i = 0; i < run; i++) await this.#mud.tick();
    if (run > 0) {
      this.#lastTickAt += run * this.#tickIntervalMs;
      await this.#flush("tick", run);
    }
    const info = { ticksOwed: owed, ticksRun: run, ticksRemaining: owed - run };
    this.#onCatchUp(info);
    return info;
  }

  /**
   * Call after a route that itself just mutated engine state OUTSIDE of `preRequestCatchUp`
   * (e.g. a connect route joining an actor, or an explicit-tick route). `advancesClockBy` owes
   * the clock one more interval for an explicit tick; omit (0) for a mutation that represents
   * no elapsed world-time on its own.
   * @param {number} [advancesClockBy]
   * @returns {Promise<void>}
   */
  async postRequestFlush(advancesClockBy = 0) {
    if (advancesClockBy > 0) this.#lastTickAt += advancesClockBy;
    await this.#flush("mutation", advancesClockBy > 0 ? 1 : 0);
  }

  /**
   * Persist exactly what's here right now — no catch-up, no tick-bookkeeping change. For a
   * shutdown handler or an interval backstop save.
   * @returns {Promise<void>}
   */
  async flushNow() {
    await this.#flush("shutdown", 0);
  }

  async #flush(reason, ticksRun) {
    if (this.#flushing) {
      if (!this.#queuedFlush) {
        let resolve, reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        this.#queuedFlush = { reason, ticksRun, promise, resolve, reject };
      } else {
        this.#queuedFlush.reason = reason;
        this.#queuedFlush.ticksRun += ticksRun;
      }
      return this.#queuedFlush.promise;
    }
    return this.#startFlush(reason, ticksRun);
  }

  async #startFlush(reason, ticksRun) {
    const promise = this.#runFlush(reason, ticksRun);
    this.#flushing = promise;
    try {
      await promise;
    } finally {
      this.#flushing = null;
      const queued = this.#queuedFlush;
      if (queued) {
        this.#queuedFlush = null;
        this.#startFlush(queued.reason, queued.ticksRun).then(queued.resolve, queued.reject);
      }
    }
  }

  async #runFlush(reason, ticksRun) {
    // Real wall-clock duration, independent of the injectable now() used for catch-up's
    // business logic (which may be a fixed/stepped fake in tests). Clock written FIRST, engine
    // SECOND — see clock-store.mjs for why that ordering is the fail-safe direction if the
    // process dies mid-flush.
    const start = performance.now();
    const engine = this.#mud.engine();
    if (this.#clockStore !== null) await this.#clockStore.save({ lastTickAt: this.#lastTickAt });
    if (this.#store !== null) await this.#store.save(engine);
    const durationMs = performance.now() - start;
    this.#onFlush({ reason, ticksRun, durationMs, engineBytes: measureEngineBytes(engine) });
  }
}

/**
 * @param {WorldRuntimeMud} mud
 * @param {WorldRuntimeOptions} opts
 * @returns {WorldRuntime}
 */
export function createWorldRuntime(mud, opts) {
  return new WorldRuntime(mud, opts);
}
