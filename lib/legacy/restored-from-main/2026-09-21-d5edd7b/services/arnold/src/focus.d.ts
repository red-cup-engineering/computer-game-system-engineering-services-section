// focus.d.ts — hand-written types for src/focus.mjs.

export interface FocusState {
  names: string[];
  index: number;
}

export function nextFocus(state: FocusState): FocusState;
export function prevFocus(state: FocusState): FocusState;
export function currentFocus(state: FocusState): string | undefined;

export interface FocusRing {
  current(): string | undefined;
  next(): string | undefined;
  prev(): string | undefined;
}
export function focusRing(names: string[]): FocusRing;
