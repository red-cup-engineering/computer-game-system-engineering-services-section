// prove-horsetail — src/horsetail-hook.mjs. This proof was previously written against a documented
// STUB: `@561-group/horsetail` did not exist, so `runProgram` always returned ⊥ and these assertions
// held it to that refusal. Horsetail has since been recovered, the hook is un-stubbed, and this proof
// now holds `runProgram` to REAL settling behaviour. The refusal assertions are kept only where a
// refusal is still genuine (no source, malformed program), because the engine's tick loop calls this
// every tick and must never throw. branchOnCharge was never stubbed; its section below is unchanged.

import { makeComputer, runProgram, branchOnCharge, HORSETAIL } from "../src/horsetail-hook.mjs";
import { ok, eq, done } from "./_harness.mjs";

// ── the seam is live: a unit's computer is a real Horsetail world ─────────────────────────
eq(HORSETAIL, "horsetail", "the HORSETAIL constant names the seam");

{
  const computer = makeComputer();
  ok(computer.stub !== true, "makeComputer no longer returns a stub marker");
  // Asserted behaviourally, not by shape: the two Horsetail lineages carry the trace differently
  // (one a `trace` array, one an MPU store), and the engine depends on neither.
  ok(typeof computer === "object" && computer !== null, "makeComputer returns a real Horsetail world");
}

// ── a program actually settles, and its FOUR reading is the engine's branch signal ────────
{
  const r = runProgram("(assert ship is docked) (recall ship is)");
  ok(r.ok === true, "a well-formed program reports ok:true — it really ran");
  eq(r.four, "t", "an asserted fact settles to t");
  eq(r.glyph, "t", "the glyph matches the four reading");
  ok(r.charge !== null, "a settled charge is returned, not null");
}

{
  const r = runProgram("(recall ship never-said)");
  eq(r.four, "bot", "an unasserted subject reads BOT (unknown), and that is a success, not a failure");
  ok(r.ok === true, "reading ⊥ is an honest answer: ok:true");
}

// THE point of running programs on this machine: a contradiction is HELD, not fatal, not resolved.
{
  const r = runProgram("(assert ship is docked) (deny ship is docked) (recall ship is)");
  eq(r.four, "top", "asserting and denying the same fact settles to TOP — held, not exploded");
  eq(r.glyph, "\u22a4", "the TOP glyph is rendered");
  ok(r.ok === true, "a contradiction is a successful reading, NOT an error");
}

// A unit threading one computer across ticks accumulates evidence — that is what a flight computer is.
{
  const computer = makeComputer();
  const first = runProgram("(assert ship is docked)", computer);
  eq(first.four, "t", "tick 1: the unit asserts, and reads t");
  const second = runProgram("(deny ship is docked) (recall ship is)", computer);
  eq(second.four, "top", "tick 2: contrary evidence in the SAME computer rises to TOP — the trace persisted");
}

// ── refusals that are still genuine: the tick loop must never throw ───────────────────────
{
  const r = runProgram(); // no source at all
  eq(r.four, "bot", "runProgram with no source reads BOT, not a crash");
  ok(r.ok === false, "no source is honestly reported as ok:false");
  ok(r.error.includes("no program source"), "runProgram with no source names that specifically");
}

{
  const r = runProgram("(((("); // unreadable
  eq(r.four, "bot", "an unreadable program reads BOT rather than taking the engine down");
  ok(r.ok === false, "an unreadable program is honestly ok:false");
  ok(typeof r.error === "string" && r.error.length > 0, "it explains WHY in .error (not silent)");
}

{
  // runProgram never throws, regardless of input shape — the engine's tick loop depends on this.
  let threw = false;
  try { runProgram({ not: "a string" }); } catch { threw = true; }
  ok(!threw, "runProgram does not throw on a malformed source — the engine's per-tick call is safe");
}

// ── branchOnCharge: real, pure, unchanged by the un-stubbing ──────────────────────────────
{
  const r = branchOnCharge("t", { t: () => "acted", f: () => "held" });
  eq(r, { fired: ["t"], value: "acted" }, "four 't' runs ONLY the t arm");
}

{
  const r = branchOnCharge("f", { t: () => "acted", f: () => "held" });
  eq(r, { fired: ["f"], value: "held" }, "four 'f' runs ONLY the f arm");
}

{
  const r = branchOnCharge("bot", { bot: () => "scanning" });
  eq(r, { fired: ["bot"], value: "scanning" }, "four 'bot' runs the bot arm (unknown => e.g. scan first)");
}

{
  const r = branchOnCharge("bot", {}); // no bot arm given
  eq(r, { fired: ["bot"], value: undefined }, "four 'bot' with no bot arm returns undefined, not a throw");
}

// THE killer feature: ⊤ runs BOTH arms and holds them contested — it does not pick a winner.
{
  const calls = [];
  const r = branchOnCharge("top", {
    t: () => { calls.push("t"); return "docked"; },
    f: () => { calls.push("f"); return "fled"; },
  });
  eq(calls, ["t", "f"], "four 'top' calls BOTH the t arm and the f arm (both actually ran)");
  eq(r.held, true, "the result is marked held:true (contested, not resolved)");
  eq(r.t, "docked", "the result keeps the t arm's value");
  eq(r.f, "fled", "the result keeps the f arm's value — NEITHER face is erased");
  eq(r.fired, ["t", "f"], "fired names both arms");
}

{
  // an unrecognized four value falls through to the bot arm (a safe default, never a throw).
  const r = branchOnCharge("nonsense", { bot: () => "default" });
  eq(r, { fired: ["bot"], value: "default" }, "an unrecognized four value falls back to the bot arm, not a crash");
}

done("prove-horsetail");
