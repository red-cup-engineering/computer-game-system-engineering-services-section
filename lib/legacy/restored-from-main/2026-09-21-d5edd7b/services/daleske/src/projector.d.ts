// projector.d.ts — hand-written types for src/projector.mjs, the seam mapping a
// @561-group/computer settled section to a renderable PIXEL frame.

import type { Framebuffer } from "./framebuffer.mjs";

export type Charge = "affirmed" | "denied" | "contradicted" | "pending";

export interface SectionCell {
  predicate: string;
  object?: unknown;
}

export interface Section {
  affirmed?: SectionCell[];
  denied?: SectionCell[];
  contradicted?: SectionCell[];
  pending?: SectionCell[];
  subject?: string;
}

export const CHARGE_COLOR: Record<Charge, [number, number, number]>;
export const GLYPH: Record<Charge, string>;

export interface FrameRow {
  charge: Charge;
  glyph: string;
  predicate: string;
  object?: unknown;
  y: number;
  h: number;
  contested: boolean;
}

export interface PixelFrame {
  fb: Framebuffer;
  rows: FrameRow[];
  width: number;
  height: number;
  census: { affirmed: number; denied: number; contradicted: number; pending: number };
}

export interface ProjectOpts {
  width?: number;
  bandH?: number;
  tile?: number;
  pending?: SectionCell[];
  subject?: string;
}

export function project(section: Section, opts?: ProjectOpts): PixelFrame;

export interface FoldedCell {
  predicate: string;
  object?: unknown;
  value: { pos: number; neg: number; evidence?: [unknown[], unknown[]] };
}

export interface Folded {
  entity: string;
  fiber: FoldedCell[];
}

export function projectFiber(folded: Folded, opts?: ProjectOpts): PixelFrame;
