// app.d.ts — hand-written types for src/app.mjs.

import type { Readable, Writable } from "node:stream";
import type { Buffer as BufferT } from "./buffer.mjs";
import type { Rect } from "./layout.mjs";
import type { KeyEvent } from "./input.mjs";

export interface ScreenOpts {
  out?: Writable;
  in?: Readable;
}

export class Screen {
  out: Writable;
  shown: BufferT | null;
  constructor(opts?: ScreenOpts);
  readonly width: number;
  readonly height: number;
  rect(): Rect;
  start(): this;
  stop(): this;
  onKey(fn: (k: KeyEvent) => void): this;
  onInterrupt(fn: (k: KeyEvent) => void): this;
  onResize(fn: (r: Rect) => void): this;
  render(draw: (buf: BufferT, rect: Rect) => void): this;
  paint(buf: BufferT): this;
}

export interface RunOpts<S> {
  state: S;
  view: (state: S) => (buf: BufferT, rect: Rect) => void;
  reducer: (state: S, key: KeyEvent) => S | { state: S; quit?: boolean };
  screen?: Screen;
}

export function run<S>(opts: RunOpts<S>): void;
