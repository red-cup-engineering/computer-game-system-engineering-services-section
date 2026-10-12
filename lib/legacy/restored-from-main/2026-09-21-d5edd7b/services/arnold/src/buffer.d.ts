// buffer.d.ts — hand-written types for src/buffer.mjs.

import type { Style } from "./ansi.mjs";

export interface Cell {
  ch: string;
  style: Style;
}

export const SPACE: Cell;

export class Buffer {
  readonly width: number;
  readonly height: number;
  cells: Cell[];
  constructor(width: number, height: number);
  clear(style?: Style): this;
  inBounds(row: number, col: number): boolean;
  set(row: number, col: number, ch: string, style?: Style): this;
  get(row: number, col: number): Cell;
  drawText(row: number, col: number, text: string, style?: Style): number;
  fillRect(row: number, col: number, w: number, h: number, ch?: string, style?: Style): this;
  blit(src: Buffer, row: number, col: number): this;
}

export function cellsEqual(a: Cell | null | undefined, b: Cell | null | undefined): boolean;

export interface Change {
  row: number;
  col: number;
  cell: Cell;
}

export interface Diff {
  full: boolean;
  changes: Change[];
}

export function diff(prev: Buffer | null, next: Buffer): Diff;
export function displayWidth(s: string): number;
