// index — the convenience barrel re-exporting arnold's surface for callers that prefer one import.
// The subpath exports in package.json are the primary surface (import what you draw with); this
// barrel just gathers them.

export * as ansi from "./ansi.mjs";
export { Buffer, diff, cellsEqual, SPACE } from "./buffer.mjs";
export { render, renderChanges } from "./render.mjs";
export * as layout from "./layout.mjs";
export * as widgets from "./widgets.mjs";
export * as focus from "./focus.mjs";
export { parseKey, splitKeys, Keyboard } from "./input.mjs";
export { project, projectFiber, GLYPH, DEFAULT_CHARGE_STYLE } from "./projector.mjs";
export { Screen, run } from "./app.mjs";
