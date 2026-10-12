// input — raw-mode keyboard decoding + the event loop. This is one of arnold's two I/O touch
// points (the other is the screen's writes); it uses only node builtins (process.stdin, no deps).
// parseKey is PURE (bytes -> key event) and is what the tests exercise; Keyboard wires it to
// stdin's raw mode and emits events. A "key event" is:
//   { name, char?, ctrl, meta, shift, raw }
// where `name` is a normalized key name ("up", "enter", "escape", "char", ...) and `char` is the
// literal printable code point when name === "char".

import { EventEmitter } from "node:events";

// === pure decode ============================================================================
// parseKey(seq) — decode ONE key from a raw input string. Returns a key event. We cover the common
// VT100/xterm sequences an interactive TUI needs; an unrecognized escape sequence returns
// { name: "unknown", raw }. A lone control char (ctrl-a..ctrl-z) is decoded with ctrl:true.
const CSI_NAMES = {
  A: "up", B: "down", C: "right", D: "left",
  H: "home", F: "end",
  "5~": "pageup", "6~": "pagedown",
  "2~": "insert", "3~": "delete",
  "1~": "home", "4~": "end",
};

export function parseKey(seq) {
  const raw = seq;
  // Escape-led sequences
  if (seq[0] === "\x1b") {
    if (seq.length === 1) return key("escape", { raw });
    // CSI: ESC [ ...
    if (seq[1] === "[" || seq[1] === "O") {
      const body = seq.slice(2);
      // final letter form (ESC [ A) or numeric+tilde (ESC [ 3 ~)
      const m = body.match(/^(\d*)(;\d+)?([A-Z~])$/);
      if (m) {
        const num = m[1], final = m[3];
        const lookup = final === "~" ? `${num}~` : final;
        const name = CSI_NAMES[lookup] || CSI_NAMES[final] || "unknown";
        const shift = m[2] === ";2";
        return key(name, { raw, shift });
      }
      return key("unknown", { raw });
    }
    // ESC + char => meta/alt
    const inner = parseKey(seq.slice(1));
    return { ...inner, meta: true, raw };
  }
  // Single bytes
  if (seq === "\r" || seq === "\n") return key("enter", { raw });
  if (seq === "\t") return key("tab", { raw });
  if (seq === "\x7f" || seq === "\b") return key("backspace", { raw });
  if (seq === " ") return key("space", { char: " ", raw });
  // ctrl-a .. ctrl-z (0x01..0x1a), excluding the ones handled above
  const code = seq.charCodeAt(0);
  if (code >= 1 && code <= 26 && seq.length === 1) {
    return key("char", { char: String.fromCharCode(code + 96), ctrl: true, raw });
  }
  // printable
  if (seq.length >= 1 && code >= 0x20) {
    return key("char", { char: seq, raw });
  }
  return key("unknown", { raw });
}

function key(name, extra = {}) {
  return { name, char: extra.char, ctrl: !!extra.ctrl, meta: !!extra.meta, shift: !!extra.shift, raw: extra.raw };
}

// === the event loop =========================================================================
// Keyboard — wires parseKey to a raw-mode stdin and emits "key" events. Splitting a chunk into
// individual keys is approximate (a chunk may carry several keypresses); we split on ESC bounds so
// a single arrow press (ESC [ A) stays one key while pasted text streams as chars.
export class Keyboard extends EventEmitter {
  constructor(stream = process.stdin) {
    super();
    this.stream = stream;
    this._onData = (chunk) => {
      for (const seq of splitKeys(chunk.toString("utf8"))) {
        const k = parseKey(seq);
        this.emit("key", k);
        if (k.name === "char" && k.ctrl && k.char === "c") this.emit("interrupt", k);
      }
    };
  }

  start() {
    if (this.stream.isTTY && this.stream.setRawMode) this.stream.setRawMode(true);
    this.stream.resume();
    this.stream.setEncoding?.("utf8");
    this.stream.on("data", this._onData);
    return this;
  }

  stop() {
    this.stream.off("data", this._onData);
    if (this.stream.isTTY && this.stream.setRawMode) this.stream.setRawMode(false);
    this.stream.pause?.();
    return this;
  }
}

// splitKeys(s) — split an input chunk into per-key substrings. Each ESC starts a new key; an ESC
// sequence runs until its final byte (a letter, or '~'). Everything else is one char per key.
export function splitKeys(s) {
  const keys = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === "\x1b") {
      let j = i + 1;
      if (s[j] === "[" || s[j] === "O") {
        j++;
        while (j < s.length && !/[A-Za-z~]/.test(s[j])) j++;
        if (j < s.length) j++; // include the final byte
      } else if (j < s.length) {
        j++; // ESC + one char (meta)
      }
      keys.push(s.slice(i, j));
      i = j;
    } else {
      keys.push(s[i]);
      i++;
    }
  }
  return keys;
}
