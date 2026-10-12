// prove-wireframe — the pure pipeline from a settled 3D world section to a grid of Arnold cells: a
// camera builds a view·perspective matrix, render() rasters a renderable's hull with Bresenham lines,
// charge IS the render glyph, and a ⊤ renderable draws TWICE (doubled + jittered by tick phase, never
// RNG — replay-identical). New tests written for this port (no legacy test existed for tsander — see
// the package README's Port notes).

import { camera, render, emptyFrame, frameToLines, CHARGE_GLYPH } from "../src/wireframe.mjs";
import { FOUR } from "../src/world.mjs";
import { ok, eq, done } from "./_harness.mjs";

// ── emptyFrame ──────────────────────────────────────────────────────────────────────────────
{
  const f = emptyFrame(10, 4);
  eq(f.width, 10, "emptyFrame carries its width");
  eq(f.height, 4, "emptyFrame carries its height");
  eq(f.glyphs.length, 40, "emptyFrame allocates width*height glyph cells");
  ok(f.glyphs.every((g) => g === " "), "emptyFrame is blank spaces");
  ok(f.charges.every((c) => c === null), "emptyFrame's charges are all null");
}

// ── camera: builds the requested grid dimensions ──────────────────────────────────────────
{
  const cam = camera({ width: 64, height: 22, eye: [0, 0, 10], target: [0, 0, 0] });
  eq(cam.width, 64, "camera carries the requested width");
  eq(cam.height, 22, "camera carries the requested height");
  eq(cam.eye, [0, 0, 10], "camera carries the eye position");
  ok(Array.isArray(cam.vp) && cam.vp.length === 16, "camera builds a 16-number view*perspective matrix");
}

// ── render: an empty renderable list yields a blank frame with an all-zero census ────────
{
  const cam = camera({ width: 20, height: 10, eye: [0, 0, 5], target: [0, 0, 0] });
  const f = render([], cam, { phase: 0 });
  ok(frameToLines(f).every((line) => line.trim() === ""), "no renderables => a blank frame");
  eq(f.census, { t: 0, f: 0, bot: 0, top: 0 }, "an empty renderable list censuses to all zero");
}

// ── render: a single affirmed (t) cube draws solid '#' glyphs, charge-tagged ─────────────
{
  const cam = camera({ width: 40, height: 20, eye: [0, 0, 6], target: [0, 0, 0] });
  const rs = [{ subject: "sol-iii", position: [0, 0, 0], charge: FOUR.T, contested: [], shape: null }];
  const f = render(rs, cam, { phase: 0 });
  const drawn = f.glyphs.filter((g) => g !== " ");
  ok(drawn.length > 0, "a t-charged unit draws SOMETHING onto the frame (facing the camera at the origin)");
  ok(drawn.every((g) => g === CHARGE_GLYPH[FOUR.T]), "a t-charged unit draws only the 't' glyph ('#')");
  eq(f.census.t, 1, "the census counts the one t renderable");
}

// ── render: a denied (f) unit draws the wreck-stub glyph 'x' ─────────────────────────────
{
  const cam = camera({ width: 40, height: 20, eye: [0, 0, 6], target: [0, 0, 0] });
  const rs = [{ subject: "wreck", position: [0, 0, 0], charge: FOUR.F, contested: [], shape: null }];
  const f = render(rs, cam, { phase: 0 });
  const drawn = f.glyphs.filter((g) => g !== " ");
  ok(drawn.length > 0, "an f-charged unit still draws (a collapsed wreck-stub, not nothing)");
  ok(drawn.every((g) => g === CHARGE_GLYPH[FOUR.F]), "an f-charged unit draws only the 'x' glyph");
}

// ── render: an unvisited (⊥) unit draws the dotted guess glyph '·' ───────────────────────
{
  const cam = camera({ width: 40, height: 20, eye: [0, 0, 6], target: [0, 0, 0] });
  const rs = [{ subject: "fog", position: [0, 0, 0], charge: FOUR.BOT, contested: [], shape: null }];
  const f = render(rs, cam, { phase: 0 });
  const drawn = f.glyphs.filter((g) => g !== " ");
  ok(drawn.every((g) => g === CHARGE_GLYPH[FOUR.BOT]), "a ⊥-charged unit draws only the '·' glyph");
}

// ── THE BILATTICE READOUT: a ⊤ unit draws TWICE — more cells than an equivalent t unit ───
{
  const cam = camera({ width: 40, height: 20, eye: [0, 0, 6], target: [0, 0, 0] });
  const tRs = [{ subject: "settled", position: [0, 0, 0], charge: FOUR.T, contested: [], shape: null }];
  const topRs = [{ subject: "contested", position: [0, 0, 0], charge: FOUR.TOP, contested: [], shape: null }];
  const fT = render(tRs, cam, { phase: 1 });
  const fTop = render(topRs, cam, { phase: 1 });
  const countT = fT.glyphs.filter((g) => g !== " ").length;
  const countTop = fTop.glyphs.filter((g) => g !== " ").length;
  ok(countTop > countT, "a ⊤ unit's second (offset) hull draws MORE cells than the same hull drawn once — the doubling is real, not decorative");
  ok(fTop.glyphs.some((g) => g === CHARGE_GLYPH[FOUR.TOP]), "a ⊤ unit draws the '%' contested glyph");
}

// ── THE JITTER IS DETERMINISTIC (phase-driven, never RNG): same phase => same frame ──────
{
  const cam = camera({ width: 40, height: 20, eye: [0, 0, 6], target: [0, 0, 0] });
  const rs = [{ subject: "contested", position: [0, 0, 0], charge: FOUR.TOP, contested: [], shape: null }];
  const a = render(rs, cam, { phase: 3 });
  const b = render(rs, cam, { phase: 3 });
  eq(a.glyphs, b.glyphs, "the SAME phase renders an IDENTICAL frame (replay-identical, no Math.random)");
}

// ── the jitter cycles across phases (the offset actually varies) ─────────────────────────
{
  const cam = camera({ width: 40, height: 20, eye: [0, 0, 6], target: [0, 0, 0] });
  const rs = [{ subject: "contested", position: [0, 0, 0], charge: FOUR.TOP, contested: [], shape: null }];
  const frames = [0, 1, 2, 3].map((phase) => render(rs, cam, { phase }).glyphs.join(""));
  const distinct = new Set(frames);
  ok(distinct.size > 1, "different tick phases produce visibly different frames (the shiver is live)");
  // phase 0 and phase 4 share the same jitter offset (a 4-state cycle) => identical frames.
  const f0 = render(rs, cam, { phase: 0 }).glyphs.join("");
  const f4 = render(rs, cam, { phase: 4 }).glyphs.join("");
  eq(f0, f4, "the jitter cycle repeats every 4 phases (phase 0 and phase 4 render identically)");
}

// ── draw order is charge-salience: ⊤ (contested) is never occluded ───────────────────────
{
  const cam = camera({ width: 40, height: 20, eye: [0, 0, 6], target: [0, 0, 0] });
  // two units at the SAME position: a settled t-unit and a contested ⊤-unit. Salience order draws
  // ⊥ < f < t < ⊤, so the ⊤ glyph must survive (drawn last) at any cell both would touch.
  const rs = [
    { subject: "settled", position: [0, 0, 0], charge: FOUR.T, contested: [], shape: null },
    { subject: "contested", position: [0, 0, 0], charge: FOUR.TOP, contested: [], shape: null },
  ];
  const f = render(rs, cam, { phase: 0 });
  ok(f.glyphs.includes(CHARGE_GLYPH[FOUR.TOP]), "with a t-unit and a ⊤-unit sharing a position, the ⊤ glyph is present in the final frame (drawn on top, not occluded)");
}

done("prove-wireframe");
