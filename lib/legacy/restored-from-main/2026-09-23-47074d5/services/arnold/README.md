# @red-cup-engineering/arnold

A generic, composable **TUI framework** over pure Node (builtins only, no
runtime dependencies). arnold lights up a **settled section** in the
terminal — the terminal analogue of `shp`, the HTML projector in
[`@561-group/computer`](http://127.0.0.1:4873/@561-group/computer). It sits
above `computer` (the EAVT substrate); `computer` never depends on it.

```sh
npm test            # node --test tests/prove-*.mjs
npm run demo        # in a TTY: interactive settled-section browser (q to quit)
                     # piped / --headless: composes a scene and prints the diffed output
```

## What it is

A terminal-UI toolkit, plus the one boundary that makes it part of this
computer: a **projector** from a settled paraconsistent section to a
renderable terminal frame.

- A **screen / cell buffer** with a **diffed render** — only the cells that
  actually changed reach the terminal.
- **Box / flex layout** — pure `Rect` arithmetic (fixed + grow tracks, gaps,
  inset, center).
- **Core widgets** — text (wrap/align), list (selectable + scrolling, paired
  with the pure `selectInList` navigation reducer), table (aligned columns),
  input (an editable line + a pure edit reducer), a scrollable
  `textViewport` (paired with the pure `scrollViewport` reducer), status
  line.
- **A focus ring** (`src/focus.mjs`) — a pure `{ names, index }` state
  machine (`nextFocus`/`prevFocus`/`currentFocus`) for apps with more than
  one navigable widget sharing the keyboard (a list plus a filter input, a
  list plus a detail pane), plus a stateful `focusRing()` convenience
  wrapper over the same pure core.
- **Raw-mode keyboard input + an event loop** — a pure key decoder
  (`parseKey`) wired to raw stdin, with a chunk splitter so an arrow press
  stays one key while typed text streams.
- **ANSI styling** — the only module that knows the escape grammar; styles
  are data, so the diff reasons about the pen structurally.

The display loop is: **read → settle → project → loop**, where `project` is
the view plus the diff.

## The projector seam

[`src/projector.mjs`](src/projector.mjs) is a **pure** function

```js
project(settledSection) -> terminal frame
```

mapping a `@561-group/computer` settled section `{ affirmed, denied,
contradicted }` (the output of `section(fold(...))`) to a frame of styled
rows. It depends on nothing else in arnold (no buffer, no widgets, no I/O),
so it can be promoted later into `computer/` as the terminal projector, the
way `shp` is the HTML projector. Until then it lives here, app-side; arnold's
widgets only draw the frame it returns.

The four values render honestly:

| value | glyph | rendered as |
|---|---|---|
| t — affirmed | `t` | asserted |
| f — denied | `f` | denied-NOT-absent (a counter-statement: `NOT …`), never silently dropped |
| ⊤ — contradicted | `⊤` | CONTESTED: both sides shown (`… ✗⊢ NOT …`) with both witnesses surfaced |
| ⊥ — pending | `⊥` | pending / unknown (`… ?`), known-absent, not dropped |

A `⊤` cell leads the frame (most salient) and carries both faces' witnesses
so any row can be asked "why?". `section()` omits `⊥` (it carries no
evidence); `projectFiber(folded)` recovers `⊥` directly from the fold's
charge bits when a caller wants pending cells shown.

## Modules (import by subpath)

| subpath | what |
| --- | --- |
| `@red-cup-engineering/arnold/projector` | the seam — `project(section)` / `projectFiber(folded)` → frame |
| `@red-cup-engineering/arnold/buffer` | the cell grid + `diff(prev, next)` (the changed-cell list) |
| `@red-cup-engineering/arnold/render` | the diff → minimal escape stream |
| `@red-cup-engineering/arnold/layout` | `rect` / `flex` / `stack` / `inset` / `center` |
| `@red-cup-engineering/arnold/widgets` | box, text, list + `selectInList`, table, input, `textViewport` + `scrollViewport`, statusLine |
| `@red-cup-engineering/arnold/focus` | `focusRing` / `nextFocus` / `prevFocus` / `currentFocus` — a pure focus-ring state machine |
| `@red-cup-engineering/arnold/input` | `parseKey` (pure) + `Keyboard` (raw-mode event loop) |
| `@red-cup-engineering/arnold/ansi` | the escape-code alphabet + `sgr` styling |
| `@red-cup-engineering/arnold/app` | `Screen` (terminal lifecycle + diffed paint) + `run` |
| `@red-cup-engineering/arnold` | a barrel re-exporting the above |

Every subpath ships a hand-written `.d.ts` alongside its `.mjs` (see
`src/*.d.ts`), referenced from `package.json`'s `exports` map (`types`
condition).

## Demo

[`scripts/arnold.mjs`](scripts/arnold.mjs) is the entrypoint and branches on whether
stdout is a TTY:

- **interactive** (a real terminal): delegates to
  [`scripts/lantern.mjs`](scripts/lantern.mjs), which builds a small append-only EAVT
  trace with a genuine contradiction (a claim and its converse), settles it
  with `@561-group/computer`'s substrate, projects the settled section to a
  frame, and renders it. Keys: `↑`/`↓` move, `w` toggles the witness ("why?")
  panel, `t` cycles the subject, `q` quits.
- **headless** (piped stdout, or `--headless`): composes a TUI scene (a
  bordered box, a 4-item list, a status line) into a `Buffer`, diffs it
  against `null` (a full first paint), then moves the list selection by one
  row, builds a second scene, and diffs that against the first. It prints
  both diffs' cell counts, the escape-stream byte lengths, and the resulting
  text grids.

## Tests

```sh
npm test
```

Runs via Node's own test runner (`node --test tests/prove-*.mjs`); each
`prove-*.mjs` is a self-contained assertion script (its own zero-dependency
harness in `tests/_harness.mjs`) that `node --test` executes as one
test-file-per-suite:

- `prove-buffer` — drawing, and the diff reports exactly the changed cells.
- `prove-render` — the diffed render emits a minimal escape stream
  (positions/pen only when needed).
- `prove-layout` — flex divides space; tracks sum exactly to the container.
- `prove-input` — the pure key decoder and chunk splitter.
- `prove-widgets` — box/text/list/table/input/statusLine draw correctly.
- `prove-viewport` — `selectInList`/`scrollViewport` as pure reducers (the
  same shape as `editInput`), and `textViewport` proven by inspecting its
  exact drawn cells.
- `prove-focus` — focus traversal as a pure `{ names, index }` state
  machine: wraps at both ends, never mutates its input, and `focusRing()`'s
  stateful call sequence matches hand-threading the pure functions.
- `prove-compose` — a composed two-pane fixture (a list pane + a
  `textViewport` detail pane, split by `flex`) renders to EXACT expected
  cell grids, and the diff between two frames (after a selection move + a
  scroll) is asserted cell-for-cell, not just checked non-empty.
- `prove-projector` — the four-value law: `⊤` shown contested (both sides +
  both witnesses), proven against a real settled section folded by
  `@561-group/computer`.

## Boundary

arnold is userspace, not part of `@561-group/computer` proper. The widgets,
layout, and input are the app-side framework; the section → frame projection
is the projector. Keeping that seam clean is what lets it be promoted into
`computer/` later, the way `shp` is the HTML projector.
