// prove-math — the rederived vec3/mat4 kernel holds the identities the wireframe renderer trusts:
// multiply by identity is a no-op, perspective sends the near plane to ndc z=-1, lookAt produces an
// orthonormal basis, and transformPoint matches hand computation. New tests written for this port
// (no legacy test existed for tsander — see the package README's Port notes).

import { v3, m4 } from "../src/math.mjs";
import { ok, eq, near, done } from "./_harness.mjs";

// ── v3 ──────────────────────────────────────────────────────────────────────────────────────
eq(v3.create(1, 2, 3), [1, 2, 3], "v3.create builds a 3-tuple");
eq(v3.add([1, 2, 3], [4, 5, 6]), [5, 7, 9], "v3.add is componentwise");
eq(v3.sub([5, 7, 9], [4, 5, 6]), [1, 2, 3], "v3.sub is componentwise");
eq(v3.scale([1, 2, 3], 2), [2, 4, 6], "v3.scale multiplies each component");
ok(v3.dot([1, 0, 0], [0, 1, 0]) === 0, "v3.dot of perpendicular unit vectors is 0");
ok(v3.dot([1, 2, 3], [1, 2, 3]) === 14, "v3.dot of a vector with itself is its squared length");
eq(v3.cross([1, 0, 0], [0, 1, 0]), [0, 0, 1], "v3.cross(x,y) = z (right-handed)");
near(v3.length([3, 4, 0]), 5, "v3.length is the euclidean norm (3-4-5 triangle)");
const n = v3.normalize([3, 4, 0]);
near(v3.length(n), 1, "v3.normalize yields a unit vector");
eq(v3.normalize([0, 0, 0]), [0, 0, 0], "v3.normalize of the zero vector is the zero vector (no NaN)");

// ── m4.identity / multiply ────────────────────────────────────────────────────────────────
const I = m4.identity();
eq(I, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], "m4.identity is the 4x4 identity, column-major");
const M = m4.perspective(Math.PI / 2, 1, 1, 100);
const MI = m4.multiply(M, I);
for (let i = 0; i < 16; i++) near(MI[i], M[i], `m4.multiply(M, identity)[${i}] === M[${i}]`);
const IM = m4.multiply(I, M);
for (let i = 0; i < 16; i++) near(IM[i], M[i], `m4.multiply(identity, M)[${i}] === M[${i}]`);

// ── m4.perspective: the near plane maps to ndc z = -1 ─────────────────────────────────────
{
  const near_ = 2, far_ = 50;
  const P = m4.perspective(Math.PI / 3, 1, near_, far_);
  // a point ON the near plane, in VIEW space, is (0, 0, -near) (camera looks down -z).
  const clip = m4.transformPoint(P, [0, 0, -near_]);
  const ndcZ = clip[2] / clip[3];
  near(ndcZ, -1, "perspective sends a point on the near plane to ndc z = -1", 1e-9);
}

// ── m4.perspective: the far plane maps to ndc z = +1 ──────────────────────────────────────
{
  const near_ = 1, far_ = 20;
  const P = m4.perspective(Math.PI / 3, 1, near_, far_);
  const clip = m4.transformPoint(P, [0, 0, -far_]);
  const ndcZ = clip[2] / clip[3];
  near(ndcZ, 1, "perspective sends a point on the far plane to ndc z = +1", 1e-9);
}

// ── m4.lookAt: orthonormal basis ───────────────────────────────────────────────────────────
{
  const V = m4.lookAt([3, 4, 5], [0, 0, 0], [0, 1, 0]);
  // the view matrix's rotation part is [x | y | z] as COLUMNS in this column-major layout: column c,
  // row r is V[c*4+r]. Extract the three basis row-vectors (x,y,z axes of the camera frame) as the
  // matrix's ROWS (since the rotation is orthonormal, rows and columns are both unit+orthogonal).
  const row = (r) => [V[0 * 4 + r], V[1 * 4 + r], V[2 * 4 + r]];
  const rx = row(0), ry = row(1), rz = row(2);
  near(v3.length(rx), 1, "lookAt basis row x is unit length");
  near(v3.length(ry), 1, "lookAt basis row y is unit length");
  near(v3.length(rz), 1, "lookAt basis row z is unit length");
  near(v3.dot(rx, ry), 0, "lookAt basis rows x,y are orthogonal");
  near(v3.dot(ry, rz), 0, "lookAt basis rows y,z are orthogonal");
  near(v3.dot(rx, rz), 0, "lookAt basis rows x,z are orthogonal");
}

// ── m4.lookAt: the eye transforms to the view-space origin ────────────────────────────────
{
  const eye = [3, 4, 5];
  const V = m4.lookAt(eye, [0, 0, 0], [0, 1, 0]);
  const viewEye = m4.transformPoint(V, eye);
  near(viewEye[0], 0, "lookAt maps the eye's own position to view-space x=0");
  near(viewEye[1], 0, "lookAt maps the eye's own position to view-space y=0");
  near(viewEye[2], 0, "lookAt maps the eye's own position to view-space z=0");
}

// ── m4.transformPoint: matches hand computation for identity ─────────────────────────────
eq(m4.transformPoint(m4.identity(), [7, 8, 9]), [7, 8, 9, 1], "transformPoint(identity, p) = [p, w=1]");

done("prove-math");
