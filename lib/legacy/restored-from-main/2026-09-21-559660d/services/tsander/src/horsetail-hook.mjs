// horsetail-hook — the hook to run a UNIT's "computer" program in @561-group/horsetail. A unit (a ship,
// a station, an autopilot) carries a flight-computer program written in Horsetail, the computer's native
// paraconsistent Lisp where `eval` IS `settle` and ⊤ is a bindable HELD value. This module is the seam:
// give it a unit's program source, get back the settled CHARGE — and, crucially, the FOUR reading of
// that charge, so the engine can branch on it the way the design note's §9 does: `(if ⊤ …)` runs BOTH
// arms and holds the result contested.
//
// UN-STUBBED 2026-08-27. This module was previously a documented stub: the legacy source imported
// `@561-group/computer/horsetail` (`world, run, fourName, glyph`), and that module existed in no
// published or on-disk version of `@561-group/computer` — it had been archived with the whole
// `computer/` tree at `31a9e94b0bb` and never repopulated. Rather than fake an evaluation, `runProgram`
// returned a deterministic "no signal" (⊥) every tick.
//
// Horsetail has since been recovered as its own package, `@561-group/horsetail`, exporting exactly the
// four names this seam was written against. The stub's own header promised that "when
// `@561-group/horsetail` exists, only `runProgram`'s body needs to change — this seam (source string
// in, {charge, four, glyph, ok, error?} out) is unchanged." That is what happened: the seam's shape is
// untouched, and `branchOnCharge` below was never stubbed and is unchanged.
//
// The refusal behaviour is deliberately KEPT where a refusal is still genuine: an absent or non-string
// source, and a program that fails to read or settle. Those return the same honest ⊥ reading as before,
// because the engine's `runUnit` calls this every tick and must never throw.

import { world as horsetailWorld, run, fourName, glyph as chargeGlyph } from "@561-group/horsetail";

export const HORSETAIL = "horsetail";

// makeComputer(init) — a fresh Horsetail world with the stdlib loaded, which is what a unit's flight
// computer is: an append-only trace its program settles predications into. Threading the same computer
// through successive ticks is what lets a unit's program accumulate evidence over time.
export function makeComputer(init = {}) {
  return horsetailWorld(init);
}

// runProgram(source, computer) — settle a unit's program source into its computer world and read the
// last form's charge. Returns the seam's unchanged shape: {charge, four, glyph, ok, error?, world}.
//
// Never throws. The engine's tick loop calls this every tick for every unit carrying a `source`, so a
// program that is absent, malformed, or fails to settle must read as ⊥ ("no signal") rather than take
// the engine down. A program settling to ⊤ is NOT an error: it is a held contradiction, reports ok:true
// with four:"top", and `branchOnCharge` below runs both arms and keeps both.
export function runProgram(source, computer = makeComputer()) {
  if (typeof source !== "string" || source.trim() === "") {
    return {
      charge: null, four: "bot", glyph: "⊥", ok: false,
      error: "horsetail-hook: no program source given",
      world: computer,
    };
  }
  try {
    const charge = run(source, computer);
    return { charge, four: fourName(charge), glyph: chargeGlyph(charge), ok: true, world: computer };
  } catch (error) {
    return {
      charge: null, four: "bot", glyph: "⊥", ok: false,
      error: `horsetail-hook: ${error?.message ?? String(error)}`,
      world: computer,
    };
  }
}

// branchOnCharge(four, arms) — the §9 reading of a four-valued result. The KILLER feature only this
// machine allows: a ⊤ result runs BOTH the t-arm AND the f-arm and HOLDS the pair contested (it does
// not pick one). `arms` is { t, f, bot, top }, each an optional thunk; the result names which arm(s)
// fired and their values. This function is PURE and has no dependency on Horsetail — it is fully real
// and fully tested, independent of runProgram above.
//   four "t"   -> run arms.t
//   four "f"   -> run arms.f
//   four "bot" -> run arms.bot (unknown — e.g. scan first)
//   four "top" -> run BOTH arms.t and arms.f, return { held:true, t, f } (contested, both kept)
export function branchOnCharge(four, arms = {}) {
  const call = (fn) => (typeof fn === "function" ? fn() : undefined);
  switch (four) {
    case "t": return { fired: ["t"], value: call(arms.t) };
    case "f": return { fired: ["f"], value: call(arms.f) };
    case "top":
      // ⊤: run both arms, hold the result contested — neither face erased.
      return { fired: ["t", "f"], held: true, t: call(arms.t), f: call(arms.f) };
    case "bot":
    default:
      return { fired: ["bot"], value: call(arms.bot) };
  }
}
