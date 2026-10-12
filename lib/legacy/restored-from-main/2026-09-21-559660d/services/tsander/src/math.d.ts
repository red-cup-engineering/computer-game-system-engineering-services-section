// math.d.ts — hand-written types for src/math.mjs.

export type Vec3 = [number, number, number];
export type Mat4 = number[]; // length 16, column-major

export const v3: {
  create(x?: number, y?: number, z?: number): Vec3;
  add(a: Vec3, b: Vec3): Vec3;
  sub(a: Vec3, b: Vec3): Vec3;
  scale(a: Vec3, s: number): Vec3;
  dot(a: Vec3, b: Vec3): number;
  cross(a: Vec3, b: Vec3): Vec3;
  length(a: Vec3): number;
  normalize(a: Vec3): Vec3;
};

export const m4: {
  identity(): Mat4;
  multiply(a: Mat4, b: Mat4): Mat4;
  perspective(fovy: number, aspect: number, near: number, far: number): Mat4;
  lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4;
  transformPoint(m: Mat4, p: Vec3): [number, number, number, number];
};
