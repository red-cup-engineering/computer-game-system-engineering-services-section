// sixel.d.ts — hand-written types for src/sixel.mjs (the SIXEL graphics format encoder).

export interface EncodeImageOpts {
  maxColors?: number;
}

export function encodeImage(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts?: EncodeImageOpts,
): string;

export function paletteSize(pixels: Uint8ClampedArray | Uint8Array, opts?: EncodeImageOpts): number;
