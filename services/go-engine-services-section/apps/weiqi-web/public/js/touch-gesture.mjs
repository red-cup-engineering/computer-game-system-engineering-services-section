// TouchGestureController: the touch input state machine (task item 2,
// TOUCH DONE RIGHT). Pure and DOM-free by design -- it knows nothing about
// pixels, SVG, or pointer events; a caller (board.mjs) feeds it
// already-resolved board coordinates and gets back a small action
// descriptor to render. That separation is what makes the state machine
// itself directly unit-testable (see test/touch-gesture.test.mts) without
// a browser, jsdom, or any DOM event synthesis.
//
// Two modes, matching the brief exactly:
//
//   "drag" (default) -- the misclick fix from the teardown's #5 headline
//   finding: press and drag a finger across the board; a magnified ghost
//   preview follows (rendered by board.mjs, offset above the finger so it
//   isn't hidden under the fingertip); release *inside* the board commits
//   the move at the nearest intersection, release outside (or a
//   pointercancel, e.g. an incoming phone call) cancels with no move
//   played. No accidental taps: nothing commits without a deliberate
//   press-drag-release across the board surface.
//
//   "confirm" -- the explicit toggle for the cautious (per the task):
//   the app's original tap-then-confirm model, now with a real cancel
//   action (previously "tap elsewhere" was the only way out; `cancel()`
//   below is an explicit affordance board.mjs wires to a visible Cancel
//   control, not just an implicit side effect of tapping around).
//
// States: "idle" | "previewing" (confirm mode only) | "dragging" (drag
// mode only). Actions returned by every method: { type, coord } where
// type is one of "none" | "preview" | "drag-start" | "drag-move" |
// "drag-move-outside" | "commit" | "cancel".

export const MODE_DRAG = "drag";
export const MODE_CONFIRM = "confirm";

export class TouchGestureController {
  #mode;
  #state = "idle";
  #pendingCoord = null;

  constructor({ mode = MODE_DRAG } = {}) {
    this.#mode = mode === MODE_CONFIRM ? MODE_CONFIRM : MODE_DRAG;
  }

  get mode() {
    return this.#mode;
  }

  /** Switching modes mid-gesture abandons whatever gesture was in
   * progress -- never leaves a stale pending point armed under the new
   * mode's different rules. */
  setMode(mode) {
    this.#mode = mode === MODE_CONFIRM ? MODE_CONFIRM : MODE_DRAG;
    this.#state = "idle";
    this.#pendingCoord = null;
  }

  get state() {
    return this.#state;
  }

  get pendingCoord() {
    return this.#pendingCoord;
  }

  /** A finger touches down. `coord` is the nearest board intersection (or
   * null if the touch landed outside the board); `insideBoard` is
   * whether that touch point is within the board surface at all. */
  pointerDown(coord, { insideBoard = true } = {}) {
    if (this.#mode === MODE_CONFIRM) {
      if (this.#state === "previewing" && coord !== null && coord === this.#pendingCoord) {
        this.#state = "idle";
        const committed = this.#pendingCoord;
        this.#pendingCoord = null;
        return { type: "commit", coord: committed };
      }
      if (!insideBoard || coord === null) return { type: "none", coord: null };
      this.#state = "previewing";
      this.#pendingCoord = coord;
      return { type: "preview", coord };
    }

    // drag mode
    if (!insideBoard || coord === null) return { type: "none", coord: null };
    this.#state = "dragging";
    this.#pendingCoord = coord;
    return { type: "drag-start", coord };
  }

  /** The finger moves while still down. Confirm mode ignores movement
   * entirely (it is a tap model, not a drag model) -- only drag mode
   * tracks it, updating the magnified preview each call. */
  pointerMove(coord, { insideBoard = true } = {}) {
    if (this.#mode !== MODE_DRAG || this.#state !== "dragging") return { type: "none", coord: null };
    if (!insideBoard || coord === null) {
      this.#pendingCoord = null;
      return { type: "drag-move-outside", coord: null };
    }
    this.#pendingCoord = coord;
    return { type: "drag-move", coord };
  }

  /** The finger lifts. Confirm mode never commits on release (only on the
   * matching second tap, via pointerDown above) -- this is a no-op there.
   * Drag mode commits exactly when the release point is inside the board;
   * releasing outside cancels the gesture with no move played, which is
   * the actual fix for the "fat-finger misclick" complaint: an overshoot
   * or a changed mind costs nothing. */
  pointerUp(coord, { insideBoard = true } = {}) {
    if (this.#mode !== MODE_DRAG || this.#state !== "dragging") return { type: "none", coord: null };
    this.#state = "idle";
    this.#pendingCoord = null;
    if (insideBoard && coord !== null) return { type: "commit", coord };
    return { type: "cancel", coord: null };
  }

  /** Explicit cancel -- the board's visible Cancel control in confirm
   * mode, or a pointercancel (e.g. the OS interrupting the gesture) in
   * either mode. Always returns to idle with nothing pending. */
  cancel() {
    const wasActive = this.#state !== "idle";
    this.#state = "idle";
    this.#pendingCoord = null;
    return { type: wasActive ? "cancel" : "none", coord: null };
  }
}
