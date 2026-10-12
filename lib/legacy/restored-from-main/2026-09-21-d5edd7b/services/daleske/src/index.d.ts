// index.d.ts — barrel re-exporting daleske's surface. See package.json "exports" for the subpath
// modules this mirrors.

export { Framebuffer, diff, tilesEqual, DEFAULT_TILE } from "./framebuffer.mjs";
export * as kitty from "./kitty.mjs";
export * as sixel from "./sixel.mjs";
export { detectFromEnv, probe, ENCODERS } from "./capability.mjs";
export { blit, blitFull } from "./blit.mjs";
export { project, projectFiber, CHARGE_COLOR, GLYPH } from "./projector.mjs";
export { parseKey, Keyboard } from "./input.mjs";
export { PixelScreen } from "./screen.mjs";
