// input — raw-mode keyboard decoding + an event loop, daleske's I/O input touch point (the screen's
// writes are the other). Mirrors arnold/input: parseKey is PURE (bytes -> key event) and is what a
// test exercises; Keyboard wires it to stdin's raw mode. A key event is
//   { name, char?, ctrl, meta, shift, raw }
// with `name` a normalized key name ("up","enter","escape","char",...) and `char` the printable code
// point when name === "char". Node builtins only.

import { EventEmitter } from "node:events";

const CSI_NAMES = {
  A: "up", B: "down", C: "right", D: "left", H: "home", F: "end",
  "5~": "pageup", "6~": "pagedown", "3~": "delete",
};

function key(name, extra = {}) {
  return { name, char: extra.char, ctrl: !!extra.ctrl, meta: !!extra.meta, shift: !!extra.shift, raw: extra.raw };
}

// parseKey(seq) — decode ONE key from a raw input string.
export function parseKey(seq) {
  const raw = seq;
  if (seq[0] === "\x1b") {
    if (seq.length === 1) return key("escape", { raw });
    if (seq[1] === "[" || seq[1] === "O") {
      const body = seq.slice(2);
      const m = body.match(/^(\d*)([A-Z~])$/);
      if (m) {
        const num = m[1], final = m[2];
        const lookup = final === "~" ? `${num}~` : final;
        return key(CSI_NAMES[lookup] || CSI_NAMES[final] || "unknown", { raw });
      }
      return key("unknown", { raw });
    }
    return key("char", { char: seq.slice(1), meta: true, raw });
  }
  const code = seq.charCodeAt(0);
  if (code === 13 || code === 10) return key("enter", { raw });
  if (code === 9) return key("tab", { raw });
  if (code === 127 || code === 8) return key("backspace", { raw });
  if (code === 3) return key("interrupt", { ctrl: true, raw }); // ctrl-c
  if (code === 32) return key("space", { char: " ", raw });
  if (code < 0x20) {
    // ctrl-<letter>: 1..26 -> a..z
    return key("char", { char: String.fromCharCode(code + 96), ctrl: true, raw });
  }
  return key("char", { char: seq, raw });
}

// Keyboard — wires parseKey to a stdin stream's raw mode and emits "key"/"interrupt".
export class Keyboard extends EventEmitter {
  constructor(input = process.stdin) {
    super();
    this.input = input;
    this._onData = (buf) => {
      const ev = parseKey(buf.toString("utf8"));
      if (ev.name === "interrupt") this.emit("interrupt", ev);
      else this.emit("key", ev);
    };
  }
  start() {
    if (this.input.isTTY) this.input.setRawMode?.(true);
    this.input.resume?.();
    this.input.on("data", this._onData);
    return this;
  }
  stop() {
    this.input.off?.("data", this._onData);
    if (this.input.isTTY) this.input.setRawMode?.(false);
    this.input.pause?.();
    return this;
  }
}
