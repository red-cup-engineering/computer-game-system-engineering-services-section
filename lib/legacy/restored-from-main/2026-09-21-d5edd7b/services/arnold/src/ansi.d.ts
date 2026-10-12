// ansi.d.ts — hand-written types for src/ansi.mjs.

export type ColorSpec = string | number | { r: number; g: number; b: number } | "default" | null;

export interface Style {
  fg?: ColorSpec;
  bg?: ColorSpec;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  inverse?: boolean;
  strike?: boolean;
}

export const ESC: string;
export const CSI: string;

export function cursorTo(row: number, col: number): string;
export const cursorHome: string;
export const hideCursor: string;
export const showCursor: string;
export const clearScreen: string;
export const clearLine: string;
export const enterAltScreen: string;
export const leaveAltScreen: string;
export const resetStyle: string;

export function sgr(style?: Style): string;
export function sameStyle(a?: Style | null, b?: Style | null): boolean;
export const EMPTY_STYLE: Style;
export function stripAnsi(s: string): string;
export function displayWidth(s: string): number;
