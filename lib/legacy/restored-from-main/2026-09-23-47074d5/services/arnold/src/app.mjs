// app — the composition root. Screen owns the terminal lifecycle (alt-screen enter/leave, cursor
// hide/show, raw-mode keyboard) and the SHOWN buffer; every render diffs a freshly-drawn frame
// against what is on screen and writes ONLY the changed cells (render.mjs). This is the one place
// that writes to the output stream — the second of arnold's two I/O touch points (input.mjs is the
// first). Everything it composes (buffer, layout, widgets, projector) is pure; Screen is the thin
// imperative shell.
//
// Usage:
//   const screen = new Screen();
//   screen.start();
//   screen.onKey((k) => { ...update state...; screen.render(draw); });
//   screen.render(draw);                 // draw(buf, rect) paints a fresh frame
//   screen.stop();                       // restores the terminal

import { Buffer } from "./buffer.mjs";
import { render as renderDiff } from "./render.mjs";
import { rect } from "./layout.mjs";
import { Keyboard } from "./input.mjs";
import {
  enterAltScreen, leaveAltScreen, hideCursor, showCursor, resetStyle, clearScreen, cursorHome,
} from "./ansi.mjs";

export class Screen {
  constructor(opts = {}) {
    this.out = opts.out || process.stdout;
    this.keyboard = new Keyboard(opts.in || process.stdin);
    this.shown = null; // the buffer currently on screen; null forces a full first paint
    this._started = false;
    this._onResize = () => { this.shown = null; this._emitResize(); };
    this._resizeHandlers = [];
  }

  get width() { return this.out.columns || 80; }
  get height() { return this.out.rows || 24; }
  rect() { return rect(0, 0, this.width, this.height); }

  start() {
    if (this._started) return this;
    this._started = true;
    this.out.write(enterAltScreen + hideCursor + clearScreen + cursorHome);
    this.keyboard.start();
    this.out.on?.("resize", this._onResize);
    // ensure the terminal is restored on the common exit paths
    this._exitHandler = () => this.stop();
    process.on("exit", this._exitHandler);
    return this;
  }

  stop() {
    if (!this._started) return this;
    this._started = false;
    this.keyboard.stop();
    this.out.off?.("resize", this._onResize);
    process.off?.("exit", this._exitHandler);
    this.out.write(resetStyle + showCursor + leaveAltScreen);
    return this;
  }

  onKey(fn) { this.keyboard.on("key", fn); return this; }
  onInterrupt(fn) { this.keyboard.on("interrupt", fn); return this; }
  onResize(fn) { this._resizeHandlers.push(fn); return this; }
  _emitResize() { for (const fn of this._resizeHandlers) fn(this.rect()); }

  // render(draw) — build a fresh buffer at the current size, let `draw(buf, rect)` paint it, diff it
  // against the shown buffer, write the minimal escape stream, and adopt the new buffer as shown.
  render(draw) {
    const buf = new Buffer(this.width, this.height);
    draw(buf, this.rect());
    const { out } = renderDiff(this.shown, buf);
    if (out) this.out.write(out);
    this.shown = buf;
    return this;
  }

  // paint(buf) — adopt and diff an already-drawn buffer (for callers that build their own).
  paint(buf) {
    const { out } = renderDiff(this.shown, buf);
    if (out) this.out.write(out);
    this.shown = buf;
    return this;
  }
}

// run(opts) — a tiny driver for the append/settle/PROJECT/loop rhythm the kernel note describes.
// You give it: an initial state, a `view(state) -> draw` (state to a draw function), and a
// `reducer(state, key) -> state | {state, quit}`. It renders, then on each key reduces and
// re-renders. This is the TUI as "read -> settle -> project -> loop" with project = view + diff.
export function run({ state, view, reducer, screen = new Screen() }) {
  let s = state;
  screen.start();
  const paint = () => screen.render(view(s));
  paint();
  screen.onKey((k) => {
    const next = reducer(s, k);
    if (next && next.quit) { screen.stop(); process.exit(0); }
    s = next && next.state !== undefined ? next.state : (next ?? s);
    paint();
  });
  screen.onInterrupt(() => { screen.stop(); process.exit(0); });
  return screen;
}
