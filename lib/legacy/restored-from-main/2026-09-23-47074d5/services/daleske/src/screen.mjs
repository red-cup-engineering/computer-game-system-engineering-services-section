// screen — the composition root and the one place that writes raster bytes to the terminal (input.mjs
// is the other I/O touch point). PixelScreen owns the terminal lifecycle (alt-screen, cursor, raw
// keyboard), DETECTS the raster capability once at start (kitty | sixel | none), holds the SHOWN
// framebuffer, and on each render diffs a freshly-drawn framebuffer against what is on screen and
// blits ONLY the changed tiles. Everything it composes (framebuffer, projector, encoders, blit) is
// pure; PixelScreen is the thin imperative shell — the pixel sibling of arnold's Screen.

import { Framebuffer } from "./framebuffer.mjs";
import { blit } from "./blit.mjs";
import { Keyboard } from "./input.mjs";
import { probe } from "./capability.mjs";
import * as kitty from "./kitty.mjs";

const ESC = "\x1b";
const enterAltScreen = `${ESC}[?1049h`;
const leaveAltScreen = `${ESC}[?1049l`;
const hideCursor = `${ESC}[?25l`;
const showCursor = `${ESC}[?25h`;
const clearScreen = `${ESC}[2J`;
const cursorHome = `${ESC}[H`;

// CELL_W / CELL_H — the assumed pixel size of one terminal cell, used to place tiles at a cursor cell
// (the protocols draw at the cursor, which addresses cells, not pixels). A typical cell is ~8×16 px.
const CELL_W = 8, CELL_H = 16;

export class PixelScreen {
  constructor(opts = {}) {
    this.out = opts.out || process.stdout;
    this.keyboard = new Keyboard(opts.in || process.stdin);
    this.cap = probe(this.out, opts.env || process.env);
    this.encoder = opts.encoder || this.cap.encoder; // allow an explicit override
    this.cellW = opts.cellW ?? CELL_W;
    this.cellH = opts.cellH ?? CELL_H;
    this.tile = opts.tile;
    this.shown = null; // the framebuffer on screen; null forces a full first paint
    this._started = false;
  }

  // pixel dimensions of the drawable area: terminal cells × cell pixel size.
  get width() { return (this.out.columns || 80) * this.cellW; }
  get height() { return (this.out.rows || 24) * this.cellH; }

  start() {
    if (this._started) return this;
    this._started = true;
    this.out.write(enterAltScreen + hideCursor + clearScreen + cursorHome);
    this.keyboard.start();
    this._exitHandler = () => this.stop();
    process.on("exit", this._exitHandler);
    return this;
  }

  stop() {
    if (!this._started) return this;
    this._started = false;
    this.keyboard.stop();
    process.off?.("exit", this._exitHandler);
    if (this.encoder === "kitty") this.out.write(kitty.deleteAll());
    this.out.write(showCursor + leaveAltScreen);
    return this;
  }

  onKey(fn) { this.keyboard.on("key", fn); return this; }
  onInterrupt(fn) { this.keyboard.on("interrupt", fn); return this; }

  // render(draw) — build a fresh framebuffer at the current pixel size, let `draw(fb)` paint it,
  // diff it against the shown framebuffer, blit the minimal set of changed tiles, adopt as shown.
  render(draw) {
    const fb = new Framebuffer(this.width, this.height, this.tile);
    draw(fb);
    const { out } = blit(this.shown, fb, {
      encoder: this.encoder, cellW: this.cellW, cellH: this.cellH,
    });
    if (out) this.out.write(out);
    this.shown = fb;
    return this;
  }

  // paint(fb) — adopt and diff an already-drawn framebuffer (e.g. one a projector returned).
  paint(fb) {
    const { out } = blit(this.shown, fb, {
      encoder: this.encoder, cellW: this.cellW, cellH: this.cellH,
    });
    if (out) this.out.write(out);
    this.shown = fb;
    return this;
  }
}
