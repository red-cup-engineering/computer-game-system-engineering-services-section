// layout.d.ts — hand-written types for src/layout.mjs.

export interface Rect {
  row: number;
  col: number;
  width: number;
  height: number;
}

export function rect(row: number, col: number, width: number, height: number): Rect;
export function inset(r: Rect, top?: number, right?: number, bottom?: number, left?: number): Rect;

export interface FlexChild {
  size?: number;
  grow?: number;
}

export interface FlexOpts {
  direction?: "row" | "column";
  gap?: number;
}

export function flex(container: Rect, children: FlexChild[], opts?: FlexOpts): Rect[];
export function stack(container: Rect, heights: Array<number | null | undefined>): Rect[];
export function center(container: Rect, width: number, height: number): Rect;
