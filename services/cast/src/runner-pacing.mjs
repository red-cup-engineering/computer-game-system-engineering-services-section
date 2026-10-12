/**
 * `runner-pacing` — pure, seeded computation of human-ish think/act delays, kept separate from
 * `./runner.mjs`'s control flow so it's testable without timers: every function here returns a
 * millisecond number given a persona and an `Rng` stream, and never itself calls `setTimeout`
 * or reads a clock. `./runner.mjs` is what actually sleeps for the returned duration (and
 * accepts an injectable `sleep` for tests that want to skip real wall-clock time entirely).
 *
 * Patience is the one temperament dimension that drives pacing: a low-patience persona thinks
 * and acts quickly but erratically (wide jitter — sometimes snap decisions, sometimes a
 * flustered pause); a high-patience persona is slower but steadier.
 */
const clamp01 = (n) => Math.max(0, Math.min(1, n));

const THINK_BASE_MS = 900;
const ACT_BASE_MS = 500;
const CHAT_BASE_MS = 300;

function jitteredDelay(baseMs, patience, rng) {
  const scale = 0.5 + patience; // 0.5x .. 1.5x of baseMs as patience rises
  const spread = baseMs * (1.3 - patience); // more erratic (wider jitter) at low patience
  const jitter = (rng.next() - 0.5) * spread;
  return Math.max(50, Math.round(baseMs * scale + jitter));
}

/** Delay before a persona commits to a decision, once it has observed the current game state. */
export function thinkDelayMs(persona, rng) {
  const patience = clamp01(persona.temperament?.patience ?? 0.5);
  return jitteredDelay(THINK_BASE_MS, patience, rng);
}

/** Delay between deciding and actually sending the intent — the "reaching for the chips"
 *  beat, shorter than the think delay but following the same patience curve. */
export function actDelayMs(persona, rng) {
  const patience = clamp01(persona.temperament?.patience ?? 0.5);
  return jitteredDelay(ACT_BASE_MS, patience, rng);
}

/** Delay before an ambient chat-idle line, if one fires — deliberately short and only mildly
 *  patience-modulated, since idle chatter is meant to feel spontaneous rather than deliberated. */
export function chatDelayMs(persona, rng) {
  const patience = clamp01(persona.temperament?.patience ?? 0.5);
  return jitteredDelay(CHAT_BASE_MS, 0.3 + patience * 0.4, rng);
}
