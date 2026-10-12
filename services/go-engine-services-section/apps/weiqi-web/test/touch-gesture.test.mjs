// Touch state machine unit tests (task requirement: "touch state machine
// unit tests"). TouchGestureController (public/js/touch-gesture.mjs) is
// pure and DOM-free by design specifically so this suite can drive it
// directly with synthetic coordinate/insideBoard sequences -- no browser,
// no jsdom, no pointer-event synthesis.
//
// Run with: node --test 'test/*.test.mts'

import { test } from "node:test";
import assert from "node:assert/strict";
import { TouchGestureController, MODE_DRAG, MODE_CONFIRM } from "../public/js/touch-gesture.mjs";

// --- Drag mode (default): the misclick fix ---------------------------------

test("drag mode: press-drag-release inside the board commits at the release point", () => {
  const c = new TouchGestureController({ mode: MODE_DRAG });
  assert.equal(c.state, "idle");

  let action = c.pointerDown("D4", { insideBoard: true });
  assert.deepEqual(action, { type: "drag-start", coord: "D4" });
  assert.equal(c.state, "dragging");
  assert.equal(c.pendingCoord, "D4");

  action = c.pointerMove("D5", { insideBoard: true });
  assert.deepEqual(action, { type: "drag-move", coord: "D5" });
  assert.equal(c.pendingCoord, "D5");

  action = c.pointerUp("D5", { insideBoard: true });
  assert.deepEqual(action, { type: "commit", coord: "D5" });
  assert.equal(c.state, "idle");
  assert.equal(c.pendingCoord, null);
});

test("drag mode: releasing outside the board cancels -- no move committed (the actual fat-finger fix)", () => {
  const c = new TouchGestureController({ mode: MODE_DRAG });
  c.pointerDown("C3", { insideBoard: true });
  c.pointerMove(null, { insideBoard: false });
  const action = c.pointerUp(null, { insideBoard: false });
  assert.deepEqual(action, { type: "cancel", coord: null });
  assert.equal(c.state, "idle");
  assert.equal(c.pendingCoord, null);
});

test("drag mode: moving outside the board mid-drag clears the pending point but stays dragging", () => {
  const c = new TouchGestureController({ mode: MODE_DRAG });
  c.pointerDown("C3", { insideBoard: true });
  const action = c.pointerMove(null, { insideBoard: false });
  assert.deepEqual(action, { type: "drag-move-outside", coord: null });
  assert.equal(c.state, "dragging");
  assert.equal(c.pendingCoord, null);
});

test("drag mode: re-entering the board after overshoot resumes tracking and can still commit", () => {
  const c = new TouchGestureController({ mode: MODE_DRAG });
  c.pointerDown("C3", { insideBoard: true });
  c.pointerMove(null, { insideBoard: false });
  c.pointerMove("C4", { insideBoard: true });
  assert.equal(c.pendingCoord, "C4");
  const action = c.pointerUp("C4", { insideBoard: true });
  assert.deepEqual(action, { type: "commit", coord: "C4" });
});

test("drag mode: a pointerdown outside the board never starts a drag", () => {
  const c = new TouchGestureController({ mode: MODE_DRAG });
  const action = c.pointerDown(null, { insideBoard: false });
  assert.deepEqual(action, { type: "none", coord: null });
  assert.equal(c.state, "idle");
});

test("drag mode: pointercancel mid-drag cancels and clears pending state", () => {
  const c = new TouchGestureController({ mode: MODE_DRAG });
  c.pointerDown("E5", { insideBoard: true });
  const action = c.cancel();
  assert.deepEqual(action, { type: "cancel", coord: null });
  assert.equal(c.state, "idle");
  assert.equal(c.pendingCoord, null);
});

test("drag mode: cancel() while idle is a no-op action (does not report a phantom cancel)", () => {
  const c = new TouchGestureController({ mode: MODE_DRAG });
  const action = c.cancel();
  assert.deepEqual(action, { type: "none", coord: null });
});

test("drag mode: pointerMove/pointerUp while idle (no active drag) are no-ops", () => {
  const c = new TouchGestureController({ mode: MODE_DRAG });
  assert.deepEqual(c.pointerMove("A1", { insideBoard: true }), { type: "none", coord: null });
  assert.deepEqual(c.pointerUp("A1", { insideBoard: true }), { type: "none", coord: null });
  assert.equal(c.state, "idle");
});

// --- Confirm mode: tap-then-confirm, now with an explicit cancel -----------

test("confirm mode: first tap previews, matching second tap commits", () => {
  const c = new TouchGestureController({ mode: MODE_CONFIRM });
  let action = c.pointerDown("F6", { insideBoard: true });
  assert.deepEqual(action, { type: "preview", coord: "F6" });
  assert.equal(c.state, "previewing");

  action = c.pointerDown("F6", { insideBoard: true });
  assert.deepEqual(action, { type: "commit", coord: "F6" });
  assert.equal(c.state, "idle");
  assert.equal(c.pendingCoord, null);
});

test("confirm mode: tapping a different point moves the preview instead of committing", () => {
  const c = new TouchGestureController({ mode: MODE_CONFIRM });
  c.pointerDown("F6", { insideBoard: true });
  const action = c.pointerDown("G7", { insideBoard: true });
  assert.deepEqual(action, { type: "preview", coord: "G7" });
  assert.equal(c.pendingCoord, "G7");
  assert.equal(c.state, "previewing");
});

test("confirm mode: explicit cancel() clears a pending preview with no move played", () => {
  const c = new TouchGestureController({ mode: MODE_CONFIRM });
  c.pointerDown("H8", { insideBoard: true });
  const action = c.cancel();
  assert.deepEqual(action, { type: "cancel", coord: null });
  assert.equal(c.state, "idle");
  assert.equal(c.pendingCoord, null);
});

test("confirm mode: pointerMove and pointerUp are both ignored (tap-driven, not drag-driven)", () => {
  const c = new TouchGestureController({ mode: MODE_CONFIRM });
  c.pointerDown("F6", { insideBoard: true });
  assert.deepEqual(c.pointerMove("G7", { insideBoard: true }), { type: "none", coord: null });
  assert.deepEqual(c.pointerUp("F6", { insideBoard: true }), { type: "none", coord: null });
  // still previewing F6 -- neither call disturbed the pending state
  assert.equal(c.state, "previewing");
  assert.equal(c.pendingCoord, "F6");
});

test("confirm mode: a tap outside the board while nothing is pending does nothing", () => {
  const c = new TouchGestureController({ mode: MODE_CONFIRM });
  const action = c.pointerDown(null, { insideBoard: false });
  assert.deepEqual(action, { type: "none", coord: null });
  assert.equal(c.state, "idle");
});

// --- Mode switching ----------------------------------------------------

test("setMode abandons any in-progress gesture and resets to idle", () => {
  const c = new TouchGestureController({ mode: MODE_CONFIRM });
  c.pointerDown("F6", { insideBoard: true });
  assert.equal(c.state, "previewing");
  c.setMode(MODE_DRAG);
  assert.equal(c.state, "idle");
  assert.equal(c.pendingCoord, null);
  assert.equal(c.mode, MODE_DRAG);
});

test("default mode is drag when unspecified", () => {
  const c = new TouchGestureController();
  assert.equal(c.mode, MODE_DRAG);
});

test("an unrecognized mode string falls back to drag, not an invalid internal state", () => {
  const c = new TouchGestureController({ mode: "bogus" });
  assert.equal(c.mode, MODE_DRAG);
});
