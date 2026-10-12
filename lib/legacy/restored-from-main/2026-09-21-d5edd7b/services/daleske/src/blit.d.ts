// blit.d.ts — hand-written types for src/blit.mjs.

import type { Framebuffer } from "./framebuffer.mjs";
import type { Encoder } from "./capability.mjs";

export interface BlitOpts {
  encoder?: Encoder;
  cellW?: number;
  cellH?: number;
  [key: string]: unknown;
}

export interface BlitResult {
  out: string;
  full: boolean;
  tiles: number;
}

export function blit(prev: Framebuffer | null, next: Framebuffer, opts?: BlitOpts): BlitResult;
export function blitFull(fb: Framebuffer, opts?: BlitOpts): string;
