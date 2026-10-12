// world.d.ts — hand-written types for src/world.mjs. See that file's header for the federation
// port-scope-cut (single-source trace, not the legacy federated substrate).

export interface Row {
  e: string;
  a: string;
  v: unknown;
  t: number;
}

export interface World {
  rows: Row[];
}

export interface FoldedCell {
  predicate: string;
  object: unknown;
  value: { pos: number; neg: number; evidence?: [unknown[], unknown[]] };
}

export interface Folded {
  entity: string;
  fiber: FoldedCell[];
}

export interface Section {
  affirmed: Array<{ predicate: string; object: unknown }>;
  denied: Array<{ predicate: string; object: unknown }>;
  contradicted: Array<{ predicate: string; object: unknown }>;
}

export function fold(subject: string, rows: Row[], opts?: Record<string, unknown>): Folded;
export function section(folded: Folded): Section;
export function settle(subject: string, rows: Row[], opts?: Record<string, unknown>): Folded;
export function relate(rows: Row[], predicate: string, object: unknown): string[];
export function relateFrom(rows: Row[], subject: string, predicate: string): unknown[];
export function rowId(row: Row): string;
export function assertRow(row: unknown): void;

export const CONVERSE: Record<string, string>;

export function predicate(s: string, p: string, o: unknown, t?: number): Row;
export function deny(s: string, p: string, o: unknown, t?: number): Row;

export function emptyWorld(): World;
export function admitRows(world: World, rows: Row[]): World;
export function admitLog(world: World, subject: string, rows: Row[]): { world: World };
export function worldFromRows(rows: Row[]): World;
export function allRows(world: World): Row[];
export function subjects(world: World): string[];

export interface SettleOpts {
  converse?: Record<string, string>;
  functional?: Set<string> | ((a: string) => boolean);
  retract?: boolean;
}
export function settleOpts(opts?: SettleOpts): Required<Pick<SettleOpts, "converse" | "functional">> & { retract?: boolean };

export type Four = "t" | "f" | "bot" | "top";
export const FOUR: { T: "t"; F: "f"; BOT: "bot"; TOP: "top" };

export function chargeOf(value: { pos?: number; neg?: number }): Four;

export interface Contested {
  predicate: string;
  object: unknown;
  evidence?: [unknown[], unknown[]];
}

export interface Place {
  subject: string;
  folded: Folded;
  section: Section;
  contested: Contested[];
  visited: boolean;
  charge: Four;
}

export function place(world: World, subject: string, opts?: SettleOpts): Place;
export function positionOf(world: World, subject: string, opts?: SettleOpts): [number, number, number] | null;

export interface Renderable {
  subject: string;
  position: [number, number, number];
  charge: Four;
  contested: Contested[];
  shape: unknown;
}

export function renderables(world: World, opts?: SettleOpts): Renderable[];

export interface Disagreement extends Contested {
  subject: string;
}
export function disagreements(world: World, opts?: SettleOpts): Disagreement[];
