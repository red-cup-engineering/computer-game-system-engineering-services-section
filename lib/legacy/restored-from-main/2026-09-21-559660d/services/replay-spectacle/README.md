# replay-spectacle

Turns a game replay into one self-contained HTML page — no server, no CDN, nothing but a file a
person can open anywhere. The page never just prints a score a replay claims: it independently
recomputes the outcome from `(seed, move-log)` through a vendored copy of the real game engine and
renders exactly what that recomputation says.

Supports two games: **ruinfold** (a daily dungeon crawl) and **crucible** (a daily chord-tangle
puzzle).

## Layout

```
src/render-replay-page.mjs   renderReplayPage(gameAdapter, replayBundle) -> html string
                              domain-neutral core: verify() then project() then hand to TUFTE
adapters/ruinfold.mjs        verify()/project() for ruinfold-daily replays
adapters/crucible.mjs        verify()/project() for crucible daily-puzzle replays
adapters/vendor/ruinfold/    vendored, verbatim copy of ruinfold-daily's own src/engine/*.mts
adapters/vendor/crucible/    vendored, verbatim copy of crucible-service's own src/*.mts
scripts/replay-spectacle.mjs     CLI: replay-spectacle <ruinfold|crucible> <replay.json> > page.html
scripts/play-*.mjs           bots that play a daily through the real vendored engine, producing
                              genuine move logs (used to build fixtures/ and examples/)
scripts/generate-fixtures.mjs   regenerates every file under fixtures/ from scratch
fixtures/                    played replay bundles (plus two hand-built, labeled rejects)
examples/                    finished, rendered example pages
```

`ruinfold-daily` and `crucible-service` are both private, unpublished apps, so each adapter
carries its own verbatim, provenance-headed copy of just the engine code `verify()` needs to
recompute a replay from scratch, offline. Every vendored file names its real source path and
states plainly that it is a snapshot, not maintained here — re-sync by re-copying, never
hand-edit.

- **ruinfold** (`run.mts`): `replay(seed, log)`. The adapter derives the seed from
  `replayBundle.date` alone (`dailySeed(date)`) and never trusts `log.seed`.
- **crucible** (`replay.mts`): `replay(seed, moveLog)`. The adapter folds `applyMove` itself (to
  capture each move's cost/regime for display) and calls the vendored `replay()` independently,
  asserting the two agree.

`renderReplayPage` never passes TUFTE a `source`, `actionEndpoint`, or `clientScript` — the
rendered page has no fetch-driven seam, no live client, just static HTML and inline CSS.

## Using it

```js
import { renderReplayPage } from "@red-cup-engineering/replay-spectacle";
import ruinfoldAdapter from "@red-cup-engineering/replay-spectacle/ruinfold";

const html = renderReplayPage(ruinfoldAdapter, { date: "2026-08-19", log /* a RunLog */ });
```

```sh
replay-spectacle ruinfold  path/to/run.json      > page.html
replay-spectacle crucible  path/to/moveLog.json  > page.html
```

Regenerate the fixtures and example pages:

```sh
node scripts/generate-fixtures.mjs                       # replays -> fixtures/
node scripts/replay-spectacle.mjs ruinfold  fixtures/ruinfold/2026-08-19-daily.json      > examples/ruinfold-daily-2026-08-19.html
node scripts/replay-spectacle.mjs crucible  fixtures/crucible/2026-08-19-certified.json  > examples/crucible-daily-2026-08-19.html
```

## Tests

```sh
npm run check && npm test   # node --check over every source/vendored file, then node --test
npm test         # just the tests
```

Tests run against real fixtures produced by actually playing the vendored engines
(`scripts/play-*.mjs`), plus two hand-built, labeled bundles that exercise the rejection path.

## Dependencies

Zero external runtime dependencies beyond TUFTE (`@red-cup-engineering/web-page-tiling-engine`,
which does the document assembly) and `@lenticule-science/metrologic` (crucible's obstruction math).

## License

No `license` field is declared. Private (`"private": true`); not published to any registry.
