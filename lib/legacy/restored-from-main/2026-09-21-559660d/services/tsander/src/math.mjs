// math — the rederived 3D vector/matrix kernel the wireframe renderer needs, pure and self-contained.
// This package derives ALL knowledge from the ground up; nothing here imports a 3D library and nothing
// is assumed about "how 3D graphics works" from outside. A vector is a 3-tuple of numbers; a matrix is
// a 16-number column-major 4×4; the transforms are stated by their algebra and PROVEN by identities in
// tests/math.test.mjs (matrix·inverse = I, perspective sends the near plane to ndc z=-1, lookAt is
// orthonormal). The renderer is only trustworthy because these identities hold.
//
// Style follows aletheon's vec3/mat4 (out-param + create), but kept to exactly what the wireframe
// projector uses: build a view·perspective matrix, transform a model-space vertex to clip space, and
// the few vector ops the camera needs. Deterministic — no Date.now, no Math.random — so a frame is
// replay-identical, the same law event-projection holds.

// ── vec3 ────────────────────────────────────────────────────────────────────────────────────
export const v3 = {
  create: (x = 0, y = 0, z = 0) => [x, y, z],
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  length: (a) => Math.hypot(a[0], a[1], a[2]),
  normalize: (a) => {
    const len = Math.hypot(a[0], a[1], a[2]);
    return len === 0 ? [0, 0, 0] : [a[0] / len, a[1] / len, a[2] / len];
  },
};

// ── mat4 (column-major, the column m[c*4+r] convention so multiply composes left-to-right) ────
export const m4 = {
  identity: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],

  // multiply(a, b) — the matrix product a·b (column-major).
  multiply: (a, b) => {
    const out = new Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        out[c * 4 + r] = s;
      }
    }
    return out;
  },

  // perspective(fovy, aspect, near, far) — the standard symmetric perspective frustum, mapping the
  // frustum into the [-1,1]³ clip cube. A point on the near plane (view z = -near) lands at ndc z=-1.
  perspective: (fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return [
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ];
  },

  // lookAt(eye, center, up) — a view matrix placing the camera at `eye` looking at `center`. The
  // result is orthonormal (it is a rotation+translation), so its rows are a right-handed frame.
  lookAt: (eye, center, up) => {
    const z = v3.normalize(v3.sub(eye, center)); // camera looks down -z, so forward = eye-center
    const x = v3.normalize(v3.cross(up, z));
    const y = v3.cross(z, x);
    return [
      x[0], y[0], z[0], 0,
      x[1], y[1], z[1], 0,
      x[2], y[2], z[2], 0,
      -v3.dot(x, eye), -v3.dot(y, eye), -v3.dot(z, eye), 1,
    ];
  },

  // transformPoint(m, p) — apply m to a 3D point (w=1), returning the 4-tuple [x,y,z,w] in m's output
  // space (clip space for a view·perspective matrix). The caller divides by w to reach ndc.
  transformPoint: (m, p) => {
    const [x, y, z] = p;
    return [
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
      m[3] * x + m[7] * y + m[11] * z + m[15],
    ];
  },
};
