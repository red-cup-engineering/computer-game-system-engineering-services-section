import process from "node:process";
import { createEngine } from "@red-cup-engineering/feltos/engine";
import { closeMudHttpServer, listenMudHttpServer } from "@red-cup-engineering/feltos/http";
import { openWorldStore, resolveWorldBackend } from "../src/world-store.mjs";
import { openClockStore } from "../src/clock-store.mjs";
import { createWorldRuntime } from "../src/world-runtime.mjs";
import { createWorldHttpServer } from "../src/http-wiring.mjs";

/**
 * Generic world-host boot sequence: persistence backend selection, request-driven catch-up,
 * the outer HTTP server, and (if given) a telnet transport, with graceful shutdown. Extracted
 * from farstone.561.group's src/serve.mts (world-host-runtime note, 2026-09-01) — a tenant
 * site composes this with its own game module, room factory, and page/telnet wiring; see
 * farstone's own src/serve.mts for the reference parameterization.
 * @module serve-world-host
 */

/** A site with no MudServer-based JSON API (a bare qwzspace room only) omits `liveMud` and returns `liveEngine` instead — see http-wiring.mjs's own header for the `mud: null` contract this feeds. */
/** @typedef {(bootEngine: unknown, opts: {intervalMs: number}) => {room: import("../src/http-wiring.mjs").WorldRoomLike, liveMud?: () => {tick(): unknown, connect(name: unknown): unknown, enqueue(actor: unknown, command: unknown): void, drain(actor: unknown): unknown, metrics(): unknown, engine(): unknown}, liveEngine?: () => unknown}} CreateWorldRoom */
/** @typedef {(mud: unknown, runtime: import("../src/world-runtime.mjs").WorldRuntime, opts: {host: string, port: number, catchUpIntervalMs: number}) => Promise<{origin: string, close: () => Promise<void>}>} ListenWorldTelnet */
/**
 * @typedef {Object} WorldHostServeOptions
 * @property {unknown} gameModule @property {CreateWorldRoom} createRoom
 * @property {string} [pageHtml] @property {Record<string,string>} [staticFiles] @property {ListenWorldTelnet} [listenTelnet] @property {(telnet: unknown) => void} [pushTelnetUpdates]
 * @property {string} [clockKind] - pass a site's historic value to stay byte-compatible with an already-persisted clock file
 * @property {string} [processLabel] @property {number} [defaultPort] @property {string} [defaultHost] @property {number} [defaultTickIntervalMs] @property {number} [defaultMaxCatchUpTicksPerRequest] @property {number} [defaultSaveIntervalMs] @property {number} [defaultTelnetPort]
 * @property {NodeJS.ProcessEnv} [env] @property {() => Record<string, unknown>} [health]
 */

/**
 * Boot one world-host server. Mirrors farstone.561.group's src/serve.mts exactly, generic over
 * the per-site parameters that file used to hardcode.
 * @param {WorldHostServeOptions} opts
 * @returns {Promise<{origin: string, close: () => Promise<void>}>}
 */
export async function serveWorldHost(opts) {
  const env = opts.env ?? process.env;
  const processLabel = opts.processLabel ?? "World host";
  const port = Number(env["PORT"] ?? env["FELTOS_PORT"] ?? opts.defaultPort ?? 8080);
  const host = env["HOST"] ?? opts.defaultHost ?? "127.0.0.1";
  const backend = resolveWorldBackend(env);
  const store = openWorldStore(backend);
  const clockStore = openClockStore(backend, { clockKind: opts.clockKind });
  const bootEngine = store === null
    ? createEngine(opts.gameModule)
    : await store.load(() => createEngine(opts.gameModule));

  const tickIntervalMs = Number(env["FELTOS_TICK_MS"] ?? opts.defaultTickIntervalMs ?? 1000);
  const maxCatchUpTicksPerRequest = Number(env["FELTOS_MAX_CATCHUP_TICKS"] ?? opts.defaultMaxCatchUpTicksPerRequest ?? 30);

  const { room, liveMud, liveEngine } = opts.createRoom(bootEngine, { intervalMs: tickIntervalMs });
  const mud = liveMud ? liveMud() : null;

  const restoredClock = clockStore === null ? null : await clockStore.load();
  /** @type {{origin: string, close: () => Promise<void>}|null} */
  let telnet = null;
  const runtime = createWorldRuntime(
    { tick: () => (room.stepOnce ? room.stepOnce() : mud.tick()), engine: () => (mud ? mud.engine() : liveEngine()) },
    {
      tickIntervalMs,
      maxCatchUpTicksPerRequest,
      lastTickAt: restoredClock?.lastTickAt ?? Date.now(),
      store,
      clockStore,
      onFlush: (info) => {
        if (info.durationMs > 1000) {
          process.stderr.write(`${processLabel} flush took ${info.durationMs.toFixed(0)}ms (reason=${info.reason}, ticksRun=${info.ticksRun}) — slower than the "no request stalls seconds" target\n`);
        }
      },
      onCatchUp: (info) => {
        if (info.ticksRun > 0 && telnet !== null && opts.pushTelnetUpdates) opts.pushTelnetUpdates(telnet);
      },
    },
  );

  await runtime.preRequestCatchUp();

  const httpServer = createWorldHttpServer(mud, runtime, {
    tickIntervalMs,
    room,
    pageHtml: opts.pageHtml,
    staticFiles: opts.staticFiles,
    processLabel,
    health: opts.health,
  });
  const { origin } = await listenMudHttpServer(httpServer, { host, port });

  if (opts.listenTelnet) {
    telnet = await opts.listenTelnet(mud, runtime, {
      host,
      port: Number(env["FELTOS_TELNET_PORT"] ?? opts.defaultTelnetPort ?? 4242),
      catchUpIntervalMs: tickIntervalMs,
    });
    process.stdout.write(`${processLabel} telnet is live at ${telnet.origin}\n`);
  }

  const saveTimer = store === null ? null : setInterval(() => {
    void runtime.flushNow().catch((error) => process.stderr.write(`${processLabel} backstop save failed: ${String(error)}\n`));
  }, Number(env["FELTOS_SAVE_MS"] ?? opts.defaultSaveIntervalMs ?? 30_000));

  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    if (saveTimer !== null) clearInterval(saveTimer);
    if (telnet !== null) await telnet.close();
    if (typeof room.destroy === "function") room.destroy();
    if (store !== null) await runtime.flushNow();
    await closeMudHttpServer(httpServer);
  }
  for (const signal of /** @type {const} */ (["SIGINT", "SIGTERM"])) process.once(signal, () => {
    void close().catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
      process.exitCode = 1;
    });
  });

  process.stdout.write(`${processLabel} is live at ${origin}${store === null ? "" : `, durable to ${store.describe} (clock: ${clockStore?.describe})`}\n`);

  return { origin, close };
}
