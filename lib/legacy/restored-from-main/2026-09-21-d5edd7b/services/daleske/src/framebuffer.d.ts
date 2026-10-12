// framebuffer.d.ts — hand-written types for src/framebuffer.mjs.

export const DEFAULT_TILE: number;

export class Framebuffer {
  readonly width: number;
  readonly height: number;
  readonly tile: number;
  readonly cols: number;
  readonly rows: number;
  data: Uint8ClampedArray;
  constructor(width: number, height: number, tile?: number);
  inBounds(x: number, y: number): boolean;
  setPixel(x: number, y: number, r: number, g: number, b: number, a?: number): this;
  getPixel(x: number, y: number): [number, number, number, number];
  clear(r?: number, g?: number, b?: number, a?: number): this;
  fillRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a?: number): this;
  blit(src: Framebuffer, x: number, y: number): this;
  tileRect(col: number, row: number): { x: number; y: number; w: number; h: number };
  tilePixels(col: number, row: number): Uint8ClampedArray;
}

export function tilesEqual(a: Framebuffer, b: Framebuffer, col: number, row: number): boolean;

export interface TileAddr {
  col: number;
  row: number;
}

export interface FramebufferDiff {
  full: boolean;
  tiles: TileAddr[];
}

export function diff(prev: Framebuffer | null, next: Framebuffer): FramebufferDiff;
