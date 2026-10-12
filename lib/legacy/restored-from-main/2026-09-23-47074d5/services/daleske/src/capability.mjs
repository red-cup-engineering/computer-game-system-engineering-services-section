// capability — detect which raster encoder the running terminal can consume, so the blit can pick
// kitty (preferred — true RGBA, addressable, cheap) and FALL BACK GRACEFULLY to sixel, and to
// nothing (text-only) when neither is present. Detection has two faces:
//
//   detectFromEnv(env)  — a PURE classification from environment variables alone (no I/O, testable).
//                         It reads the signals a terminal advertises about itself ($TERM,
//                         $TERM_PROGRAM, $KITTY_WINDOW_ID, $COLORTERM) and names the best encoder.
//   probe(stream, env)  — the live form: env first, and if inconclusive it could query the terminal
//                         (a kitty/sixel capability handshake) — here it just trusts env + a tty
//                         check, staying dependency- and side-effect-light.
//
// The result is one of: "kitty" | "sixel" | "none". "none" means a renderer must fall back to a
// TEXT representation (daleske's projector still yields a frame; a text drawer can show it).

export const ENCODERS = Object.freeze(["kitty", "sixel", "none"]);

// terminals/programs known to speak the kitty graphics protocol.
const KITTY_PROGRAMS = ["kitty", "ghostty", "wezterm", "konsole"];
// terminals/programs known to speak sixel.
const SIXEL_PROGRAMS = ["mlterm", "xterm", "foot", "wezterm", "contour", "mintty", "yaft"];

const has = (s, sub) => typeof s === "string" && s.toLowerCase().includes(sub);

// detectFromEnv(env) -> { encoder, why } — PURE. `env` is a plain object (default process.env).
// `why` names the signal that decided it, so a status line / test can explain the choice.
export function detectFromEnv(env = process.env) {
  const term = env.TERM || "";
  const prog = env.TERM_PROGRAM || "";

  // an explicit override always wins (DALESKE_ENCODER=kitty|sixel|none) — lets a user force a path.
  const forced = env.DALESKE_ENCODER;
  if (forced && ENCODERS.includes(forced)) return { encoder: forced, why: `forced via DALESKE_ENCODER=${forced}` };

  // kitty advertises itself with $KITTY_WINDOW_ID and/or TERM=xterm-kitty.
  if (env.KITTY_WINDOW_ID || has(term, "kitty")) return { encoder: "kitty", why: "kitty signature ($KITTY_WINDOW_ID/$TERM)" };
  if (KITTY_PROGRAMS.some((p) => has(prog, p))) return { encoder: "kitty", why: `TERM_PROGRAM=${prog}` };

  // sixel: TERM often carries no marker, so we trust TERM_PROGRAM and the few TERMs that imply it.
  if (SIXEL_PROGRAMS.some((p) => has(prog, p) || has(term, p))) return { encoder: "sixel", why: "sixel-capable program/TERM" };

  return { encoder: "none", why: "no raster signature in env — text fallback" };
}

// probe(stream, env) -> { encoder, why, tty } — the live form used by the screen. If the stream is
// not a TTY there is no terminal to draw to, so the encoder is "none" regardless of env (e.g. a
// piped or redirected stdout). Otherwise it defers to detectFromEnv. Kept side-effect-free so it is
// safe to call before any terminal setup.
export function probe(stream = process.stdout, env = process.env) {
  const tty = !!(stream && stream.isTTY);
  if (!tty) return { encoder: "none", why: "stdout is not a TTY (piped/redirected)", tty };
  const d = detectFromEnv(env);
  return { ...d, tty };
}
