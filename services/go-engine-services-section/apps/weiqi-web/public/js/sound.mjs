// WebAudio-synthesized sound (task item 3, SOUND). Zero-dep, no sample
// files: every sound here is a short envelope-shaped oscillator/noise
// burst built at call time from the Web Audio API alone. Nothing is
// fetched, nothing is bundled -- this module is the entire sound budget
// of the app, in code.
//
// Pitch/timing "wobble" is seeded from the board coordinate a sound is
// attached to (via deterministic-hash.mjs), not Math.random -- the same
// house rule the visual stone variance follows (see stone-variance.mjs),
// so a synthesized click for "the stone just placed at D4" always sounds
// the same D4-click, not a different random one each time. That is a
// deliberate consistency choice, not a strict requirement of WebAudio
// output (audio doesn't get byte-diffed the way SVG does), but it keeps
// "deterministic domain logic" as the house default rather than the
// exception.
//
// Muting is persisted in localStorage; the *default* mute state honors
// prefers-reduced-motion the first time this runs on a device that has
// never set an explicit preference here -- motion-sensitive users are
// disproportionately likely to also want a quieter interface by default,
// and this app has no way to distinguish "reduced motion" from "reduced
// everything" without asking, so it treats the one signal it has as
// covering both until the user says otherwise via the mute toggle.

const STORAGE_KEY = "weiqi-sound-muted";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function hash01(a, b, c) {
  let h = (a * 0x1f1f1f1f) ^ (b * 0x2545f491) ^ (c * 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return (h >>> 0) / 4294967296;
}

export class WeiqiSound {
  #ctx = null;
  #muted;
  #clickSeq = 0;

  constructor() {
    let stored = null;
    try {
      stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    } catch {
      stored = null; // localStorage can throw in locked-down/private-mode contexts
    }
    this.#muted = stored === null ? prefersReducedMotion() : stored === "1";
  }

  get muted() {
    return this.#muted;
  }

  setMuted(muted) {
    this.#muted = !!muted;
    try {
      localStorage.setItem(STORAGE_KEY, this.#muted ? "1" : "0");
    } catch {
      /* best-effort persistence only */
    }
  }

  toggleMuted() {
    this.setMuted(!this.#muted);
    return this.#muted;
  }

  #ensureCtx() {
    if (this.#ctx) {
      if (this.#ctx.state === "suspended") this.#ctx.resume();
      return this.#ctx;
    }
    const Ctor = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!Ctor) return null;
    this.#ctx = new Ctor();
    return this.#ctx;
  }

  #envelope(gainNode, ctx, { attack = 0.003, decay = 0.09, peak = 0.5, startAt = 0 } = {}) {
    const t0 = ctx.currentTime + startAt;
    gainNode.gain.cancelScheduledValues(t0);
    gainNode.gain.setValueAtTime(0, t0);
    gainNode.gain.linearRampToValueAtTime(peak, t0 + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    return t0;
  }

  /** A short percussive "click" -- the sound of a stone touching the
   * board. `col`/`row` (optional) seed a small deterministic pitch wobble
   * so different points on the board don't all click in perfect unison
   * pitch, without introducing any run-to-run randomness. */
  playStoneClick(col = 0, row = 0) {
    if (this.#muted) return;
    const ctx = this.#ensureCtx();
    if (!ctx) return;
    this.#clickSeq++;
    const wobble = hash01(col, row, this.#clickSeq) - 0.5; // [-0.5, 0.5)
    const freq = 1500 + wobble * 220;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    const t0 = this.#envelope(gain, ctx, { attack: 0.002, decay: 0.05, peak: 0.35 });
    osc.start(t0);
    osc.stop(t0 + 0.09);

    // A brief filtered-noise "clack" layered under the tone gives the
    // click real percussive texture instead of a pure sine beep.
    const bufferSize = Math.floor(ctx.sampleRate * 0.03);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (hash01(i, col + 1, row + this.#clickSeq) * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 2200 + wobble * 400;
    filter.Q.value = 1.1;
    const noiseGain = ctx.createGain();
    noise.connect(filter).connect(noiseGain).connect(ctx.destination);
    this.#envelope(noiseGain, ctx, { attack: 0.001, decay: 0.03, peak: 0.22 });
    noise.start(t0);
  }

  /** Capture "clatter" -- a quick scattered run of clicks, one per
   * captured stone (capped so a huge capture doesn't turn into a wall of
   * noise). */
  playCapture(stonesCaptured = 1) {
    if (this.#muted) return;
    const ctx = this.#ensureCtx();
    if (!ctx) return;
    const n = Math.max(1, Math.min(stonesCaptured, 7));
    for (let i = 0; i < n; i++) {
      const delay = i * (0.045 + hash01(i, stonesCaptured, this.#clickSeq) * 0.02);
      this.#clickSeq++;
      const seq = this.#clickSeq;
      const osc = ctx.createOscillator();
      osc.type = "square";
      const wobble = hash01(i, seq, stonesCaptured) - 0.5;
      osc.frequency.value = 900 + wobble * 260 - i * 18;
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      const t0 = this.#envelope(gain, ctx, { attack: 0.001, decay: 0.07, peak: 0.28, startAt: delay });
      osc.start(t0);
      osc.stop(t0 + 0.1);
    }
  }

  /** A soft two-tone alert for atari -- a nudge, not an alarm. */
  playAtari() {
    if (this.#muted) return;
    const ctx = this.#ensureCtx();
    if (!ctx) return;
    const freqs = [660, 780];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      const t0 = this.#envelope(gain, ctx, { attack: 0.005, decay: 0.11, peak: 0.22, startAt: i * 0.09 });
      osc.start(t0);
      osc.stop(t0 + 0.16);
    });
  }

  /** A gentle closing chime -- the ludics "ritual marks the circle"
   * bookend at game end, per the platform plan's own stated principle. */
  playGameEnd() {
    if (this.#muted) return;
    const ctx = this.#ensureCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99]; // C5-E5-G5, a settled major triad
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      osc.connect(gain).connect(ctx.destination);
      const t0 = this.#envelope(gain, ctx, { attack: 0.01, decay: 0.5, peak: 0.18, startAt: i * 0.12 });
      osc.start(t0);
      osc.stop(t0 + 0.7);
    });
  }

  /** A low countdown tick -- scaffolding for byo-yomi timing, not yet
   * wired to any UI (byo-yomi itself doesn't exist yet; see the platform
   * plan's later-phase timing controls). `urgent` raises the pitch/volume
   * for the last few ticks of a period. */
  playTick(urgent = false) {
    if (this.#muted) return;
    const ctx = this.#ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = urgent ? 420 : 220;
    const gain = ctx.createGain();
    osc.connect(gain).connect(ctx.destination);
    const t0 = this.#envelope(gain, ctx, { attack: 0.002, decay: 0.06, peak: urgent ? 0.3 : 0.16 });
    osc.start(t0);
    osc.stop(t0 + 0.08);
  }
}
