// prove-cube-orientation — a known camera + a known cube, hand-computed: this test derives the exact
// grid cells the front and back face edges MUST land on by working the camera math on paper (shown
// below), then asserts render() actually puts glyphs there. Not "run it and snapshot whatever comes
// out" — the expected coordinates are computed independently of the renderer, from the same closed-
// form math.mjs the renderer itself uses.
//
// ── the setup (chosen so the perspective divide reduces to fractions a person can do by hand) ──
// camera({ width: 40, height: 20, eye: [0,0,3], target: [0,0,0], up: [0,1,0], fov: PI/2 })
//   aspect = (width/height)*0.5 = (40/20)*0.5 = 1.0
//   f = 1/tan(fov/2) = 1/tan(45°) = 1
// eye sits on the +z axis looking at the origin with up=[0,1,0], so lookAt's basis comes out to the
// identity rotation (x=[1,0,0], y=[0,1,0], z=[0,0,1]) — view space is just world space shifted by
// -eye.z. So for any world point (x,y,z):
//   clipW = eye.z - z          (since m4.perspective's row3 is [0,0,-1,0] and view.z = z - eye.z)
//   ndcX  = (f/aspect)*x / clipW = x / clipW        (f=aspect=1)
//   ndcY  = f*y / clipW         = y / clipW
//   cellX = round((ndcX*0.5+0.5) * (width-1))  = round((ndcX*0.5+0.5)*39)
//   cellY = round((1-(ndcY*0.5+0.5)) * (height-1)) = round((0.5-ndcY*0.5)*19)
//
// The unit cube (CUBE_VERTS in wireframe.mjs) has half-extent 1, so its front face sits at z=+1 and
// its back face at z=-1. With eye.z=3: clipW(front)=3-1=2, clipW(back)=3-(-1)=4.
//
// FRONT FACE (z=+1, clipW=2) — the four corners (x,y) ∈ {-1,1}×{-1,1}:
//   ndcX = x/2, ndcY = y/2  =>  ndcX,ndcY ∈ {-0.5, +0.5}
//   x=-1 -> cellX = round((-0.25+0.5)*39) = round(0.25*39)  = round(9.75)  = 10
//   x=+1 -> cellX = round(( 0.25+0.5)*39) = round(0.75*39)  = round(29.25)= 29
//   y=-1 -> cellY = round((0.5+0.25)*19)  = round(0.75*19)  = round(14.25)= 14
//   y=+1 -> cellY = round((0.5-0.25)*19)  = round(0.25*19)  = round(4.75) = 5
//   => front face corners: (10,5) (29,5) (29,14) (10,14) — a clean axis-aligned rectangle.
//
// BACK FACE (z=-1, clipW=4) — same corners, halved fraction:
//   ndcX = x/4, ndcY = y/4  =>  ndcX,ndcY ∈ {-0.25, +0.25}
//   x=-1 -> cellX = round((-0.125+0.5)*39) = round(0.375*39) = round(14.625) = 15
//   x=+1 -> cellX = round(( 0.125+0.5)*39) = round(0.625*39) = round(24.375) = 24
//   y=-1 -> cellY = round((0.5+0.125)*19)  = round(0.625*19) = round(11.875) = 12
//   y=+1 -> cellY = round((0.5-0.125)*19)  = round(0.375*19) = round(7.125)  = 7
//   => back face corners: (15,7) (24,7) (24,12) (15,12) — nested inside the front rectangle, exactly
//      the classic "cube in one-point-ish perspective" look, and (because both faces' verticals and
//      horizontals stay axis-aligned) every edge cell along an edge is exactly hand-verifiable —
//      Bresenham on a perfectly horizontal or vertical run just fills every cell in between.

import { camera, render } from "../src/wireframe.mjs";
import { FOUR } from "../src/world.mjs";
import { ok, eq, done } from "./_harness.mjs";

const cam = camera({ width: 40, height: 20, eye: [0, 0, 3], target: [0, 0, 0], up: [0, 1, 0], fov: Math.PI / 2 });
const rs = [{ subject: "cube", position: [0, 0, 0], charge: FOUR.T, contested: [], shape: null }];
const f = render(rs, cam, { phase: 0 });
const at = (x, y) => f.glyphs[y * f.width + x];

// === front face: full horizontal/vertical runs, every cell hand-checkable ====================
for (let x = 10; x <= 29; x++) {
  eq(at(x, 5), "#", `front top edge: (${x},5) is '#'`);
  eq(at(x, 14), "#", `front bottom edge: (${x},14) is '#'`);
}
for (let y = 5; y <= 14; y++) {
  eq(at(10, y), "#", `front left edge: (10,${y}) is '#'`);
  eq(at(29, y), "#", `front right edge: (29,${y}) is '#'`);
}

// === back face: same, at the hand-derived nested rectangle ===================================
for (let x = 15; x <= 24; x++) {
  eq(at(x, 7), "#", `back top edge: (${x},7) is '#'`);
  eq(at(x, 12), "#", `back bottom edge: (${x},12) is '#'`);
}
for (let y = 7; y <= 12; y++) {
  eq(at(15, y), "#", `back left edge: (15,${y}) is '#'`);
  eq(at(24, y), "#", `back right edge: (24,${y}) is '#'`);
}

// === the four connector edges (front corner <-> back corner) at least touch both hand-derived
// endpoints — the diagonal interior of a connector isn't hand-verified cell-by-cell, but its two
// ends are exactly the corners derived above, and both corners are already confirmed lit.
const connectors = [
  [[10, 5], [15, 7]],   // top-left
  [[29, 5], [24, 7]],   // top-right
  [[29, 14], [24, 12]], // bottom-right
  [[10, 14], [15, 12]], // bottom-left
];
for (const [[fx, fy], [bx, by]] of connectors) {
  eq(at(fx, fy), "#", `connector front endpoint (${fx},${fy}) is lit`);
  eq(at(bx, by), "#", `connector back endpoint (${bx},${by}) is lit`);
}

// === nothing lit outside the hand-derived bounding box (rows 0-4, 15-19 are pure fog/margin) ===
ok([0, 1, 2, 3, 4, 15, 16, 17, 18, 19].every((y) => {
  const line = f.glyphs.slice(y * f.width, (y + 1) * f.width).join("");
  return line.trim() === "";
}), "no glyph strays above row 5 or below row 14 (the hand-derived cube bounds)");

eq(f.census, { t: 1, f: 0, bot: 0, top: 0 }, "census counts exactly the one t-charged cube");

done("prove-cube-orientation");
