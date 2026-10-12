#!/usr/bin/env node
// tsander demo — flies a wireframe over a tiny SETTLED world: the engine's first-playable proof. It
// loads the shipped seed (world/core-systems.jsonl), settles every place, and sweeps a camera around
// the cluster, projecting a wireframe frame each tick. The seed includes a CONTESTED star (vega-prime
// is told both `controlled-by federation` and its converse), so you watch it render DOUBLED and
// SHIVERING while the settled stars stay clean — the bilattice readout, live.
//
// Two modes:
//   (default, TTY)  — Arnold's alt-screen cockpit: the frame drawn into a cell buffer with charge
//                     colors, a status line announcing the four-value census, q/Ctrl-C to quit.
//   --headless / non-TTY — print N frames as plain text (so CI, an audit, or a pipe can see it run).
//
// Run: node scripts/tsander.mjs   (or: pnpm --filter @561-group/tsander demo)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { Screen } from "@red-cup-engineering/arnold/app";
import { EMPTY_STYLE } from "@red-cup-engineering/arnold/ansi";

import { worldFromRows } from "../src/world.mjs";
import { cockpit, tick } from "../src/engine.mjs";
import { CHARGE_GLYPH } from "../src/wireframe.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = join(HERE, "..", "world", "core-systems.jsonl");

// load the seed trace: one {e,a,v,t} row per line.
function loadSeed() {
  const text = readFileSync(SEED, "utf8").trim();
  return text ? text.split("\n").map((l) => JSON.parse(l)) : [];
}

// a charge -> Arnold style (the bilattice readout in color). Settled t is solid green; ⊥ fog is dim
// grey; f wreck is red; ⊤ contested is bold yellow — the one you watch shiver.
const CHARGE_STYLE = {
  t: { fg: "green" },
  bot: { fg: "bright-black", dim: true },
  f: { fg: "red" },
  top: { fg: "yellow", bold: true },
};

// a circular camera path around the cluster — the "fly over a tiny settled world" sweep.
function orbit(step) {
  const a = (step / 24) * Math.PI * 2;
  const r = 16;
  return { eye: [Math.cos(a) * r, 3 + Math.sin(a) * 4, Math.sin(a) * r], target: [0, -1, -2] };
}

// draw a projected frame into an Arnold buffer, coloring each painted cell by its charge.
function drawFrame(buf, frame, status) {
  buf.clear();
  for (let r = 0; r < frame.height && r < buf.height; r++) {
    for (let c = 0; c < frame.width && c < buf.width; c++) {
      const i = r * frame.width + c;
      const ch = frame.glyphs[i];
      if (ch === " ") continue;
      const style = CHARGE_STYLE[frame.charges[i]] ?? EMPTY_STYLE;
      buf.set(r, c, ch, style);
    }
  }
  // status line on the last row: the four-value census (the calm readout; ⊤ is the designed mechanic).
  const cen = frame.census;
  const line = `tsander  t:${cen.t} ⊥:${cen.bot} f:${cen.f} ⊤:${cen.top}  ${status}`;
  buf.drawText(Math.min(buf.height - 1, frame.height), 0, line, { fg: "cyan" });
}

// ── headless: print a few frames as plain text (CI / audit / pipe) ──
function runHeadless(world, frames = 6) {
  let state = cockpit({ world, camera: orbit(0) });
  for (let n = 0; n < frames; n++) {
    state = { ...state, camera: orbit(n) };
    state = tick(state, { width: 64, height: 22 });
    const f = state.frame;
    console.log(`\n── frame ${n} ──  t:${f.census.t} ⊥:${f.census.bot} f:${f.census.f} ⊤:${f.census.top}`);
    for (let r = 0; r < f.height; r++) {
      console.log(f.glyphs.slice(r * f.width, (r + 1) * f.width).join(""));
    }
  }
  console.log("\n(the doubled/shivering '%' is vega-prime — a ⊤ contested star, held by the substrate.)");
}

// ── interactive: Arnold cockpit, camera orbiting, q to quit ──
function runInteractive(world) {
  const screen = new Screen();
  let state = cockpit({ world, camera: orbit(0) });
  let step = 0;
  let running = true;

  const paint = () => {
    state = { ...state, camera: orbit(step) };
    state = tick(state, { width: screen.width, height: screen.height - 1 });
    screen.render((buf) => drawFrame(buf, state.frame, "[q] quit  — orbiting a settled cluster"));
  };

  screen.start();
  paint();
  screen.onKey((k) => { if (k.name === "q") { running = false; screen.stop(); process.exit(0); } });
  screen.onInterrupt(() => { running = false; screen.stop(); process.exit(0); });

  const loop = () => {
    if (!running) return;
    step += 1;
    paint();
    setTimeout(loop, 120);
  };
  setTimeout(loop, 120);
}

function main() {
  const world = worldFromRows(loadSeed());
  const headless = process.argv.includes("--headless") || !process.stdout.isTTY;
  if (headless) runHeadless(world);
  else runInteractive(world);
}

main();
