// engine — the tick/realtime LOOP that ties the engine's three concerns together: the single-source
// trace WORLD (world.mjs — see its header for the federation port-scope-cut), the WIREFRAME renderer
// (wireframe.mjs), and the unit-program HOOK into Horsetail (horsetail-hook.mjs — stubbed, see its
// header). A tick is one turn of the design note's §4 core loop, but with NO global clock to wait on
// (the substrate is "aperiodic settling, not stepping"): a tick settles the world the camera sees,
// runs each unit's flight-computer program, applies the appended predications, and projects a frame.
// The world only advances when predications are appended (by units, by the player). The loop just
// re-settles and re-projects.
//
// Pure where it can be: `tick` takes a world + cockpit state and returns a NEW world + frame + the unit
// program results, appending rows rather than mutating. The realtime driver (`run`) is the thin
// imperative shell that calls tick on an interval and hands the frame to a renderer (Arnold, or a test).

import {
  worldFromRows, admitLog, place, positionOf, renderables, allRows, predicate,
} from "./world.mjs";
import { camera, render } from "./wireframe.mjs";
import { runProgram, makeComputer, branchOnCharge } from "./horsetail-hook.mjs";

// makeWorld(rows) — a world from a seed of {e,a,v,t} rows (the shipped seed `.jsonl`, loaded by bin/).
export { worldFromRows as makeWorld };

// cockpit(opts) — the per-session state the loop carries: the world, the player's current camera, the
// tick phase (drives the ⊤ shiver), and the units whose programs run each tick. A unit is
// { subject, source, computer } — its trace subject, its Horsetail program, and its own Horsetail world.
export function cockpit(opts = {}) {
  return {
    world: opts.world,
    camera: opts.camera ?? {},   // eye/target/fov/etc; width/height filled in at render time
    phase: opts.phase ?? 0,
    units: (opts.units ?? []).map((u) => ({ ...u, computer: u.computer ?? makeComputer() })),
    log: [],                     // a record of what each tick did (append-only, for audit)
  };
}

// runUnit(world, unit) — run one unit's flight-computer program and turn its four-valued result into
// appended predications. The §9 reading: a ⊤ result has the unit BOTH act and hold contested — so we
// append BOTH faces (the t-action AND its converse), which folds that unit's cell to ⊤ in the world,
// and the renderer then draws it doubled. Returns { rows, result } — the rows to admit and the raw
// program result (for the tick log/audit).
export function runUnit(world, unit, opts = {}) {
  if (!unit.source) return { rows: [], result: { four: "bot", ok: true } };
  const result = runProgram(unit.source, unit.computer);
  const t = opts.t ?? 0;
  // map the program's four-valued charge to engine predications about the unit's own subject.
  const branch = branchOnCharge(result.four, {
    t: () => [predicate(unit.subject, "computer-says", "act", t)],
    f: () => [predicate(unit.subject, "computer-says", "hold", t)],
    bot: () => [predicate(unit.subject, "computer-says", "scan", t)],
    // ⊤: BOTH faces — the design note's "honestly both-dock-and-flee"; we charge the same cell both ways
    // so the world holds the unit's intent contested (and the wireframe shivers it).
    top: () => [
      predicate(unit.subject, "computer-says", "act", t),
      predicate(unit.subject, "not-computer-says", "act", t),
    ],
  });
  const rows = result.four === "top" ? branch.t.concat(branch.f) : (branch.value ?? []);
  return { rows, result };
}

// tick(cockpit) — one turn: run every unit's program, admit the appended rows into the world (append-
// only; never overwrite), advance the phase, and project a frame the player sees. Returns a NEW cockpit
// (the world advanced, phase incremented) plus the frame and the per-unit results. No clock — the caller
// decides when to tick (a key press, an interval, a peer message).
export function tick(state, opts = {}) {
  const t = opts.t ?? state.phase; // logical time = the tick phase unless the caller supplies one
  let world = state.world;
  const unitResults = [];
  for (const unit of state.units) {
    const { rows, result } = runUnit(world, unit, { t });
    for (const r of rows) world = admitLog(world, r.e, [r]).world; // append-only union
    unitResults.push({ subject: unit.subject, four: result.four, ok: result.ok, error: result.error });
  }
  const phase = state.phase + 1;
  const width = opts.width ?? state.camera.width ?? 80;
  const height = opts.height ?? state.camera.height ?? 24;
  const cam = camera({ ...state.camera, width, height });
  const frame = render(renderables(world), cam, { phase });
  const logEntry = { t, phase, units: unitResults, census: frame.census };
  return {
    ...state,
    world,
    phase,
    log: [...state.log, logEntry], // append-only audit of each tick
    frame,
    cam,
    unitResults,
  };
}

// fly(cockpit, path) — advance the camera along a path of waypoints, one tick per waypoint, returning
// the final cockpit plus every frame flown. The demo's "fly a wireframe over a tiny settled world" — a
// deterministic camera sweep, replay-identical. `path` is a list of { eye, target } camera deltas.
export function fly(state, path, opts = {}) {
  let s = state;
  const frames = [];
  for (const wp of path) {
    s = { ...s, camera: { ...s.camera, ...wp } };
    s = tick(s, opts);
    frames.push(s.frame);
  }
  return { cockpit: s, frames };
}

// ── the realtime driver (the thin imperative shell) ─────────────────────────────────────────────
// run({ cockpit, onFrame, interval, ticks }) — call tick on an interval, handing each frame to onFrame
// (which an Arnold Screen draws). Stops after `ticks` ticks or when onFrame returns false. This is the
// ONLY part of the engine with a timer; everything it calls is pure. Returns the final cockpit.
export function run({ cockpit: state, onFrame, interval = 100, ticks = Infinity, width, height }) {
  return new Promise((resolve) => {
    let s = state;
    let n = 0;
    const step = () => {
      s = tick(s, { width, height });
      const cont = onFrame ? onFrame(s.frame, s) : true;
      n += 1;
      if (cont === false || n >= ticks) { resolve(s); return; }
      setTimeout(step, interval);
    };
    step();
  });
}

export { renderables, place, positionOf, allRows };
