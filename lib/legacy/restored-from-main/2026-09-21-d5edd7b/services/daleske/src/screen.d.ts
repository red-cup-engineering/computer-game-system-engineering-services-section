// screen.d.ts — hand-written types for src/screen.mjs.

import type { Readable, Writable } from "node:stream";
import { Framebuffer } from "./framebuffer.mjs";
import type { KeyEvent } from "./input.mjs";
import type { Encoder } from "./capability.mjs";

export interface PixelScreenOpts {
  out?: Writable;
  in?: Readable;
  env?: Record<string, string | undefined>;
  encoder?: Encoder;
  cellW?: number;
  cellH?: number;
  tile?: number;
}

export class PixelScreen {
  out: Writable;
  cap: { encoder: Encoder; why: string; tty: boolean };
  encoder: Encoder;
  cellW: number;
  cellH: number;
  tile: number | undefined;
  shown: Framebuffer | null;
  constructor(opts?: PixelScreenOpts);
  readonly width: number;
  readonly height: number;
  start(): this;
  stop(): this;
  onKey(fn: (k: KeyEvent) => void): this;
  onInterrupt(fn: (k: KeyEvent) => void): this;
  render(draw: (fb: Framebuffer) => void): this;
  paint(fb: Framebuffer): this;
}
