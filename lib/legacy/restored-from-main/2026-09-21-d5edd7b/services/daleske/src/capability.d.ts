// capability.d.ts — hand-written types for src/capability.mjs.

export type Encoder = "kitty" | "sixel" | "none";
export const ENCODERS: readonly Encoder[];

export interface Detection {
  encoder: Encoder;
  why: string;
}

export interface Probe extends Detection {
  tty: boolean;
}

export function detectFromEnv(env?: Record<string, string | undefined>): Detection;

export function probe(
  stream?: { isTTY?: boolean },
  env?: Record<string, string | undefined>,
): Probe;
