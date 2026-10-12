// wireframe.d.ts — hand-written types for src/wireframe.mjs.

import type { Vec3 } from "./math.mjs";
import type { Four, Renderable } from "./world.mjs";

export const CHARGE_GLYPH: Record<Four, string>;

export interface CameraOpts {
  eye?: Vec3;
  target?: Vec3;
  up?: Vec3;
  fov?: number;
  width?: number;
  height?: number;
  near?: number;
  far?: number;
}

export interface Camera {
  vp: number[];
  width: number;
  height: number;
  near: number;
  far: number;
  eye: Vec3;
}

export function camera(opts?: CameraOpts): Camera;

export interface Frame {
  width: number;
  height: number;
  glyphs: string[];
  charges: (Four | null)[];
  census?: Record<Four, number>;
  phase?: number;
}

export function emptyFrame(width: number, height: number): Frame;

export interface RenderOpts {
  phase?: number;
}

export function render(renderables: Renderable[], cam: Camera, opts?: RenderOpts): Frame;
export function frameToLines(frame: Frame): string[];
