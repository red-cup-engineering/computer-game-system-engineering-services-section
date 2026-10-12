// kitty.d.ts — hand-written types for src/kitty.mjs (the KITTY graphics protocol encoder).

export interface EncodeImageOpts {
  id?: number;
  action?: "T" | "t" | "p";
  quiet?: boolean;
}

export function encodeImage(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts?: EncodeImageOpts,
): string;

export function deleteImage(id: number): string;
export function deleteAll(): string;
export function chunkCount(pixels: Uint8ClampedArray | Uint8Array): number;
