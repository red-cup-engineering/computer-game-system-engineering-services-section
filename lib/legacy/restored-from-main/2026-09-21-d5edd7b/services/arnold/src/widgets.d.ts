// widgets.d.ts — hand-written types for src/widgets.mjs.

import type { Buffer } from "./buffer.mjs";
import type { Rect } from "./layout.mjs";
import type { Style } from "./ansi.mjs";
import type { KeyEvent } from "./input.mjs";

export interface BoxOpts {
  style?: Style;
  title?: string;
  titleStyle?: Style;
}
export function box(buf: Buffer, r: Rect, opts?: BoxOpts): Rect;

export interface TextOpts {
  style?: Style;
  wrap?: boolean;
  align?: "left" | "right" | "center";
}
export function text(buf: Buffer, r: Rect, content: string | string[], opts?: TextOpts): number;

export function wrap(s: string, width: number, doWrap?: boolean): string[];

export type ListItem = string | { text: string; style?: Style };
export interface ListOpts {
  selected?: number;
  style?: Style;
  selectedStyle?: Style;
  scroll?: number;
}
export function list(buf: Buffer, r: Rect, items: ListItem[], opts?: ListOpts): { start: number; end: number };

export type TableCell = string | { text: string; style?: Style };
export interface TableOpts {
  columns?: number[];
  header?: TableCell[];
  headerStyle?: Style;
  gap?: number;
  style?: Style;
}
export function table(buf: Buffer, r: Rect, rows: TableCell[][], opts?: TableOpts): number[];

export interface InputState {
  value: string;
  cursor?: number;
}
export interface InputOpts {
  style?: Style;
  prompt?: string;
  promptStyle?: Style;
}
export function input(buf: Buffer, r: Rect, state: InputState, opts?: InputOpts): void;
export function editInput(state: InputState, key: KeyEvent): InputState;

export interface StatusSlots {
  left?: string;
  center?: string;
  right?: string;
}
export interface StatusOpts {
  style?: Style;
}
export function statusLine(buf: Buffer, r: Rect, slots?: StatusSlots, opts?: StatusOpts): void;

export interface SelectInListOpts {
  pageSize?: number;
  wrap?: boolean;
}
export function selectInList(selected: number, key: KeyEvent, count: number, opts?: SelectInListOpts): number;

export interface TextViewportOpts {
  offset?: number;
  style?: Style;
}
export function textViewport(buf: Buffer, r: Rect, lines: string[], opts?: TextViewportOpts): { offset: number; maxOffset: number };

export interface ScrollViewportOpts {
  pageSize?: number;
}
export function scrollViewport(offset: number, key: KeyEvent, lineCount: number, viewportHeight: number, opts?: ScrollViewportOpts): number;
