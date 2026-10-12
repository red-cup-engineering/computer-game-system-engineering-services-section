// render.d.ts — hand-written types for src/render.mjs.

import type { Buffer, Change } from "./buffer.mjs";

export function renderChanges(changes: Change[]): string;

export interface RenderResult {
  out: string;
  full: boolean;
}

export function render(prev: Buffer | null, next: Buffer): RenderResult;
