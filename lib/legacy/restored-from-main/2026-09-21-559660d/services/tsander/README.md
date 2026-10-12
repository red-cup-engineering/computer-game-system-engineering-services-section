# @red-cup-engineering/tsander

The game engine on [`@red-cup-engineering/arnold`](http://127.0.0.1:4873/@red-cup-engineering/arnold):
terminal/wireframe games.

```sh
npm test            # node --test tests/prove-*.mjs
npm run demo        # in a TTY: an interactive orbiting cockpit, q to quit
                     # piped / --headless: prints 6 rendered wireframe frames as text
```

## Three engine-level concerns

1. **The WORLD substrate** (`src/world.mjs`) — a "place" is a subject whose state is the fold of
   every predication filed about it: unvisited = ⊥, disagreement = ⊤ HELD with both witnesses.
   The world is single-source: one append-only `{ rows }` trace, folded with `fold`/`section`/
   `settle`/`relate`/`relateFrom` from `@561-group/computer/posix-holography/eavt-substrate`.
   Multi-writer federation (`federate`, `mergeWorlds`, `migrate`, per-observer `frontier`) is not
   implemented — `@561-group/computer` does not yet ship a federation module for this to build on.
2. **The WIREFRAME renderer** (`src/wireframe.mjs`) — 3D vectors projected to Arnold cells via a
   self-derived `vec3`/`mat4` kernel (`src/math.mjs`, no 3D library import) and Bresenham line
   rasterization. Charge **is** the render style: `t` draws solid (`#`), `⊥` draws dotted (`·`), `f`
   draws a collapsed wreck-stub (`x`), and `⊤` draws **twice**: the primary hull plus a second copy
   offset by a tick-phase-driven jitter (never `Math.random`, so replay-identical).
3. **The tick/realtime loop** (`src/engine.mjs`) — no global clock; `tick(state)` runs every unit's
   program, appends the resulting rows (append-only), advances the phase, and re-renders. `run(...)`
   is the only timer-bearing part; everything it calls is pure.

## The horsetail hook is live

A unit's flight-computer program runs through `@561-group/horsetail`, the paraconsistent settling
Lisp. This was stubbed until 2026-08-27, because the evaluator had been archived with the whole
`computer/` tree and never repopulated; it has since been recovered as its own package, and
`src/horsetail-hook.mjs` now calls it. The seam is unchanged — source string in,
`{charge, four, glyph, ok, error?}` out — exactly as the stub's header promised it would be.

`runProgram` still never throws, because the engine's tick loop calls it for every sourced unit on
every tick. A program that is absent, unreadable, or fails to settle reads `bot` with `ok: false` and
an explanatory `.error`. A program that settles to `⊤` is **not** an error: it reports `ok: true` with
`four: "top"`, and `branchOnCharge` runs both arms and holds them contested.

### Two behaviour changes the un-stubbing caused

While stubbed, *every* sourced unit read `⊥` and charged `computer-says scan`. Now programs really
settle, so:

- **A bare cell is a predication, not a call.** `(dock)` settles to `t`, so that unit charges
  `computer-says act` where it previously charged `scan`. The old proofs asserted the stub's blanket
  `⊥`; they now assert the language's actual reading.
- **`runUnit`'s `top:` arm is dead code.** It passes `branchOnCharge` a `top:` arm meant to charge a
  cell both ways (`computer-says act` + `not-computer-says act`), but `branchOnCharge` never calls
  `arms.top` — on `"top"` it calls `arms.t` and `arms.f` — so the real rows are `act` + `hold`. This
  was unreachable while `four` was always `bot`. Both readings are defensible ("dock AND flee" versus
  "the cell itself held contested"), so the proof asserts what the code does and the choice is left
  open rather than silently patched.

`world.mjs`'s federation descope is unrelated and still open: it cuts to single-writer worlds for want
of a federation module. That module is also recovered now, as `@561-group/horsetail/distribution`, so
that port is unblocked but not attempted here.

## The tsander → arnold contract

Not via arnold's `projector.mjs` seam (that seam is for a settled-section frame; tsander's frame is a
raster-grid glyph/charge pair, a different shape). The actual contract, in `scripts/tsander.mjs`:

```js
import { Screen } from "@red-cup-engineering/arnold/app";
import { EMPTY_STYLE } from "@red-cup-engineering/arnold/ansi";
// frame = { width, height, glyphs: string[width*height], charges: string[width*height], census, phase }
buf.clear();
for (r,c in frame bounds intersected with buf bounds) {
  if (frame.glyphs[i] === " ") continue;
  buf.set(r, c, frame.glyphs[i], CHARGE_STYLE[frame.charges[i]] ?? EMPTY_STYLE);
}
screen.render(draw); // arnold's Screen owns the diff+paint
```

`src/wireframe.mjs` produces a flat row-major `glyphs`/`charges` pair; the *consumer* (the bin) is
responsible for blitting it into an arnold `Buffer` and choosing a style table. `wireframe.mjs` is
not coupled to arnold's `Buffer` type directly.

## Modules (import by subpath)

| subpath | what |
| --- | --- |
| `@red-cup-engineering/tsander/world` | the single-source trace WORLD substrate |
| `@red-cup-engineering/tsander/wireframe` | the pure 3D → Arnold-cell renderer, charge-as-style |
| `@red-cup-engineering/tsander/horsetail` | the unit-program hook (live — see above) |
| `@red-cup-engineering/tsander/engine` | the tick/realtime loop |
| `@red-cup-engineering/tsander/math` | the rederived vec3/mat4 kernel |
| `@red-cup-engineering/tsander` | a barrel re-exporting the above |

Every subpath ships a hand-written `.d.ts` alongside its `.mjs` (see `src/*.d.ts`).

## Demo

[`scripts/tsander.mjs`](scripts/tsander.mjs) loads the shipped seed (`world/core-systems.jsonl`, a tiny
settled cluster with one genuinely contested star — `vega-prime`, told both `controlled-by
federation` and its converse) and sweeps a camera around it, projecting a wireframe frame each tick.

- **interactive** (a real terminal): Arnold's alt-screen cockpit, camera orbiting, `q` to quit. Watch
  `vega-prime` render doubled and shivering (the `%` glyph) while the settled stars stay clean.
- **headless** (piped stdout, or `--headless`): prints 6 rendered frames as plain text — a real
  rotating wireframe rendered headlessly to the cell grid, the bilattice readout visible directly in
  the printed glyphs (`#` for settled stars, `%%%%` doubled for the contested one).

## Tests

```sh
npm test
```

- `prove-math` — v3/m4 algebra; perspective sends the near plane to ndc z=-1 and the far plane to
  z=+1; lookAt produces an orthonormal basis and maps the eye to the view-space origin.
- `prove-world` — append-only dedup, unvisited = ⊥, a claim + its converse fold to ⊤ with both
  witnesses kept, functional `positionOf` reads latest-t, `renderables`/`disagreements` walk the
  whole world.
- `prove-wireframe` — charge-as-glyph, the ⊤ doubling draws more cells (not decorative), the jitter
  is phase-deterministic (same phase ⇒ identical frame; a 4-phase cycle), draw order keeps ⊤
  un-occluded.
- `prove-horsetail` — real settling (t / ⊥ / held ⊤, evidence accumulating across ticks) and
  `branchOnCharge`'s pure logic, including the ⊤-runs-both-arms feature.
- `prove-engine` — `tick` admits rows append-only and advances phase; `fly` sweeps a camera one tick
  per waypoint; `run` respects `ticks` and an early-stopping `onFrame`.
- `prove-cube-orientation` — a known camera (eye on the +z axis, 90° fov, chosen so the perspective
  divide reduces to fractions worked by hand) and a known unit cube, with every hand-derived edge
  cell asserted directly against `render()`'s actual glyph grid.
