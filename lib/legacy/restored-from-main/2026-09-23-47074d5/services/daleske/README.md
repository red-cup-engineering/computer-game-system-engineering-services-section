# @red-cup-engineering/daleske

A PIXEL terminal framework over pure Node (builtins only, plus `@561-group/computer`) — the raster
analogue of `@red-cup-engineering/arnold` (the cell terminal). daleske renders a settled section as
a raster scene over the kitty graphics protocol or sixel, capability-detected with a graceful text
fallback. It sits above `@561-group/computer` (the EAVT substrate); `computer` never depends on it.

## Install / run

```sh
npm install
npm test                                # node --test tests/prove-*.mjs
npm run demo                            # project a settled section as a pixel scene over kitty/sixel
npm run demo -- --pattern               # a color test pattern instead
DALESKE_ENCODER=sixel npm run demo      # force an encoder (capture its bytes through a pipe)
```

## What it is

A pixel-raster terminal toolkit, plus one seam that ties it to `@561-group/computer`: a **projector**
from a settled paraconsistent section to a renderable PIXEL frame. Where arnold holds a grid of
`{ ch, style }` cells and diffs cell-by-cell, daleske holds a grid of RGBA pixels and diffs by tile.

- **framebuffer** — an RGBA raster with a tile diff: the raster is partitioned into fixed tiles, and
  the diff reports which tiles changed, so a re-projection only re-transmits the tiles that moved (a
  graphics image is the unit of transfer — you cannot economically re-send one pixel).
- **kitty / sixel** — two raster encoders. kitty (32-bit RGBA, base64, chunked APC sequences) is
  preferred; sixel (palette-quantized, run-length-encoded DCS) is the graceful fallback. Each module
  knows only its own byte grammar.
- **capability** — detects `kitty | sixel | none` from the environment, with `none` meaning a text
  fallback.
- **blit** — turns a framebuffer diff into the minimal set of encoder image transmissions, placed at
  the cursor cell.
- **input** — raw-mode keyboard input: a pure key decoder (`parseKey`) wired to raw stdin.
- **screen** — `PixelScreen`, the composition root and the only raster writer.

## The projector seam

`project(section)` maps a `@561-group/computer` settled section `{ affirmed, denied, contradicted }`
to a `Framebuffer` of colored bands, one per predication. It renders all four values and never
silently picks a winner:

- **t** (affirmed) → a solid green band.
- **f** (denied) → a solid red band — denied is not blank; it's a painted counter-belief.
- **⊤** (contradicted) → the band is split: affirmed-green on the left, denied-red on the right, a
  yellow seam between. Both faces are painted; the raster never drops one face of a contradiction.
- **⊥** (pending) → a dim grey band (known-absent, shown faintly, not dropped).

`projectFiber(foldOutput)` does the same from a raw fold, surfacing the ⊥ cells that `section()`
omits.

`src/projector.mjs` depends on nothing in daleske's I/O (no blit, no encoder, no `node:tty`) — it
takes a section and returns a `Framebuffer` plus a plain `rows` descriptor, so it could later be
promoted into `computer/` as the pixel terminal projector (the pixel sibling of arnold's cell
projector and of `shp`, the HTML projector).

## Modules (import by subpath)

| subpath | what |
| --- | --- |
| `@red-cup-engineering/daleske/framebuffer` | the RGBA raster + `diff(prev, next)` (the changed-tile list) |
| `@red-cup-engineering/daleske/kitty` | the kitty graphics protocol encoder |
| `@red-cup-engineering/daleske/sixel` | the sixel format encoder (palette + RLE) |
| `@red-cup-engineering/daleske/capability` | `detectFromEnv` / `probe` — which encoder is available |
| `@red-cup-engineering/daleske/blit` | the diff → minimal graphics-protocol transmissions |
| `@red-cup-engineering/daleske/projector` | `project(section)` / `projectFiber(folded)` → pixel frame |
| `@red-cup-engineering/daleske/input` | `parseKey` (pure) + `Keyboard` (raw-mode event loop) |
| `@red-cup-engineering/daleske/screen` | `PixelScreen` (terminal lifecycle + diffed blit) |
| `@red-cup-engineering/daleske` | a barrel re-exporting the above |

Every subpath ships a hand-written `.d.ts` alongside its `.mjs`, referenced from `package.json`'s
`exports` map under the `types` condition.

## Known limitation

`PixelScreen` and `blit` assume one terminal cell is 8×16 pixels (`CELL_W`/`CELL_H` in
`src/screen.mjs`) to place a raster tile at a cursor cell. This is a hardcoded assumption, not
measured from the actual terminal font. A real cell-size probe (e.g. a kitty/sixel geometry query)
is future work.

## Demo

[`scripts/daleske.mjs`](scripts/daleske.mjs) folds a trace through `@561-group/computer`'s substrate (a door
whose location is contradicted — told both `located-in hall` and its converse), projects the settled
section to a raster via the projector seam, detects the terminal's raster capability, and blits the
frame.

```sh
node scripts/daleske.mjs                     # auto-detect: kitty, sixel, or text fallback
node scripts/daleske.mjs --pattern           # a horizontal RGB gradient test pattern, no section
DALESKE_ENCODER=sixel node scripts/daleske.mjs > out.sixel   # force sixel, capture bytes through a pipe
DALESKE_ENCODER=kitty node scripts/daleske.mjs > out.kitty   # force kitty, capture bytes through a pipe
```

A text caption always prints first, naming the encoder chosen and listing each band; the raster
bytes follow when an encoder is active. `DALESKE_ENCODER` is honored even when stdout is piped
(unlike auto-detection, which requires a live TTY), so a demo run's bytes can be captured and
inspected.

## Tests

```sh
npm test
```

Runs via Node's own test runner (`node --test tests/prove-*.mjs`); each `prove-*.mjs` is a
self-contained assertion script (its own zero-dependency harness in `tests/_harness.mjs`) that
`node --test` executes as one suite:

- `prove-framebuffer` — pixel set/get, clipped fillRect/blit, and the tile diff.
- `prove-kitty` — the APC escape grammar, base64 chunking at the 4096-char boundary.
- `prove-sixel` — the DCS escape grammar, palette quantization, run-length encoding.
- `prove-capability` — env-based encoder detection, the TTY gate, the `DALESKE_ENCODER` override.
- `prove-projector` — the contested band splits into both faces with no winner picked, checked
  against both a hand-built section and a real settled section folded by `@561-group/computer`.
- `prove-sixel-stream` — spawns `scripts/daleske.mjs --pattern` as a child process with
  `DALESKE_ENCODER=sixel` and stdout piped, decodes the sixel envelope with a small hand-written
  parser, and checks the recovered width/height match the 256×96 pattern image.

## Boundary

daleske is userspace, not part of `@561-group/computer` proper. The framebuffer, encoders, and input
are the app-side framework; `project`/`projectFiber` are the one seam into the substrate. Keeping
that seam clean is what would let it be promoted into `computer/` later.
