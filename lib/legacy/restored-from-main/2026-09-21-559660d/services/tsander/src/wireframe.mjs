// wireframe — the engine's WIREFRAME RENDERER: a pure pipeline from a settled 3D world section to a
// grid of Arnold cells. This is the design note's §7 projector, lifted to the engine: model-space
// vertices → camera (lookAt·perspective) → ndc → the terminal character grid → Bresenham line raster
// → a glyph frame. It rides Arnold's projector SEAM: Arnold maps a settled SECTION to terminal cells
// (`project(section)->frame`); this maps a settled 3D section to terminal cells, the GEOMETRY analogue,
// kept pure and replay-identical (no Date.now, no Math.random) the same way event-projection is.
//
// THE BILATTICE READOUT (the whole point): each renderable carries a FOUR charge (from world.place),
// and the charge IS the render style — a direct readout of the bilattice, not decoration:
//   t   (affirmed)    : a clean, single, solid wireframe.
//   ⊥   (bot/unvisited): a faint, dotted, single outline — guessed geometry, "·".
//   f   (denied)      : a wreck-stub — the negative face won; drawn collapsed/small.
//   ⊤   (contradicted): drawn TWICE, both witnesses' geometry offset and JITTERING frame-to-frame —
//                        a doubled, shivering wireframe. The jitter is driven by the tick PHASE (a
//                        parameter), never an RNG, so it is replay-identical: the same world + same
//                        phase = the same frame. The LAW: ⊤ is shown as a designed mechanic, never hidden.
//
// Output is a plain `frame` (rows of glyph strings + a parallel charge grid), so a renderer (Arnold's
// buffer, or a test) draws it without this module touching node:tty. Pure data in, pure data out.

import { v3, m4 } from "./math.mjs";
import { FOUR } from "./world.mjs";

// ── the unit hull: a wireframe cube as 12 edges of 8 corners. The default geometry for any unit with
// no stated hull. Model space, centered at origin, half-extent 1.
const CUBE_VERTS = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const CUBE_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0], // back face
  [4, 5], [5, 6], [6, 7], [7, 4], // front face
  [0, 4], [1, 5], [2, 6], [3, 7], // connectors
];

// a small octahedron (a "star" / point unit) — 6 verts, 12 edges. Used when shape === "star".
const STAR_VERTS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const STAR_EDGES = [
  [0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [1, 3],
  [1, 4], [1, 5], [2, 4], [4, 3], [3, 5], [5, 2],
];

function hullFor(shape, charge) {
  // a denied unit is a WRECK-STUB: collapse the cube to a small cross-stub (the negative face won).
  if (charge === FOUR.F) return { verts: [[-0.4, 0, 0], [0.4, 0, 0], [0, -0.4, 0], [0, 0.4, 0]], edges: [[0, 1], [2, 3]], scale: 1 };
  if (shape === "star") return { verts: STAR_VERTS, edges: STAR_EDGES, scale: 1 };
  if (Array.isArray(shape) && shape.length) {
    // a stated vertex list with implicit edge ring + base cube edges if 8 verts
    const edges = shape.length === 8 ? CUBE_EDGES : shape.map((_, i) => [i, (i + 1) % shape.length]);
    return { verts: shape, edges, scale: 1 };
  }
  return { verts: CUBE_VERTS, edges: CUBE_EDGES, scale: 1 };
}

// glyph per charge (the pen the bilattice readout chooses).
export const CHARGE_GLYPH = Object.freeze({
  [FOUR.T]: "#",     // solid, settled truth
  [FOUR.BOT]: "·",   // dotted, guessed geometry (⊥ fog)
  [FOUR.F]: "x",     // wreck-stub (denied)
  [FOUR.TOP]: "%",   // contested — doubled+shivering (⊤)
});

// ── the camera ────────────────────────────────────────────────────────────────────────────────
// camera({ eye, target, up, fov, width, height, near, far }) — build the view·perspective matrix and
// hold the terminal grid dimensions. Pure; deterministic.
export function camera(opts = {}) {
  const width = opts.width ?? 80;
  const height = opts.height ?? 24;
  const eye = opts.eye ?? [0, 0, 10];
  const target = opts.target ?? [0, 0, 0];
  const up = opts.up ?? [0, 1, 0];
  const fov = opts.fov ?? Math.PI / 3;
  const near = opts.near ?? 0.1;
  const far = opts.far ?? 1000;
  // terminal cells are ~2× taller than wide; correct aspect by that ratio so a cube reads square.
  const aspect = (width / height) * 0.5;
  const view = m4.lookAt(eye, target, up);
  const proj = m4.perspective(fov, aspect, near, far);
  const vp = m4.multiply(proj, view);
  return { vp, width, height, near, far, eye };
}

// project a model-space vertex (already world-positioned) to a grid cell {x,y} (integer col,row) plus
// a `visible` flag (clipped behind the camera or off-grid => not drawn). Returns null when clipped.
function toCell(cam, worldVert) {
  const clip = m4.transformPoint(cam.vp, worldVert);
  const w = clip[3];
  if (w <= 0) return null; // behind the camera
  const ndcX = clip[0] / w, ndcY = clip[1] / w;
  if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1) return null;
  const x = Math.round((ndcX * 0.5 + 0.5) * (cam.width - 1));
  const y = Math.round((1 - (ndcY * 0.5 + 0.5)) * (cam.height - 1)); // y down in the grid
  return { x, y };
}

// Bresenham line raster into the frame: write `glyph` (and `charge`) at each cell along (a→b).
function rasterLine(frame, a, b, glyph, charge) {
  let { x: x0, y: y0 } = a;
  const { x: x1, y: y1 } = b;
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  // guard so a pathological line can't loop forever on a degenerate grid
  for (let guard = 0; guard < frame.width * frame.height * 4 + 4; guard++) {
    if (x0 >= 0 && x0 < frame.width && y0 >= 0 && y0 < frame.height) {
      const i = y0 * frame.width + x0;
      frame.glyphs[i] = glyph;
      frame.charges[i] = charge;
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// emptyFrame(width, height) — a blank frame: a width×height grid of " " glyphs and null charges.
export function emptyFrame(width, height) {
  return {
    width, height,
    glyphs: new Array(width * height).fill(" "),
    charges: new Array(width * height).fill(null),
  };
}

// the ⊤ jitter offset for a tick phase — a deterministic shiver between two integer offsets, driven by
// the phase (the tick count), NOT an RNG. Even phase → no offset; odd phase → one cell over. Replay-
// identical: the same phase gives the same shiver. The SECOND witness is drawn at this offset.
function jitterOffset(phase) {
  const p = ((phase % 4) + 4) % 4;
  return [[0, 0], [1, 0], [1, 1], [0, 1]][p];
}

// drawRenderable(frame, cam, r, phase) — draw one renderable's hull into the frame, styled by its
// charge. A ⊤ renderable is drawn TWICE: the primary hull, then a second offset+jittered copy, so the
// object shivers between two positions — the bilattice readout the design note calls for.
function drawRenderable(frame, cam, r, phase) {
  const { verts, edges } = hullFor(r.shape, r.charge);
  const glyph = CHARGE_GLYPH[r.charge] ?? "#";
  const drawHull = (offset) => {
    const cells = verts.map((vert) => {
      const world = v3.add(r.position, vert);
      const c = toCell(cam, world);
      if (!c) return null;
      return { x: c.x + offset[0], y: c.y + offset[1] };
    });
    for (const [i, j] of edges) {
      const a = cells[i], b = cells[j];
      if (a && b) rasterLine(frame, a, b, glyph, r.charge);
    }
  };
  drawHull([0, 0]);
  if (r.charge === FOUR.TOP) {
    // the contradiction render: a second witness, offset and shivering by the tick phase.
    drawHull(jitterOffset(phase));
  }
}

// render(renderables, cam, opts) — THE SEAM. Pure: a list of world renderables + a camera (+ a tick
// `phase` for the ⊤ shiver) → a glyph frame. The caller (Arnold's buffer, or a test) draws the frame.
// Drawing order is by charge salience so the contested objects are not overwritten by settled ones:
// ⊥ first (fog underneath), then f, then t, then ⊤ on top (the contradiction you must not miss).
const SALIENCE = { [FOUR.BOT]: 0, [FOUR.F]: 1, [FOUR.T]: 2, [FOUR.TOP]: 3 };
export function render(renderables, cam, opts = {}) {
  const phase = opts.phase ?? 0;
  const frame = emptyFrame(cam.width, cam.height);
  const ordered = [...renderables].sort((a, b) => (SALIENCE[a.charge] ?? 0) - (SALIENCE[b.charge] ?? 0));
  for (const r of ordered) drawRenderable(frame, cam, r, phase);
  // a small census so a status line can announce the four-value population at a glance.
  const census = { t: 0, f: 0, bot: 0, top: 0 };
  for (const r of renderables) census[r.charge] = (census[r.charge] ?? 0) + 1;
  return { ...frame, census, phase };
}

// frameToLines(frame) — flatten a frame's glyph grid to an array of strings (one per row). A renderer
// with no styling (a test, a plain dump) uses this; Arnold's buffer reads glyphs+charges for color.
export function frameToLines(frame) {
  const lines = [];
  for (let r = 0; r < frame.height; r++) {
    lines.push(frame.glyphs.slice(r * frame.width, (r + 1) * frame.width).join(""));
  }
  return lines;
}
