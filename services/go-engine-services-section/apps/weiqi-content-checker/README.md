# weiqi-lsp

`@lenticule-science/weiqi-lsp` checks that every Go-checkable claim
`weiqi-services-section`'s own content and app data make actually agrees
with what `@red-cup-engineering/weiqi-engine` computes: a diagram's stone
count, an `expected:` block's recomputed score, a capture/legality
assertion, an SGF block's legal replay, a markdown link's resolution, a
frontmatter field's presence, a tsumego problem's solvability, a lesson's
board-step legality. It never decides what is *true* about weiqi — the
kernel does that — it only checks that what this section *says* agrees
with what the kernel *computes*, and reports precisely where it does not.
It never modifies a file.

Two transport faces around one shared verification core (`src/run.mjs`):
a one-shot CLI (`scripts/check.mjs`) and a long-lived LSP server over stdio
(`scripts/server.mjs`).

The full rule catalog and CLI/LSP wire contract is [`SPEC.md`](./SPEC.md).

## Running

```
cd apps/weiqi-lsp
node --test 'test/*.test.mjs'
node scripts/check.mjs                       # check the whole section, human-readable
node scripts/check.mjs --json                # machine-readable
node scripts/check.mjs --only=WQ001,WQ010    # restrict to specific rule codes
node scripts/check.mjs --severity-min=error  # filter what's reported (exit code is unaffected)
node scripts/check.mjs --quiet               # summary line only
node scripts/check.mjs --kernel-path=<path>  # pin against a specific kernel checkout
node scripts/server.mjs                      # LSP server over stdio
```

Exit codes: `0` no error-severity diagnostics, `1` at least one, `2` the
tool itself could not complete a conclusive run (kernel import failed, a
glob matched zero files, a targeted JSON file did not parse, or a CLI
argument was invalid).

Plain ESM (`.mjs`, no build step), Node 24+, two exact-pinned house
dependencies: the rules engine `@red-cup-engineering/weiqi-engine` (the
kernel; formerly this section's own `apps/weiqi-kernel`, since seated in the
engineering tree and consumed by registry name) and
`@red-cup-engineering/markdown-engineering-services-section/read-markdown-frontmatter`. The engine is
reached through one chokepoint, `src/kernel.mjs`'s `DEFAULT_KERNEL_PATH`
(the installed package's public entry point); `--kernel-path` overrides it
for pinning a specific checkout in tests. The engine is never modified.

## What it checks

Six rule families, each cross-checking real content against the kernel:

- **(a) Diagram parse and position legality** — WQ001–005: a fenced
  diagram's shape, symbols, column header, and zero-liberty groups.
- **(b) Diagram-vs-`expected:` consistency** — WQ003, WQ010–014, WQ019:
  stone counts, territory/area scores, margin strings, capture/legality
  claims, and ruleset identifiers, all recomputed against the kernel.
  `status:` claims (`seki`/`dead`) are reported not-verified by design —
  neither this package nor the kernel is a life-and-death solver.
- **(c) SGF blocks** — WQ020–024: parse, main-line replay legality, a
  declared ruleset, and round-trip fidelity.
- **(d) Markdown links and `termRef` resolution** — WQ030–032: relative
  links, this section's own site-rooted glossary paths, and the kernel's
  `TERM_PATH` table.
- **(e) Frontmatter conformance by `type`** — WQ040–044: required fields,
  `defines:`/`teaches:` lists, `requires:`/`uses-mechanic:` resolution,
  and inline `[@key]` citations against a `references:` map.
- **(f) App-data validation** — WQ050–054: schema and legality checks for
  `tsumego.json` and `lessons.json`, read-only.

## File tree

```
apps/weiqi-lsp/
  SPEC.md                    rule catalog and CLI/LSP contract
  README.md
  package.json
  bin/
    check.mjs                CLI entry point
    server.mjs                LSP entry point (stdio, Content-Length JSON-RPC)
  src/
    diagnostic.mjs             the one Diagnostic record shape + filters
    kernel.mjs                   the single relative-import chokepoint to the kernel
    markdown.mjs                  fenced-code-block extraction
    diagram.mjs                    Family (a): WQ001-005 + WQ004's zero-liberty check
    expected-block.mjs              Family (b): WQ010-014, WQ019, and WQ003
    sgf-check.mjs                    Family (c): WQ020-024
    links.mjs                         Family (d): WQ030-032
    frontmatter.mjs                     domain checks over the shared Markdown/YAML reader
    frontmatter.mjs                       Family (e): WQ040-044
    app-data.mjs                            Family (f): WQ050-054
    glob.mjs                                  zero-dep glob expansion (**, *)
    run.mjs                                     shared verification core both transports call
  test/
    diagnostic.test.mjs, kernel.test.mjs, markdown.test.mjs, glob.test.mjs,
    diagram.test.mjs, expected-block.test.mjs, sgf-check.test.mjs,
    links.test.mjs, frontmatter-yaml.test.mjs, frontmatter.test.mjs,
    app-data.test.mjs              per-module unit tests, one file per src/ module
    regression-corpus.test.mjs     integration test against the live corpus
    kernel-conformance.test.mjs    this package's diagram-derived numbers, cross-checked
                                      against independent, direct kernel calls
    determinism.test.mjs           repeated runs, field-shape checks
    cli.test.mjs                   spawns the real scripts/check.mjs, real argv, real exit codes
    lsp.test.mjs                   spawns the real scripts/server.mjs, real Content-Length JSON-RPC frames
```

## Deviations from SPEC.md's literal text

- WQ005: SPEC.md cites `board.mts`'s `COLUMN_LETTERS` as a kernel export;
  it is actually module-private. `deriveColumnLetters` (`src/kernel.mjs`)
  derives the same column-letter alphabet by calling the kernel's
  exported `pointToCoord` instead.
- WQ013's ko-governed claims (a `ko_point:` key present) are reported
  not-verified rather than checked: a static diagram has no move history,
  and simple-ko/superko legality depends on the position two plies back.
  Suicide/occupancy-governed claims are unaffected.
- Family (b) checks only an `expected:` block's flat, top-level keys;
  nested sub-blocks (e.g. `area_scoring:`) are not recomputed.
- Family (f)'s legality checks default to `ruleset.chinese`; neither
  `tsumego.json` nor `lessons.json` declares a `ruleset` field.
- `white_area_score`/`white_territory_score` are checked komi-free,
  reconstructed from the kernel's raw stone/territory/prisoner fields
  rather than subtracting komi back out of `ScoreResult.whiteScore`.
- WQ042's site-rooted mapping covers only the `terms/` sub-prefix;
  cross-section paths (e.g. `/games/curricula/...`) are left unverified.
- `<color>_may_play_<coord>` claims (WQ013/WQ003) are evaluated via kernel
  position/board primitives rather than `new kernel.Game(...)`, so
  non-square diagrams are supported (`Game`'s constructor is square-only).
- SGF `RU[...]` values are normalized (case, whitespace, and the standard
  FF4 aliases `AGA`/`GOE`/`Japanese`/`NZ`/`Chinese`) before resolution; a
  value that still doesn't resolve gets its own diagnostic, WQ024 (an
  addition beyond SPEC.md's original catalog).
- `textDocument/hover` accepts both the real LSP wire shape
  (`{textDocument: {uri}, position}`) and SPEC.md's originally-specified
  flat shape (`{uri, position}`), for compatibility.

## Known limitations

- `status: seki`/`status: dead` word confirmation is permanently out of
  scope — it requires a real life-and-death solver, which neither this
  package nor the kernel is.
- R2/R3-style self-disclaimed positions (their own `note:` field states
  they are "a structural specification, not a fully traced sequence") are
  skipped rather than fabricated into a synthetic move list.
- No `--fix` flag or file-modifying capability of any kind: this tool
  verifies, it never edits.
- Cross-section site-rooted paths outside this section's own
  `/games/topics/board-games/weiqi/...` prefix are out of scope.
