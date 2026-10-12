// input.d.ts — hand-written types for src/input.mjs.

import { EventEmitter } from "node:events";
import type { Readable } from "node:stream";

export interface KeyEvent {
  name: string;
  char?: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  raw: string;
}

export function parseKey(seq: string): KeyEvent;

export class Keyboard extends EventEmitter {
  input: Readable & { isTTY?: boolean; setRawMode?: (v: boolean) => void };
  constructor(input?: Readable);
  start(): this;
  stop(): this;
  on(event: "key" | "interrupt", listener: (k: KeyEvent) => void): this;
}
