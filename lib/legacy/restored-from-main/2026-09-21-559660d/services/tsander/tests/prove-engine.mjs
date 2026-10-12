// prove-engine — the tick/realtime loop ties world + wireframe + the horsetail hook together: tick()
// runs every unit's program on the real Horsetail evaluator (see prove-horsetail), admits the rows,
// advances the phase, and projects a frame; fly() sweeps a camera across waypoints; run() is the
// timer-bearing realtime driver. New tests written for this port (no legacy test existed for
// tsander — see the package README's Port notes).

import { cockpit, tick, fly, run, runUnit, makeWorld } from "../src/engine.mjs";
import { worldFromRows, predicate, allRows, FOUR } from "../src/world.mjs";
import { ok, eq, done } from "./_harness.mjs";

const SEED = [
  predicate("sol-iii", "at-position", [0, 0, 0], 1),
  predicate("sol-iii", "hull", "star", 1),
  predicate("vega-prime", "at-position", [2, -3, -6], 1),
  predicate("vega-prime", "controlled-by", "federation", 2),
  predicate("vega-prime", "not-controlled-by", "federation", 3), // contested
  predicate("vega-prime", "hull", "star", 1),
];

// ── makeWorld is worldFromRows re-exported ────────────────────────────────────────────────
{
  const w = makeWorld(SEED);
  eq(allRows(w).length, SEED.length, "makeWorld admits every seed row");
}

// ── cockpit(): default state ──────────────────────────────────────────────────────────────
{
  const world = makeWorld(SEED);
  const c = cockpit({ world });
  eq(c.phase, 0, "a fresh cockpit starts at phase 0");
  eq(c.units, [], "a fresh cockpit with no units given starts with an empty unit list");
  eq(c.log, [], "a fresh cockpit's log is empty (append-only, nothing logged yet)");
  ok(c.world === world, "cockpit carries the world it was given");
}

// ── cockpit(): units get a computer if none supplied ──────────────────────────────────────
{
  const c = cockpit({ world: makeWorld(SEED), units: [{ subject: "scout-1" }] });
  eq(c.units.length, 1, "one unit was admitted");
  ok(c.units[0].computer && typeof c.units[0].computer === "object" && c.units[0].computer.stub !== true,
     "a unit with no computer given gets a fresh Horsetail world, not a stub");
}

// ── runUnit: no source => no rows, four 'bot', ok:true (nothing to run is not an error) ──
{
  const world = makeWorld(SEED);
  const { rows, result } = runUnit(world, { subject: "idle-1" });
  eq(rows, [], "a unit with no program source produces no rows");
  eq(result, { four: "bot", ok: true }, "a sourceless unit reports four:'bot', ok:true — idling is not an error");
}

// ── runUnit: an UNREADABLE program reads 'bot' and charges 'scan' ────────────────────────
{
  const world = makeWorld(SEED);
  // A program that cannot even be read is the honest ⊥ case. The engine must not fall over on it:
  // runUnit is called for every sourced unit on every tick.
  const { rows, result } = runUnit(world, { subject: "autopilot-1", source: "((((" }, { t: 5 });
  eq(result.four, "bot", "an unreadable program reads 'bot' — no signal");
  eq(result.ok, false, "the refusal's ok:false is threaded through to the unit result");
  eq(rows, [predicate("autopilot-1", "computer-says", "scan", 5)], "a 'bot' result appends a 'computer-says scan' predication at the given tick time");
}

// A bare cell that names nothing settles to ⊥, so the unit charges 'scan' — the same reading the
// stub gave, now for a real reason: no information, rather than no evaluator. (The predecessor
// JavaScript lineage read a bare cell as an affirmed predication and charged ACT here; this Scheme
// lineage does not, and the engine's original proof assumed this reading.)
{
  const world = makeWorld(SEED);
  const { rows, result } = runUnit(world, { subject: "autopilot-4", source: "(dock)" }, { t: 5 });
  eq(result.four, "bot", "a bare cell naming nothing reads ⊥ — no signal");
  eq(rows, [predicate("autopilot-4", "computer-says", "scan", 5)], "so the unit charges SCAN");
}

// ── runUnit: a program that really settles drives the engine (unreachable while stubbed) ─
{
  const world = makeWorld(SEED);
  const { rows, result } = runUnit(
    world,
    { subject: "autopilot-2", source: "(assert autopilot-2 is clear) (recall autopilot-2 is)" },
    { t: 7 },
  );
  eq(result.four, "t", "a program settling to t reports four:'t'");
  ok(result.ok === true, "a real settling is ok:true");
  eq(rows, [predicate("autopilot-2", "computer-says", "act", 7)], "a 't' result charges the unit to ACT");
}

// THE killer feature at engine level: a unit whose program contradicts itself charges its own cell
// BOTH ways, so the world holds its intent contested instead of picking a winner for it.
{
  const world = makeWorld(SEED);
  const { rows, result } = runUnit(
    world,
    { subject: "autopilot-3", source: "(assert autopilot-3 is clear) (deny autopilot-3 is clear) (recall autopilot-3 is)" },
    { t: 9 },
  );
  eq(result.four, "top", "a self-contradicting program settles to TOP, held rather than fatal");
  ok(result.ok === true, "a held contradiction is a successful reading, not an error");
  // Asserted as the code ACTUALLY behaves, which is not what runUnit appears to intend.
  //
  // DEAD ARM (found by un-stubbing, 2026-08-27; left for a design decision rather than patched):
  // runUnit passes branchOnCharge a `top:` arm meant to charge the same cell both ways
  // (`computer-says act` + `not-computer-says act`). branchOnCharge never calls `arms.top` — on "top"
  // it calls arms.t and arms.f and returns {held, t, f} — and runUnit then concatenates branch.t and
  // branch.f. So the `top:` arm is unreachable and the real rows are act + hold. This was invisible
  // while the horsetail hook was stubbed, because `four` was then always "bot" and the top path never
  // ran. Both readings are defensible — "dock AND flee" (act+hold) versus "the cell itself held
  // contested" (act + not-act) — so which one is correct is emsenn's call, not a silent fix.
  eq(rows, [
    predicate("autopilot-3", "computer-says", "act", 9),
    predicate("autopilot-3", "computer-says", "hold", 9),
  ], "a TOP result appends BOTH faces — the unit's intent is held contested, neither erased");
}

// ── tick(): admits unit rows append-only, advances phase, projects a frame ───────────────
{
  const world = makeWorld(SEED);
  const c0 = cockpit({ world, units: [{ subject: "autopilot-1", source: "(dock)" }], camera: { width: 30, height: 12 } });
  const c1 = tick(c0, { width: 30, height: 12 });
  eq(c1.phase, 1, "tick advances the phase by one");
  eq(allRows(c1.world).length, allRows(c0.world).length + 1, "tick admits exactly the one row the sourced unit's program produced");
  ok(allRows(c1.world).length > allRows(c0.world).length, "the world strictly grows (append-only)");
  ok(c1.frame && Array.isArray(c1.frame.glyphs), "tick projects a frame");
  eq(c1.log.length, 1, "tick appends exactly one audit log entry");
  eq(c1.log[0].phase, 1, "the log entry names the phase it was produced at");
  // Was {four:"bot", ok:false, error} while the hook was stubbed. It really runs now and still reads
  // ⊥ — but honestly, as an evaluated result, so no error rides along.
  eq(c1.unitResults, [{ subject: "autopilot-1", four: "bot", ok: true }], "tick's unitResults names each unit's settled four value");
}

// ── tick(): ticking twice keeps growing the world, never shrinking or rewriting it ───────
{
  const world = makeWorld(SEED);
  let c = cockpit({ world, units: [{ subject: "autopilot-1", source: "(dock)" }] });
  const before = allRows(c.world).length;
  c = tick(c, { width: 20, height: 10 });
  const afterOne = allRows(c.world).length;
  c = tick(c, { width: 20, height: 10 });
  const afterTwo = allRows(c.world).length;
  ok(afterOne > before, "the first tick grows the world");
  ok(afterTwo > afterOne, "the second tick grows the world further (each tick's row is distinct — different t)");
  eq(c.phase, 2, "two ticks advance the phase to 2");
}

// ── fly(): sweeps the camera across waypoints, one tick + one frame per waypoint ─────────
{
  const world = makeWorld(SEED);
  const c0 = cockpit({ world, camera: { width: 24, height: 10, eye: [0, 0, 10], target: [0, 0, 0] } });
  const path = [
    { eye: [10, 0, 0] },
    { eye: [0, 10, 0] },
    { eye: [-10, 0, 0] },
  ];
  const { cockpit: cEnd, frames } = fly(c0, path, { width: 24, height: 10 });
  eq(frames.length, path.length, "fly produces one frame per waypoint");
  eq(cEnd.phase, path.length, "fly ticks once per waypoint, advancing phase by the path length");
  eq(cEnd.camera.eye, [-10, 0, 0], "the final cockpit's camera reflects the LAST waypoint");
}

// ── run(): the realtime driver stops after `ticks` ticks, and onFrame can early-stop ─────
{
  const world = makeWorld(SEED);
  const c0 = cockpit({ world, camera: { width: 16, height: 8 } });
  let frameCount = 0;
  const final = await run({ cockpit: c0, interval: 0, ticks: 3, onFrame: () => { frameCount++; } });
  eq(frameCount, 3, "run() calls onFrame exactly `ticks` times when onFrame never returns false");
  eq(final.phase, 3, "run() advances the cockpit's phase by `ticks`");
}

{
  const world = makeWorld(SEED);
  const c0 = cockpit({ world, camera: { width: 16, height: 8 } });
  let frameCount = 0;
  const final = await run({
    cockpit: c0, interval: 0, ticks: 100,
    onFrame: () => { frameCount++; return frameCount < 2; }, // stop after the 2nd frame
  });
  eq(frameCount, 2, "run() stops early when onFrame returns false, even though ticks allowed more");
  eq(final.phase, 2, "the returned cockpit reflects exactly the ticks that ran before the early stop");
}

done("prove-engine");
