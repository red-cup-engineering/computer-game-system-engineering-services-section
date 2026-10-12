// index.d.ts — barrel re-exporting tsander's surface. See package.json "exports" for the subpath
// modules this mirrors.

export * as world from "./world.mjs";
export * as wireframe from "./wireframe.mjs";
export * as horsetail from "./horsetail-hook.mjs";
export * as engine from "./engine.mjs";
export { v3, m4 } from "./math.mjs";

export { worldFromRows, place, renderables, positionOf, predicate, deny, FOUR } from "./world.mjs";
export { camera, render, frameToLines, emptyFrame, CHARGE_GLYPH } from "./wireframe.mjs";
export { makeComputer, runProgram, branchOnCharge } from "./horsetail-hook.mjs";
export { cockpit, tick, fly, run, makeWorld } from "./engine.mjs";
