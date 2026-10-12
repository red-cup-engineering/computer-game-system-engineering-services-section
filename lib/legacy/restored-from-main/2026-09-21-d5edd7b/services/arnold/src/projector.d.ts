// projector.d.ts — hand-written types for src/projector.mjs, the seam mapping a @561-group/computer
// settled section to a renderable terminal frame.

import type { Style } from "./ansi.mjs";

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

export interface Witnesses {
  affirmed: unknown[];
  denied: unknown[];
}

export interface FrameRow {
  predicate: string;
  object?: unknown;
  charge: Charge;
  glyph: string;
  text: string;
  witnesses?: Witnesses;
}

export interface Frame {
  subject?: string;
  rows: FrameRow[];
  census: { affirmed: number; denied: number; contradicted: number; pending: number };
}

export interface ProjectOpts {
  subject?: string;
  pending?: SectionCell[];
  witnesses?: Record<string, Witnesses>;
}

export const GLYPH: Record<Charge, string>;
export const DEFAULT_CHARGE_STYLE: Record<Charge, Style>;

export function project(section: Section, opts?: ProjectOpts): Frame;

export interface FoldedCell {
  predicate: string;
  object?: unknown;
  value: { pos: number; neg: number; evidence?: [unknown[], unknown[]] };
}

export interface Folded {
  entity: string;
  fiber: FoldedCell[];
}

export function projectFiber(folded: Folded, opts?: ProjectOpts): Frame;
