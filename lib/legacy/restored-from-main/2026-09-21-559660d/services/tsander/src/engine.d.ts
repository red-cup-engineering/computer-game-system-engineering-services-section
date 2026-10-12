// engine.d.ts — hand-written types for src/engine.mjs.

import type { World, Row, Place, Renderable } from "./world.mjs";
import type { Camera, Frame } from "./wireframe.mjs";
import type { Computer, Four } from "./horsetail-hook.mjs";

export function makeWorld(rows: Row[]): World;

export interface Unit {
  subject: string;
  source?: string;
  computer?: Computer;
}

export interface CockpitOpts {
  world?: World;
  camera?: Record<string, unknown>;
  phase?: number;
  units?: Unit[];
}

export interface Cockpit {
  world: World;
  camera: Record<string, unknown>;
  phase: number;
  units: Array<Unit & { computer: Computer }>;
  log: unknown[];
  frame?: Frame;
  cam?: Camera;
  unitResults?: unknown[];
}

export function cockpit(opts?: CockpitOpts): Cockpit;

export interface UnitRunResult {
  rows: Row[];
  result: { four: Four; ok: boolean; error?: string };
}

export function runUnit(world: World, unit: Unit, opts?: { t?: number }): UnitRunResult;

export interface TickOpts {
  t?: number;
  width?: number;
  height?: number;
}

export function tick(state: Cockpit, opts?: TickOpts): Cockpit;

export interface Waypoint {
  eye?: [number, number, number];
  target?: [number, number, number];
}

export function fly(state: Cockpit, path: Waypoint[], opts?: TickOpts): { cockpit: Cockpit; frames: Frame[] };

export interface RunOpts {
  cockpit: Cockpit;
  onFrame?: (frame: Frame, state: Cockpit) => boolean | void;
  interval?: number;
  ticks?: number;
  width?: number;
  height?: number;
}

export function run(opts: RunOpts): Promise<Cockpit>;

export { renderables, place } from "./world.mjs";
export function positionOf(world: World, subject: string, opts?: unknown): [number, number, number] | null;
export function allRows(world: World): Row[];
