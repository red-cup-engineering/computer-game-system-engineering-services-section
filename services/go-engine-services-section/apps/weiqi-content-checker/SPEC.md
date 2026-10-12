# weiqi-lsp — Specification

Audience: implementers of `@lenticule-science/weiqi-lsp`. Authority: this document is a rule *catalog* and *contract*, not code — see the [Weiqi LSP Constitution](../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-lsp-constitution.md) for purpose, authority, non-ownership, and refusal conditions, which this specification implements and does not restate except where a rule's own scoping depends on them.

House ethos, stated once and binding for every rule below: **the checker's rules ARE doctrine enforcement.** Every rule cites the convention document it enforces. A rule with no citable normative source does not belong in this catalog, per the constitution's refusal conditions.

Pure ESM (Node 24, JSDoc types, no `.ts`/build step): the checker core and CLI import the exact-pinned rules engine `@red-cup-engineering/weiqi-engine` (the kernel) through `src/kernel.mjs`; `apps/weiqi-kernel/src/...` paths below name that engine's `src/` modules, which keep the same file names. Tests are `node:test` + `assert/strict`, under `apps/weiqi-lsp/test/*.test.mjs`, run via:

```
cd apps/weiqi-lsp && node --test 'test/*.test.mjs'
```

## Diagnostic shape

Every rule below, regardless of transport face, produces this one record shape:

```js
/**
 * @typedef {Object} Diagnostic
 * @property {string} code       - "WQ0xx" identifier, this catalog.
 * @property {"error"|"warning"|"info"} severity
 * @property {string} file       - path relative to the section root.
 * @property {{line: number, column: number}} [start] - 1-indexed; omitted for whole-file rules.
 * @property {{line: number, column: number}} [end]
 * @property {string} message    - human-readable, states what disagreed with what.
 * @property {string} source     - the normative document this rule enforces (a relative path).
 * @property {string} ruleUrl    - "#WQ0xx" anchor into this document.
 */
```

## Rule catalog

### Family (a) — diagram parse and position legality

Normative source for the whole family: [Regression Positions](../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/teaching-articles/references/regression-positions.md), §"Diagram format", and `apps/weiqi-kernel/src/board.mts`'s coordinate/geometry model, which that section's convention was written to match exactly (row 1 = array row 0, top of the diagram; columns lettered `A`–`H`,`J`–... skipping `I`).

#### WQ001 — malformed diagram row

**Checks:** every row line inside a fenced diagram block has exactly as many space-separated symbols as the header row declares columns. A diagram with a declared header of `A B C D E` but a data row of four symbols is malformed — the row-count-vs-height and column-count-vs-width must each be internally consistent (this is the same check `test/helpers/diagram.mts`'s `parseDiagram` throws on today, moved from a test-only helper into a first-class diagnostic).
**Source:** Regression Positions, "Diagram format".
**Severity:** error.
**Minimal trigger:**
```
    A B C D E
  1 . . . . .
  2 . . X .
```
Row 2 has 4 symbols against a 5-column header.

#### WQ002 — unknown diagram symbol

**Checks:** every diagram cell is one of `X` (Black), `O` (White), `.` (empty), or `*` (empty point of interest). Any other token is unrecognized.
**Source:** Regression Positions, "Diagram format" ("Symbols: `X` = Black stone, `O` = White stone, `.` = empty point, `*` = an empty point of particular interest").
**Severity:** error.
**Minimal trigger:** a row containing `x` (lowercase) or `?`.

#### WQ003 — coordinate out of range

**Checks:** every Go-notation coordinate referenced anywhere that names one for a given diagram — in prose, in an `expected:` block's keys or values, in a marked `*` callout — resolves within that diagram's own declared width/height via `coordToPoint(width, height, coord)`. A coordinate valid on one diagram's board is not automatically valid on another's (R4's 3×3 fragment and R9's 7×5 board share no coordinate range).
**Source:** Regression Positions, "Diagram format" (coordinate convention) + `board.mts`'s `coordToPoint`.
**Severity:** error.
**Minimal trigger:** an `expected:` block for a 3-wide diagram referencing `white_may_play_D2: illegal` (column `D` does not exist on a 3-column board).

#### WQ004 — illegal position: zero-liberty group on the board

**Checks:** after parsing a diagram into a position (treating `*` as empty, per the corpus convention), no stone group has zero liberties. A settled position can never contain a living group with zero liberties — that is exactly the state a legal move is defined to prevent (capture or forbidden suicide) — so a diagram encoding one is either mistranscribed or is illustrating a mid-resolution state that must say so explicitly in prose.
**Source:** `board.mts`'s `findGroup`/liberties model + the [suicide](../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/suicide.md) and [capture](../../content/text/glossary/terms/capture.md) glossary terms (regression positions R4, R8).
**Severity:** error.
**Minimal trigger:** transcribing R4's diagram but leaving an already-captured stone on the board, producing a Black or White group with `liberties.size === 0`.

#### WQ005 — diagram header uses a skipped column letter

**Checks:** a diagram's column-letter header never includes `I` (traditional Go notation skips it, to avoid confusion with `1`), and its letters are the sequential prefix of `board.mts`'s `COLUMN_LETTERS` (`ABCDEFGHJKLMNOPQRSTUVWXYZ`) for the diagram's declared width.
**Source:** `board.mts`, `COLUMN_LETTERS`; Regression Positions R13's own note ("column `I` conventionally skipped in Go coordinate letters, hence `A`–`H`, `J`").
**Severity:** error.
**Minimal trigger:** a 9-column header written as `A B C D E F G H I` instead of `A B C D E F G H J`.

Non-square diagrams (R9's 7×5, R7's 4×3) are explicitly **not** an error under this family — `board.mts` supports width ≠ height directly, and the checker infers `width` from the header and `height` from the row count without assuming a square board, exactly as `test/helpers/diagram.mts` already does.

### Family (b) — diagram-vs-`expected:` consistency, recomputed via the kernel

Normative source for the whole family: Regression Positions' own stated contract — "Each position carries an `id`... and an `expected:` block giving the outcome as key-value pairs" — recomputed, not merely parsed, against the engine. This family exists because of the founding incident recorded in the constitution: an `expected:` block can silently drift from the diagram beside it, and nothing but a human re-deriving the arithmetic by hand previously caught that.

#### WQ010 — stone-count mismatch

**Checks:** any `expected:` key naming a stone count (`black_stones_on_board`, `white_stones_on_board`, and equivalents) equals the actual count of that color's stones in the parsed diagram.
**Source:** Regression Positions R9/R11 (`black_stones_on_board: 6`, comment `# C1-C5, D4`).
**Severity:** error.
**Minimal trigger:** R9's diagram edited to add a stray Black stone without updating `black_stones_on_board: 6` to `7`.

#### WQ011 — area/territory score mismatch

**Checks:** any `expected:` key naming a territory or score value (`black_territory`, `white_territory`, `black_area_score`, `white_area_score`, `black_territory_score`, `white_territory_score`, `white_final_with_komi`) equals what `computeTerritory`/`scoreArea`/`scoreTerritory` compute from the parsed diagram under the `expected:` block's own declared `ruleset:` (resolved via `getRuleset`).
**Source:** Regression Positions R9, R10, R11; `apps/weiqi-kernel/src/scoring.mts`.
**Severity:** error.
**Minimal trigger:** R10's `white_territory_score: 10` left unchanged after a diagram edit that gives White an eleventh territory point.

#### WQ012 — margin string mismatch

**Checks:** an `expected:` block's `margin:` string matches the kernel's own `marginString` output (`"Black by N"` / `"White by N"` / `"Draw"`) for the scores WQ011 just recomputed.
**Source:** Regression Positions R9–R11; `scoring.mts`'s `ScoreResult.margin`.
**Severity:** error.
**Minimal trigger:** scores that recompute to `White by 7.5` while the block still reads `margin: "White by 6.5"`.

#### WQ013 — capture/legality claim mismatch

**Checks:** any `expected:` key of the shape `<color>_may_play_<coord>: legal|illegal` is verified by constructing a `Game` from the parsed diagram (declared board size, declared `toMove`, and the ruleset named in the surrounding prose or `expected:` block) and calling `isLegal(coord)` — the result must match the claim exactly, including any per-ruleset qualifier (R5's `legal (under ruleset.newzealand only)` is checked against every ruleset the corpus names, not only the first).
**Source:** Regression Positions R1, R4, R5, R8; `apps/weiqi-kernel/src/game.mts`'s `Game.isLegal`.
**Severity:** error.
**Minimal trigger:** R1's diagram transcribed with Black's last capturing stone at the wrong point, so that `isLegal("C3")` for White now reports `true` while the block still asserts `illegal`.

#### WQ014 — unknown ruleset identifier

**Checks:** any `ruleset:` value named in an `expected:` block is a key `getRuleset` actually resolves (`chinese`, `japanese`, `aga`, `newzealand`, `ing`).
**Source:** `apps/weiqi-kernel/src/rulesets.mts`, `RULESETS`; [Rulesets](../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/teaching-articles/references/rulesets.md)'s stable-identifier table.
**Severity:** error.
**Minimal trigger:** `ruleset: chineese` (typo).

#### WQ019 — status claim not verified (deferred, informational)

**Checks:** nothing, by design — this is the honest counterpart to WQ010–WQ013. Any `expected:` key of the shape `status: <word>` (`seki`, `dead`) is reported as **not verified**: the checker states which mechanical facts it *did* confirm about the position (group membership, liberty count, e.g. "Black `{A1,A2}` and White `{C1,C2}` each have 2 liberties, confirmed") and explicitly declines to confirm or deny the status word itself.
**Source:** Regression Positions R6, R7; `apps/weiqi-kernel/src/events.mts`'s own module-doc deferral of `false-eye`/`seki`/`group-settled` for the identical reason ("a real life-and-death solver, which this module is not").
**Severity:** info.
**Minimal trigger:** any `expected:` block containing `status: seki` or `status: dead` — this diagnostic fires every time, by construction, and is expected in CI output rather than treated as a failure.

R2 and R3 are skipped by this entire family, not merely by WQ019: their own `note:` fields state they are "structural specification[s], not fully traced sequence[s]," and the checker must not fabricate an intervening move list to force a replay. A position id appearing in that self-disclaiming form is recognized by string match on the `note:` field's stated disclaimer and produces a single WQ019-style "skipped, self-disclaimed" diagnostic rather than a WQ013 attempt.

### Family (c) — SGF blocks parse and replay legally

Normative source: `apps/weiqi-kernel/src/sgf.mts`'s parse/serialize contract and the kernel constitution's own SGF refusal condition ("SGF input does not parse as well-formed SGF, or round-trips to a different position than it encoded").

**Scope note:** no file in this section's corpus currently contains a fenced ` ```sgf ` block. This family ships in Phase 1 (it is a direct, already-tested reuse of the kernel's own SGF layer) but has, as of this specification, never yet fired against real content — it activates the moment the corpus's first SGF block appears, per the same "no speculative scaffolding" posture the constitution applies at the directory level, applied here at the rule level.

#### WQ020 — SGF parse error

**Checks:** the text inside a ` ```sgf ` fence parses without throwing via `parseSgfCollection`.
**Source:** `sgf.mts`, `parseSgfCollection`.
**Severity:** error.
**Minimal trigger:** an unterminated property value, e.g. `(;GM[1]FF[4]SZ[9];B[cc)`.

#### WQ021 — illegal move in main line

**Checks:** replaying `sgfToGameRecord(text).moves` through a fresh `Game` (sized and ruleset per the record's `size`/`ruleset` root properties) accepts every move (`play(move).ok === true`), in order.
**Source:** `sgf.mts`, `sgfToGameRecord`; `game.mts`, `Game.play`.
**Severity:** error.
**Minimal trigger:** an SGF main line that plays a stone onto an already-occupied point.

#### WQ022 — SGF block missing an explicit ruleset

**Checks:** the SGF root node declares an `RU` property. Its absence is not fatal to replay (the checker falls back to `chinese` to still run WQ021), but an un-declared ruleset means a move's legality (suicide, ko regime) is being checked against an assumption the document itself never states.
**Source:** `sgf.mts`'s `SgfGameRecord.ruleset` (optional) + `rulesets.mts`.
**Severity:** warning.
**Minimal trigger:** `(;GM[1]FF[4]SZ[9];B[cc])` — no `RU[...]`.

#### WQ023 — SGF round-trip mismatch

**Checks:** `gameRecordToSgf(sgfToGameRecord(text))`, re-parsed, encodes the same sequence of moves (color and point-or-pass, in order) as the original text's main line — the same round-trip guarantee the kernel's own constitution requires of itself, checked here against corpus content rather than against the kernel's internal test fixtures.
**Source:** Weiqi Kernel Constitution, "Refusal conditions" ("SGF input does not parse as well-formed SGF, or round-trips to a different position than it encoded").
**Severity:** error.
**Minimal trigger:** an SGF block using a non-main-line variation the convenience layer silently drops, changing the round-tripped move count.

### Family (d) — markdown relative links and `termRef` resolution

Normative source: `scripts/check-links.mts` (absorbed into this family, one for one) plus `apps/weiqi-kernel/src/events.mts`'s `termRef` convention, which `check-links.mts` never checked at all.

**`check-links.mts`'s existing checks, enumerated (all carried forward as WQ030):**
1. Walk every `.md` file under `content/`.
2. Read prose Markdown links through the shared Markdown engine, excluding frontmatter and code examples; link titles are not part of the target.
3. Skip a target matching `^(https?:|mailto:|#|/)` — external URLs, mailtos, in-page anchors, and absolute `/`-rooted paths (a separate published-site namespace, not a filesystem path).
4. For every remaining target, strip a trailing `#fragment`, resolve it relative to the containing file's directory, and require it to exist and be a file.

#### WQ030 — broken relative link

**Checks:** exactly the four steps above, unchanged in scope, moved from a standalone script into this catalog.
**Source:** `scripts/check-links.mts`.
**Severity:** error.
**Minimal trigger:** `[Ending the Game](./ending-the-gaem.md)` (typo — file does not exist).

#### WQ031 — site-rooted term path does not map to a glossary file

**Checks:** a `/`-rooted path matching this section's own mounted prefix, `/games/topics/board-games/weiqi/terms/<slug>.md`, resolves (after mapping that prefix onto `content/text/glossary/terms/<slug>.md`) to a real file. This is deliberately the check `check-links.mts` explicitly skips ("those belong to a separate published-site URL namespace... not filesystem-relative links") for *every* `/`-rooted path without distinction — Family (d) narrows that blanket skip for the one sub-prefix this section does own the filesystem shape of, and leaves every other `/`-rooted path (e.g. `/games/curricula/...`, cross-section) genuinely out of scope, unchecked, per the constitution's Open obligations.
**Source:** `content/text/glossary/terms/` directory shape; the site-path convention observed in every glossary term's own inter-term links and every lesson's `uses-mechanic:` frontmatter list.
**Severity:** error.
**Minimal trigger:** a lesson's `uses-mechanic:` entry `/games/topics/board-games/weiqi/terms/atarii.md` (typo).

#### WQ032 — kernel `termRef` does not resolve

**Checks:** every value in `apps/weiqi-kernel/src/events.mts`'s `TERM_PATH` table resolves, from the kernel package root, to a real glossary file. This directly enforces the "engine is the executable form of the glossary" motto: if the kernel claims an event corresponds to a glossary term, that term must actually exist where the kernel says it does.
**Source:** `events.mts`, `TERM_PATH`; the plan's own motto, quoted in the kernel constitution's "Generative parent".
**Severity:** error.
**Minimal trigger:** `TERM_PATH` gaining a new entry (`"cut": "../../content/text/glossary/terms/cut.md"`) before `cut.md` exists — exactly the situation `events.mts`'s own module doc says has not yet happened ("no `cut.md` exists in this corpus's glossary yet").

### Family (e) — frontmatter conformance by `type`

Normative source: the corpus's own uniform frontmatter conventions, observed identically across every `type: term` file (`ko.md`, `capture.md`, `superko.md`, ...), every `type: lesson` file (`weiqi-overview.md`, `living-groups-and-eyes.md`), and every `type: specification` file (the constitution records, `regression-positions.md`).

#### WQ040 — term missing `defines`

**Checks:** a file with `type: term` declares a non-empty `defines:` list in frontmatter.
**Source:** every glossary term in `content/text/glossary/terms/` (`ko.md: defines: [ko]`, `capture.md: defines: [capture]`, `superko.md: defines: [superko, positional superko, situational superko]`).
**Severity:** error.
**Minimal trigger:** a new term file with `type: term` and no `defines:` key.

#### WQ041 — lesson missing `teaches`

**Checks:** a file with `type: lesson` declares a non-empty `teaches:` list.
**Source:** `weiqi-overview.md` (`teaches: [Weiqi Overview]`), `living-groups-and-eyes.md` (`teaches: [Living Groups and Eyes]`).
**Severity:** error.
**Minimal trigger:** a new lesson file with `type: lesson` and no `teaches:` key.

#### WQ042 — lesson `requires`/`uses-mechanic` entries unresolved (in-section only)

**Checks:** every entry of a `type: lesson` file's `uses-mechanic:` list resolves per WQ031 (same site-rooted mapping); every entry of its `requires:` list that falls under this section's own mounted prefix likewise resolves, while entries outside that prefix (this section's own lessons commonly `requires:` cross-section curricula, e.g. `/games/curricula/what-is-a-game.md`) are explicitly left unverified, per Family (d)'s stated scope boundary — reported neither broken nor confirmed.
**Source:** `weiqi-overview.md`'s and `living-groups-and-eyes.md`'s own `requires:`/`uses-mechanic:` frontmatter.
**Severity:** error (in-scope entries only).
**Minimal trigger:** `uses-mechanic:` containing `/games/topics/board-games/weiqi/terms/liberty.md` when no `liberty.md` exists under this section's glossary.

#### WQ043 — inline citation without a backing `references:` key

**Checks:** every `[@key]` inline citation appearing in a file's body has a matching key under that file's frontmatter `references:` map.
**Source:** `ko.md`, `capture.md`, `weiqi-overview.md` — each pairs body `[@key]` citations with a `references: {key: {authors, title}}` frontmatter map and a human-readable `cites:` list.
**Severity:** error.
**Minimal trigger:** body text citing `[@newsource2026]` with no `newsource2026:` entry under `references:`.

#### WQ044 — required frontmatter fields missing

**Checks:** every content markdown file declares a non-empty `title`, `type`, `date-created`, `date-updated`, and `authors`.
**Source:** uniform across the entire corpus sampled for this specification (constitutions, `regression-positions.md`, glossary terms, lessons).
**Severity:** error.
**Minimal trigger:** any file missing `date-updated`.

### Family (f) — app-data validation (`tsumego.json`, `lessons.json`)

Normative source: the JSON files themselves as observed at `apps/weiqi-web/public/data/tsumego-foundations.json` and `apps/weiqi-web/public/data/lesson-*.json`, cross-checked against the engine's `Game`/`findGroup`. `weiqi-lsp` reads these two files read-only (see the constitution's Non-ownership); it never authors or edits them.

#### WQ050 — schema-invalid tsumego problem

**Checks:** each entry in `tsumego.json`'s `problems[]` array has `id` (string), `set` (string), `title` (string), `size` (positive integer), `toPlay` (`"black"`|`"white"`), `stones` (array of `{pt, color}` with `pt` a valid coordinate for `size` and `color` `"black"`|`"white"`), `goal` (string), `accept` (non-empty array of move strings, each either `"pass"` or a valid coordinate for `size`), and `lines` (object whose every key also appears in `accept`).
**Source:** `tsumego.json`'s own uniform shape across all twelve current problems.
**Severity:** error.
**Minimal trigger:** a problem whose `lines` object has a key not present in its `accept` array.

#### WQ051 — tsumego `accept` move illegal

**Checks:** for each problem, build a `Game` at `size`, place `stones` (as a starting position, `toPlay` as declared), and confirm every move in `accept` is legal via `isLegal`. (`"pass"` is trivially legal and always passes this check; it exists in the catalog for `endgame-recognize-the-finish`-style problems where passing *is* the correct answer.)
**Source:** every problem in `tsumego.json`'s `capture`, `life-and-death`, and `endgame` sets.
**Severity:** error.
**Minimal trigger:** `capture-atari`'s `accept: ["E4"]` if White's stone at `D4` were edited to have a second liberty, making `E4` no longer a capture but still (spuriously) accepted.

#### WQ052 — tsumego `lines` reply illegal

**Checks:** for each accepted move with a non-empty `lines` entry, replay the nested `{move, reply}` continuation(s) — accepted move, then `move`, then `reply` — through the same `Game`, confirming each transition is legal in turn (`play(...).ok === true`) and alternates color correctly.
**Source:** `life-death-deny-straight`, `endgame-biggest-point`, and the other problems whose `lines` entries carry a defending continuation.
**Severity:** error.
**Minimal trigger:** `endgame-biggest-point`'s `lines.E2[0]` claiming White can legally reply `C2` when `C2` is already occupied by the position the accepted move produced.

#### WQ053 — schema-invalid lesson

**Checks:** each entry in `lessons.json` has `slug` (string, unique across the file), `title` (string), `steps` (non-empty array); each step's `kind` is one of `"read"`, `"board"`, `"exercise"`; a `"board"` step's `board` has `size` and a `stones` array of valid `{pt, color}` entries for that size; an `"exercise"` step's `exercise` has both `prompt` and `answerText`; and, if present, `next` names another entry's `slug` in the same file (a closed reference, not a dangling one).
**Source:** `lessons.json`'s own uniform shape across all four current lessons.
**Severity:** error.
**Minimal trigger:** a lesson whose `next: "no-such-lesson"` matches no `slug` in the file.

#### WQ054 — lesson board step illegal or mismatched

**Checks:** for a `"board"` step carrying a `sequence` array, replay it through a fresh `Game` at `board.size` (mapping each `sequence[i].move` — a coordinate or `"pass"` — through `play(...)`, alternating strictly by turn), and confirm (1) every move is legal, and (2) the resulting position's stones match `board.stones` exactly, color for color, point for point. For a `"board"` step with only static `board.stones` and no `sequence`, apply WQ004's zero-liberty check to that static position instead (a lesson's worked example must itself be a legal position even when no move sequence produced it).
**Source:** `lessons.json`'s own `_comment` fields, which already document that this verification was performed once by hand ("The sequence below was replayed move-by-move through the built kernel... it plays cleanly and the final White move reports capture/group-killed events, matching the lesson text exactly") — Family (f) makes that one-time hand-check a standing, re-run-on-every-change guarantee instead of a comment nobody re-verifies.
**Severity:** error.
**Minimal trigger:** the `weiqi-overview` lesson's capture-demonstration `sequence` edited to swap `E4` and `E6` without updating the step's `stones`/`markers`, so replay legally reaches a position that no longer matches the declared final board.

## CLI contract

Entry point: `scripts/check.mjs` (materializes under `apps/weiqi-lsp/bin/` alongside `SPEC.md`'s eventual `src/`, `test/`).

```
node scripts/check.mjs [globs...] [options]
```

**Arguments:**
- `globs...` — zero or more path globs, resolved relative to the section root (`weiqi-services-section/`). If omitted, defaults to this section's own full checkable surface: `content/**/*.md` and `services/weiqi-platform/apps/weiqi-learn/public/data/*.json`.
- `--json` — emit the machine-readable result object (below) to stdout instead of human-readable text.
- `--only=WQ001,WQ010,...` — restrict evaluation to the named rule codes (comma-separated). Repeatable.
- `--severity-min=info|warning|error` — every rule still runs; this filters what is *reported*, not what is *checked* (so exit-code behavior below is unaffected by this flag).
- `--quiet` — suppress per-diagnostic output; print only the final summary line.
- `--kernel-path=<path>` — override the resolved engine entry point (the installed `@red-cup-engineering/weiqi-engine` by default) for pinning against a specific checkout in tests.

**`--json` output shape:**

```js
{
  "tool": "weiqi-lsp",
  "version": "0.1.0",
  "filesScanned": 42,
  "diagnostics": [ /* Diagnostic[], see "Diagnostic shape" above */ ],
  "summary": { "errors": 0, "warnings": 1, "info": 3 }
}
```

**Exit codes:**
- `0` — no `error`-severity diagnostics. (`warning`/`info` diagnostics do not fail the run — WQ019 in particular is expected to fire on every run that touches R6/R7 and must never be conflated with failure.)
- `1` — at least one `error`-severity diagnostic.
- `2` — the tool itself could not complete a conclusive run: the kernel import failed, a glob matched zero files, a targeted JSON data file did not parse as JSON at all (distinct from WQ050/WQ053, which fire on a JSON file that parses but fails schema), or a CLI argument was invalid. Per the constitution's refusal conditions, exit `0` must never be produced by masking a run that could not actually evaluate its rules.

## LSP surface

Entry point: `scripts/server.mjs`. Communicates over stdio using the LSP wire protocol's `Content-Length` JSON-RPC framing:

```
Content-Length: <byte length of the JSON body, UTF-8>\r\n
\r\n
<JSON body>
```

One such header-plus-body block per message; any additional header lines (e.g. `Content-Type`) are accepted and ignored per the LSP spec; messages are read from **stdin** and written to **stdout** only — the server must never write anything else to stdout (all logging goes to **stderr**), since any stray byte on stdout corrupts the JSON-RPC stream for every subsequent message.

**`initialize` capabilities declared:**
```js
{
  capabilities: {
    textDocumentSync: 1,     // Full — Phase 1 scoping choice, see below
    hoverProvider: true,
    // Deliberately absent: completionProvider, codeActionProvider,
    // documentFormattingProvider, renameProvider, or any capability that
    // would let a client apply a server-suggested edit. Per the
    // constitution's non-ownership clause, weiqi-lsp never modifies files
    // — declaring no code-action capability is not an oversight, it is
    // the refusal condition made structural at the protocol level.
  }
}
```

`textDocumentSync: Full` (not `Incremental`) is a stated Phase 1 scoping choice: every `didChange` re-sends the whole document text, and the server re-runs the full rule catalog against it rather than tracking incremental deltas. Revisit only if editor-perceived latency on this corpus's file sizes ever justifies the added complexity.

**Message handling:**
- `didOpen` — run the full rule catalog (families a, b, d, e, and f where the opened document is one of the two JSON data files; family c if the document contains a fenced SGF block) against the provided text, and send `publishDiagnostics` for that URI.
- `didChange` — same as `didOpen`, using the new full text (per `textDocumentSync: Full` above).
- `didClose` — send `publishDiagnostics` with an empty `diagnostics` array for that URI, clearing any stale diagnostics from the client's display.
- `hover` — given a `{textDocument: {uri}, position: {line, character}}` (the real LSP `textDocument/hover` wire shape — the same `textDocument.uri` nesting `didOpen`/`didChange`/`didClose` already use above; the flat `{uri, position}` shape is also accepted, for compatibility), map the LSP position back to a diagram coordinate using the same header-offset arithmetic the diagram parser uses (only meaningful when the hover falls inside a fenced diagram block; otherwise respond `null`). Construct the `Position` for that diagram, call `findGroup` if the point is occupied, and return hover text stating: color, group size, liberty count, and the liberty points themselves. **Never** a life-and-death verdict — hover text reports only what `findGroup` mechanically returns, on the same boundary WQ019 draws for `expected:` blocks.

## Phase-1 scope vs. deferred

**Ships in Phase 1** (specified above, to be implemented against this catalog): all of Family (a); Family (b) excluding any `status:` claim, which WQ019 explicitly defers rather than attempting; Family (c) in full (parser and replay logic ready, currently unexercised by real content per its own scope note); Family (d) in full, including the absorbed `check-links.mts` logic; Family (e) in full; Family (f) in full. Both the CLI and LSP transport faces ship together — they share one verification core, per the constitution's Form section, so there is no partial-transport phase.

**Deferred, explicitly — never guessed, not merely unimplemented:**
- Any `status: seki` / `status: dead` claim (WQ019) — requires a real life-and-death solver, which neither `weiqi-lsp` nor the engine is, and both name that boundary rather than working around it.
- R2/R3-style self-disclaimed "structural specification" positions — never auto-traced into a synthetic move list.
- Any capability that writes to, reformats, or auto-corrects a checked file — not a Phase-2 item to be added later, but a permanent refusal per the constitution's non-ownership clause; there is no roadmap toward a `--fix` flag.
- Cross-section site-rooted path resolution (any `/`-rooted frontmatter path outside this section's own `/games/topics/board-games/weiqi/...` prefix) — out of this section's boundary, not merely postponed; see the constitution's Open obligations.
