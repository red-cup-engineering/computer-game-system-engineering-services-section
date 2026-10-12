// daleske — the PIXEL terminal framework, the raster analogue of arnold. The barrel re-export so a
// caller can `import { Framebuffer, project, blit, PixelScreen } from "@561-group/daleske"`.
//
// The pieces, by layer (each is pure unless noted):
//   framebuffer — an RGBA raster + a TILE diff (the pixel Buffer).
//   kitty / sixel — the two raster ENCODERS (the byte grammars; capability picks between them).
//   capability — detect kitty | sixel | none, falling back gracefully.
//   blit — the DIFFED pixel paint: changed tiles -> the minimal encoder escape stream.
//   projector — THE SEAM: project(settledSection) -> a PIXEL frame (⊤ painted CONTESTED, ⊥ pending).
//   input — raw-mode keyboard (pure parseKey + a Keyboard shell).
//   screen — the composition root (the only raster writer; the imperative shell).

export { Framebuffer, diff, tilesEqual, DEFAULT_TILE } from "./framebuffer.mjs";
export * as kitty from "./kitty.mjs";
export * as sixel from "./sixel.mjs";
export { detectFromEnv, probe, ENCODERS } from "./capability.mjs";
export { blit, blitFull } from "./blit.mjs";
export { project, projectFiber, CHARGE_COLOR, GLYPH } from "./projector.mjs";
export { parseKey, Keyboard } from "./input.mjs";
export { PixelScreen } from "./screen.mjs";
