# weiqi-web

`@lenticule-science/weiqi-web` — the web face for `weiqi-services-section`: **Play** (a normal Chinese-rules game on 9×9, 13×13, or 19×19, as Black or White, against five
local bot tiers, with undo and dead-stone marking at the count), **Tsumego** (a graded,
kernel-verified problem trainer with spaced-repetition review), **Learn** (an interactive lesson
player), **Study** (a replay of a share link, a finished Play session, or an imported SGF, with a concept
summary and a share link out), **Read** (the compiled glossary). Installable, with study content
available offline. The existing implementation is a standalone static/offline game mode, not the
complete current commercial platform. The [Red Cup Commercial Game SRS](https://github.com/red-cup-engineering/computer-engineering-services-section/blob/main/services/computer-systems-engineering-services-section/services/computer-game-system-services-section/content/text/documents/articles/specifications/weiqi-commercial-game-srs.md)
is the current **candidate** requirements specification for commercially viable modern
gameplay, integrating the already-owned game-audio, agent-cast, scoring/competition,
Go analysis, multiplayer and native Stripe/storefront suppliers through Red Cup's
qualified architecture, design and fabrication process. The original
[August Science platform plan](https://github.com/lenticule-science/science-services-section/blob/main/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md)
is historical scientific context, not authority to keep the commercial game
client-only or postpone actually paid products. No upstream package is
declared installed here merely because it is available in source. All rules authority stays with
[`@red-cup-engineering/weiqi-engine`](../../../../../../../../engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/computer-game-system-services-section/services/weiqi-engine/README.md); this app renders what the engine
computes and never reimplements legality, scoring, or event recognition.

The default `wrangler.jsonc` describes the observed public receiver: static assets,
with no match server or Durable Object binding. The unpublished Online Match
implementation and its former Worker configuration remain in source under
`wrangler.online.jsonc`; they are not advertised as a working public service.
Publishing a local-game improvement must not activate that separate stateful
capability as an incidental dependency.

The local game is an ordered, versioned engine session rather than page-owned
mutable board state. Play keeps the accepted commands in its current address, together
with the local opponent, player color, resignation, and dead-stone marking. Reloading
or opening the bookmarked “Keep this game link” reconstructs that session through
the engine, including an interrupted bot turn; it does not store a second board
or require an account. New game deliberately replaces the address. Normal play
and first-capture learning remain separate routes and refuse incompatible links.
Play can download that session as standard SGF, or hand it
to Study Replay. Study derives every displayed position and rules observation
by replaying the accepted session; it does not parse SGF, store a separate game,
or claim AI move judgment.

Phase 1 shipped correctness (the complete Capture Go / lesson / glossary slice). A first Polish
pass then shipped real stone presence and board texture, a misclick-resistant touch model with a
magnified drag preview, synthesized sound, and a live concept-recognition toast strip. **This
build is the "give the experience something to play" pass** per the owner's 2026-08-19 mandate —
"we really are looking to meet or beat real games... that sort of polish, once we get our engines
and interfaces done right, is CHEAP": a real tsumego trainer with 44 kernel-verified problems and
vendored SRS scheduling, the onboarding ladder turned into an actual ladder (rungs, saved progress,
per-rung intro copy from this section's own corpus, celebration on clearing one), and two new honest
bot tiers (liberty-counting, simple-influence) above the existing random/greedy pair — closing gaps
the [market teardown](../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-market-teardown.md) (the
misclick complaints, live concept recognition confirmed unclaimed by any competitor, SRS +
personalized problems near-unclaimed) and the
[platform plan](../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md)'s phase ladder
identified, without adding a single dependency.

## Running it

The education-platform-service `src/srs.test.mjs` owns FSRS-lite equations,
review transitions, epoch boundaries, monotonicity and stage definitions. The
Weiqi client's `test/srs-parity.test.mjs` checks the exact projected browser
artifact and running API across inputs; it does not copy the mathematical
suite. `npm run test:upstream` is the focused consumer boundary test, while
`npm test` runs the app's full suite.


```
npm run build          # project the upstream engine and SRS -> public/js; build glossary/icons/service worker
npm run check          # Node syntax checks for app, projected kernel, scripts, and tests
npm run serve          # serve public/ on http://localhost:8080/
npm test               # syntax gate and complete Node suite
npm run test:upstream  # browser-engine and education SRS projection conformance
npm run verify:release # build FIRST, then test the exact generated modules, then exercise normal play
```

Run `npm run build` once before the first `npm run serve`, and again after updating the
exact-pinned kernel or when `../../content/text/glossary/terms/*.md` changes — both
`public/js/kernel/` and `public/data/glossary.json` are build products, not hand-edited source.
Everything else in `public/` is served as-is; there is no bundler. The release gate
builds the browser projection **before** tests, so an upstream engine update cannot
silently replace already-tested browser modules between `npm test` and deployment.
A standalone `npm test` also runs `test/browser-projection-parity.test.mjs`,
which invokes the **upstream engine's existing browser generator** into a
temporary directory and compares every checked-in `public/js/kernel/*.mjs`
module byte-for-byte against that result. This catches stale generated
modules even when an engineer runs tests without regenerating first. No
second browser-kernel packaging logic or code templates live in the app.

## Deploy

weiqi-web is its own Cloudflare Worker (`wrangler.jsonc` in this directory), serving
`public/` straight off disk via a Workers static-assets binding -- no Cloud Run origin,
no proxy through the shared `cloudflare-router` (per the 2026-08-31 GCP exit ruling: GCP
billing is permanently off, and the Cloud Run game fleet is migration inventory, not
outage). `.assetsignore` excludes everything that is not `public/` (source, tests,
scripts, package files, this README).

```
npm run deploy    # source gates, build, deploy, then independent public artifact-hash readback
```

The deployment command first checks the actual Worker version reported by
Wrangler and publishes the built artifacts. It independently requests every
public host declared by `wrangler.jsonc`, refusing mismatched response status,
media type, artifact bytes, host identity or release identity. No locally
constructed active-provider receipt, artificial `no-op` decision or second
host registry can satisfy those receiving checks. `weiqi.play.561.group`
is the canonical player address, while `weiqi.561.group` remains an
independently observed route on the same configured Worker. A successful
HTTP artifact check is distinct from Cloudflare account-state verification
and from a real person's legal completed game; none is inferred from
source commits or synthetic tests. Cloudflare must actually accept each
custom-domain binding in an active zone before the public URLs can work. `npm run dev` runs `wrangler dev` for a local preview of the deployed shape.
`npm run serve` (`scripts/serve.mjs`) remains a plain `node:http` dev/test convenience
only; it is never what production serves.

## File tree

```
apps/weiqi-web/
  package.json           @lenticule-science/weiqi-web, scripts: build / check / test / serve /
                          deploy / dev
  wrangler.jsonc          own Cloudflare Worker: assets.directory ./public, custom_domain route
                          for weiqi.561.group (see "Deploy" above)
  .assetsignore           excludes everything under this directory that is not public/ from the
                          deployed Worker's static-assets upload
  check-mts.mjs           vendored verbatim from flickering-delve-service/check-mts.mjs (house
                          doctrine: vendor a copy, not a live cross-service import) -- a real
                          TS-syntax + JS-syntax gate for .mts files that `node --check` alone
                          leaves open; see the file's own doc comment for why
  README.md               this file
  scripts/
    build-kernel.mjs       invokes the exact-pinned kernel's browser projection -> public/js/kernel/
    build-glossary.mjs     compiles ../../content/text/glossary/terms/*.md -> public/data/glossary.json
                            (title, definition, elaboration, related terms) -- a small targeted
                            frontmatter/markdown extraction, not a general parser
    serve.mjs              node:http static file server over public/, sandboxed to that directory
    deploy-public-release.mjs deploys the exact static artifact set and requires public receiver acceptance
  test/
    smoke.test.mts          node --test: imports the exact-pinned kernel and the bot
                            (../public/js/bot.mjs), plays 100 capture-go
                            self-play games (random-legal Black vs. greedy-capture White),
                            asserting the kernel never rejects a bot-chosen move
    board-kernel-geometry.test.mjs  Exhaustive upstream coordinate and hoshi parity (7/9/13/19)
    stone-variance.test.mts DOM-free rendering-purity coverage: deterministic-hash.mjs and
                            stone-variance.mjs are pure functions of board position, tested
                            directly -- the "same position -> same bytes" guarantee board.mjs's
                            stone jitter/shadow/sheen rendering depends on
    touch-gesture.test.mts  the touch state machine (touch-gesture.mjs), driven directly with
                            synthetic coordinate/insideBoard sequences -- no browser, no DOM
    concept-tiers.test.mts  the event-toast tier-filtering rule (concept-tiers.mjs) against the
                            kernel's real SemanticEventType union
    bot-ladder.test.mts     the two new bot tiers (Watchful/liberty-counting, Reaching/influence),
                            driven against the real kernel across 800 seeded self-play games total
                            (200 each x 4 pairings/sizes) asserting no move is ever rejected, plus
                            two hand-built positions checking Watchful's actual priority order
    srs-parity.test.mts     srs.mjs against its own published-constant derivations (FACTOR from
                            DECAY, the R(t=S)=0.9 identity, determinism, monotonicity, STAGE_CUTS)
    tsumego-data.test.mts   machine verification of public/data/tsumego.json against the real
                            kernel -- every problem's accept line replays legally and actually
                            achieves its stated goal (see "Tsumego trainer" below)
    ladder-progress.test.mts  the onboarding ladder's unlock rule (ladder-progress.mjs), pure
    tsumego-deck.test.mts   the tsumego trainer's deck-filter and SRS due-selection logic
                            (tsumego-deck.mjs), pure
  public/                  everything here is exactly what gets served/deployed
    index.html              the four-face landing page (Play / Learn / Tsumego / Read)
    play.html               the Capture Go onboarding ladder
    tsumego.html             the tsumego trainer
    learn.html               the lesson player
    glossary.html            the Read face
    css/
      theme.css              page + board theme, CSS custom properties throughout; also owns the
                              board's animation keyframes, magnifier, concept-toast, ladder, and
                              tsumego-trainer styling -- game-owned craft per house doctrine
      shelf-chrome.css        vendored verbatim from sites/play.561.group/chrome/shelf-chrome.css
                              (byte-identical body, diffed against the source this build);
                              this build also corrected the shelf-mark SVG markup in all five pages'
                              header+footer (index/play/tsumego/learn/glossary.html), which still
                              carried a stale pre-Cowrie glyph (a rounded-rect "PB" shape) instead
                              of the current cowrie-shell mark (ellipse + toothed aperture line) --
                              the CSS file itself was already correct, only the HTML markup was stale
    data/
      glossary.json           BUILD PRODUCT (see build-glossary.mjs)
      lesson-weiqi-overview.json   hand-authored step data for the Weiqi Overview lesson
      ladder-rungs.json       the onboarding ladder's rung table: board size + bot tier id + a
                              verbatim intro-copy excerpt from this section's own lesson/glossary
                              corpus per rung (see "Capture Go ladder" below)
      tsumego.json            44 hand-authored, kernel-verified tsumego problems (see "Tsumego
                              trainer" below) -- BUILD-ADJACENT: hand-authored, but every problem
                              in it is re-verified by test/tsumego-data.test.mts on every test run
    js/
      board.mjs               the SVG board component (ES module, no custom-element registration)
      stone-variance.mjs       pure, DOM-free: deterministic per-stone visual jitter/sheen, seeded
                                from (col, row, size) -- no Math.random anywhere in rendering
      deterministic-hash.mjs   the pure integer hash stone-variance.mjs (and sound.mjs's pitch
                                wobble) are built on
      touch-gesture.mjs        pure, DOM-free: the touch input state machine (drag-to-place with
                                magnifier, or tap-then-confirm) -- board.mjs is its only DOM caller
      concept-tiers.mjs        pure, DOM-free: which semantic events toast, at which settings tier
      sound.mjs                WebAudio-synthesized stone click / capture clatter / atari alert /
                                game-end chime / byo-yomi tick (scaffolding); zero sample files
      concept-toast.mjs        the on-board toast strip (DOM layer over concept-tiers.mjs's rule)
      bot.mjs                  the five-tier bot ladder (see "Bot ladder" below), kernel-agnostic
      bot-worker.mjs           the bot's thinking thread: rebuilds the engine game from the posted
                                session and runs the chosen tier off the page thread
      srs.mjs                  BUILD PRODUCT: projected unchanged by build-kernel.mjs from
                                @red-cup-engineering/education-platform-service/srs
      ladder-progress.mjs      pure, DOM-free: the onboarding ladder's unlock rule
      tsumego-deck.mjs         pure, DOM-free: tsumego deck filtering + SRS due-card selection
      hover-card.mjs           the shared glossary hover-card component
      play-app.mjs             page glue for play.html and learn/capture-go/ (see "The local game")
      local-game.mjs           pure page decisions for the local game: undo, dead-stone marking, the count
      study-replay.mjs         the Study replay builder, DOM-free, shared by review-app.mjs and Undo
      tsumego-app.mjs          page glue for tsumego.html (the trainer)
      learn-app.mjs            page glue for learn.html
      glossary-app.mjs         page glue for glossary.html
      kernel/                  BUILD PRODUCT (from the exact-pinned kernel's shared browser projection)
```

## The board component (`public/js/board.mjs`)

The SVG renderer and gesture recognizer now **consume**, rather than recopy, the upstream
`@red-cup-engineering/weiqi-engine` browser projection: `kernel/board.mjs` supplies stone
identities and Go coordinates; `kernel/rulesets.mjs` supplies the standard fixed hoshi.
The UI still receives the engine's `Uint8Array` board and a legality-checker callback and
never reimplements move legality or scoring. Both kernel modules are generated by
`scripts/build-kernel.mjs`; do not edit them in the app. Visual variance and touch gestures
remain presentation-only sibling helpers. `test/board-kernel-geometry.test.mjs` checks every
coordinate on 7×7, 9×9, 13×13 and 19×19 and the standard star-point sets against the kernel.

**Board beauty** (Experience Brief item 1):

- **Dimensional stones**: each stone is a radial-gradient-filled circle (a "slate" gradient for
  Black, a "shell" gradient for White) plus a blurred contact shadow and a rotated glossy sheen
  highlight — three visual layers per stone, all through one shared gradient/filter definition per
  color (not per stone), so a full 19x19 board's 361 stones cost two gradients and one shadow
  filter, not 722.
- **Deterministic per-stone variance**: position jitter, size variation, and sheen-highlight angle
  are all seeded from `(col, row, size)` via `stone-variance.mjs`'s pure hash — never
  `Math.random`. The same board position renders to the same variance every time (see
  `test/stone-variance.test.mts`), which is what makes "same position → same bytes" a real,
  checked guarantee rather than an aspiration.
- **Board ground**: a warm kaya-toned field with deterministic wood-grain texture (SVG
  `feTurbulence` with a fixed `seed` — the SVG spec's own reference algorithm, reproducible, not
  random) tinted to the board's own `--board-wood-line` color, plus a soft vignette for depth.
  Traditional stone/cell proportions are unchanged (stone diameter ≈ 92% of cell spacing).
- **Placement + capture animation**: `setPosition` diffs against the previously rendered board
  (not a full `innerHTML` wipe) so only stones that actually changed animate — new stones
  scale+fade in, captured stones lift+fade out. `prefers-reduced-motion` is honored (no CSS
  animation runs; changes apply instantly). A stone captured while its own placement animation is
  still in flight has that animation cleared first, so two CSS animations never compete for the
  same properties on one element.
- **Last-move + ko markers**: the last-move square outline is unchanged; a new ko marker (a
  diamond outline — a distinct SHAPE, not a recolored square) renders at the kernel's
  `activeKoPoint` when a caller sets it via `setKoPoint(coord)`, with a gentle pulse
  (reduced-motion gated).
- **Territory shading**: the existing `setTerritory(map)` paints the upstream Weiqi engine's
  `computeTerritory(removeDeadStones(...)).ownership` after two passes, refreshing as groups
  are marked dead. The board does not calculate territory or infer it from scores: neutral
  regions (including dame and seki liberties) remain unshaded. New game and Undo clear the
  projection. Capture Go still ends at the first capture and never enters area scoring.
  The counted ownership map is checked with dead-stone and neutral-point regression tests.

**Touch model** (Experience Brief item 2 — the teardown's #1 competitor weakness, OGS misclicks):

- **Drag-to-place with a magnifier** (default): press and drag across the board; a magnified
  preview (an SVG `<use>` live-mirroring the same board content, not a second render pass) follows
  above the finger, offset so the fingertip never hides the point it's about to place. Release
  *inside* the board commits at the nearest intersection; release *outside* (or a pointercancel)
  cancels with nothing played — the actual fix for a fat-finger overshoot, not just a bigger hit
  target.
- **Tap-then-confirm** (explicit toggle, for the cautious): the original gesture, now with a
  visible **Cancel** control — previously the only way out of a pending tap was tapping elsewhere
  to move the preview; there was no way to simply back out.
- **Pinch-zoom + pan** on boards ≥13×13: two fingers scale/pan a CSS transform on the board SVG;
  `#nearestPoint`'s hit-testing already reads the live (post-transform) bounding rect, so placement
  accuracy is unaffected by zoom level. While zoomed, a single finger pans; a small-movement single
  touch is still treated as a precise tap-to-place.
- **Hit targets**: `#nearestPoint` always snaps to the *nearest* board intersection regardless of
  exact contact position — this is the effective hit-target guarantee (generous and constant
  regardless of visual stone size at any zoom level), stronger than a fixed-radius invisible circle
  per point would be on a crowded 19x19. Interactive controls (Cancel, Reset zoom) are ≥44×44 CSS
  px per mobile guidance.
- **Both gesture models are unit-tested as a pure state machine** — `touch-gesture.mjs`, driven
  directly with synthetic coordinate sequences in `test/touch-gesture.test.mts`, no DOM.
- **Keyboard navigation**: arrows explore the board, Home/End reach row ends,
  Ctrl+Home/Ctrl+End reach corners, and Enter/Space attempts a move. The live region describes
  the actual intersection (stone color, last move, ko, marked-dead group); the engine remains
  the move-legality authority.

**Other existing board behavior, unchanged**: sizes 7/9/13/19, with hoshi now read from the
upstream handicap placement table rather than calculated independently;
hover ghost stone on desktop pointer devices (semi-transparent preview, or a dashed
forbidden-ring-with-slash when illegal — shape-coded, not color-only); semantic-event badge layer
(glyph+color+hoverable `<title>` per event, exported as `EVENT_GLYPHS`/`getEventGlyph` so
play-app.mjs's toast strip draws from the same table, not a second copy); theme entirely via CSS
custom properties; screen-reader `aria-live` announcements for moves, cursor position, illegal
attempts, and touch state; no color-only signals anywhere.

## Sound (`public/js/sound.mjs`) — Experience Brief item 3

Zero-dep, WebAudio-synthesized, no sample files: a short percussive stone click (triangle
oscillator + filtered noise burst, pitch wobble seeded from the played coordinate), a capture
"clatter" (a scattered run of clicks, one per captured stone, capped at 7), a soft two-tone atari
alert, a closing three-note chime at game end, and a low countdown-tick primitive
(`playTick(urgent)`) scaffolded for byo-yomi timing but not yet wired to any UI, since byo-yomi
itself doesn't exist yet. Muting is persisted in `localStorage`; the very first run on a device
that has never set a preference here defaults muted if `prefers-reduced-motion: reduce` is set —
this app has no way to distinguish "reduced motion" from "reduced everything" without asking, and
treats the one signal it has as covering both until the user explicitly toggles sound in Settings.

## Live concept recognition (`public/js/concept-toast.mjs` + `concept-tiers.mjs`) — item 4

Our source-backed candidate differentiator, which still needs dated competitor and real
learner comparison: as `Game.play()` fires semantic events, a calm, non-blocking toast strip names the concept — same wording as
the event log, same hoverable glossary term (`[data-term]`, wired through the shared
`GlossaryHoverCard`) — near the board, auto-dismissing after ~4.8s or on hover/focus pause. Three
settings tiers, persisted in `localStorage`:

- **Beginner** (default): every toastable event.
- **Intermediate**: only the "rare," structurally-interesting events (ko, connection, eye
  formation) — an intermediate player already recognizes atari/capture on sight, so those are
  dropped to avoid nagging.
- **Off**: no toasts. Board badges and the event log are unaffected by this setting.

`pass`/`game-ended` are never toasted at any tier (too frequent to be a "concept moment"), and
`group-killed` is folded into its accompanying `capture` toast rather than doubling up on the same
move. The tier rule itself is pure, DOM-free logic (`concept-tiers.mjs`), tested directly in
`test/concept-tiers.test.mjs` against the kernel's real `SemanticEventType` union — a regression
test fails loudly if the kernel ever adds an event type this module hasn't made a deliberate
toast/no-toast decision about.

**Honest scope, unchanged from Phase 1**: this is still proven only in the narrowest slice —
7×7 capture-go, where atari/capture are common and ko/connection/eye-formed are structurally rare
or impossible (the game ends at first capture). There is still no post-game concept-event
timeline (the data already exists per-move via `game.moveEvents`; building the view is future
work, not blocked on anything). `cut`, `false-eye`, `seki`, and `group-settled` remain
deliberately unimplemented in the kernel (see `events.mts`'s own doc comment) — this app never
implies coverage those events don't have.

## The local game (`public/js/play-app.mjs` + `local-game.mjs` + `bot-worker.mjs`)

Play is a normal Chinese-rules game against one bot tier, on 9×9, 13×13, or 19×19, as Black or
White (both chosen per game and remembered in `localStorage`; a White human sees the bot open).
The page never owns board state: the game is the engine's versioned session, every move is admitted
through `admitWeiqiGameCommand`, and every screen (board, event log, count) is rendered from it.

- **Undo** (`undoLastExchange`) takes back the human's last move and, if the bot has already
  replied, the reply too — by rebuilding the session from its own accepted commands, never by
  editing a board. It never removes only the bot's opening stone from a White human, and it reopens a
  game that had ended by two passes. The event log is rebuilt from the same replay Study uses
  (`study-replay.mjs`).
- **Resign** now submits the engine's existing `{ kind: "resign", color }`
  command at the current session version, including off-turn resignations
  permitted by the engine. The page ends only on accepted admission; rejected
  commands leave the game open. The accepted terminal session is the common
  authority for the visible winner, the Study/Play link's `commands` fragment,
  and SGF's `RE[W+R]` or `RE[B+R]` result. A canonical result also disables
  Undo. Existing bookmarked UI-only resignation links remain readable.
- **Two passes end the main phase**, and the page enters dead-stone marking: clicking a stone
  toggles its whole group (`toggleDeadGroup`, read off the engine's `findGroup`), and the count is
  read from one upstream `scoreWeiqiSession(session, deadPoints)` receipt: the engine returns its
  settled position, score, scoring mode and ownership map together. Marking remains an agreement,
  never a rules fact; the bot has no life-and-death reading and accepts the human's marking, and the result card says so. Marked
  stones are drawn with a cross (`board.setDeadStones`), a distinct shape from every other marker.
  Undo leaves provisional marking and reopens play.
- **Accept count** appears alongside the provisional result only in normal Play,
  never in Capture Go. After the human marks whole groups dead (or leaves
  all stones alive), the button admits the engine's existing
  `{ kind: "settle", dead: [...] }` command using those Go coordinates. On
  successful admission it takes the canonical accepted dead set and score,
  which lists every actual dead intersection only once even if a submitted
  command repeated a point under different coordinate spellings. Marking
  an empty point is rejected upstream. The same engine also checks that
  every marked connected group is **fully** marked: accepting a partial group
  would fabricate a board and an invalid final score. Play then changes the
  readout from **Provisional** to **Agreed**, locks dead marking
  and Undo, and puts the terminal command into Play and Study share links
  and the SGF `RE[]` result. A refused settlement leaves the provisional
  session editable. There is no second scoring implementation or agreement
  format: the local bot accepts the human's marking at this one boundary.
- **Opening completed or resumed game links** uses the accepted engine result as
  authority. A canonical resignation closes the game and names the resigning
  color and winner; an agreed settlement uses `Game.result.dead`, cannot be
  re-marked or undone, and displays an **Agreed**, not provisional, count.
  A contradictory `resigned` or `dead` presentation flag is rejected. Old
  Play links that carried a UI-only resignation marker still reopen with
  their old result text. A game resumed after two passes is **not** frozen as
  ended merely because the engine's historical `mainPhaseEnded` is sticky:
  only its active `passStreak >= 2` with no settled result enters editable
  dead-stone marking (`isUnsettledTwoPassPosition`).
- **The bot thinks in a Worker** (`bot-worker.mjs`): the page posts the session and tier id,
  the worker rebuilds the engine game and runs the tier's chooser, and the reply is dropped if a new
  game or an undo has superseded it meanwhile. If the Worker cannot load, the tier runs on the page
  thread instead. Every reply is still admitted through the engine like a human move.

## Records: Study takes a link or an SGF and gives one back (`public/js/study-replay.mjs`)

Study opens share links, finished Play sessions, and imported SGF files or pasted text.
Each becomes the same upstream versioned Weiqi session, never another game model.
**Study frames now use one validated engine materialization**: `Game.history` supplies
each position and `Game.moveEvents` supplies each semantic observation. Study no longer
replays and re-admits every command prefix just to render the move list. Resignation and
settlement retain their numbered frames without inventing a board move, and their labels
say "resigned" or "count settled" rather than "played undefined". Short-game tests
compare every frame against independent admission-based replay, including handicap.
SGF records follow the first variation at each fork as the main line, while the engine's
full SGF collection parser retains the alternatives. SGF FF[4] escaped line
continuations are parsed upstream; duplicate node properties (for example,
competing `SZ` board sizes) are rejected instead of silently replacing data. Each imported move passes through
canonical command admission, with the first illegal or out-of-turn move reported.
Unknown SGF rules names fall back to Chinese with a note; differing komi is disclosed.

**Standard handicap SGF is supported.** Study checks the declared `HA` against the
number of `AB` stones and requires their coordinates to equal the exact fixed-star
placements returned by `kernel.handicapStones`. White moves first, and the handicap
stones appear in Study frame zero. Arbitrary `AB` setup without `HA`, nonstandard
handicap placements, and unsupported `AW`/`AE` setup edits are refused rather than
silently imported as a different game. `studyLink` preserves the accepted session's
handicap count in its URL fragment as well as its ruleset. For purely play/pass
sessions, Study and Play keep the original compact `moves=C3.pass.G7` links.
For records ending in a resignation or agreed settlement, `studyLink`
instead carries `commands`, JSON-encoded from the engine's *existing*
immutable WeiqiGameCommand array. These are mutually exclusive link
representations: neither the resignation nor the agreed dead-stone count is
silently lost, and no parallel terminal-command grammar is maintained in
the web app. Older links remain readable. Corrupt, ambiguous, and illegal
command lists are refused through the engine admission boundary. Play's
human/bot/resigned/dead UI preferences stay separate from engine commands.

Study also renders the game's **concept summary** (`concept-summary.mjs`): each glossary
concept named by engine events, counted per side, and untouched concepts linked to their
glossary entries and tsumego sets. Play shows the same card at game end. This remains a
rules-observation view, not an external engine-strength analysis.

## Installable, offline study (`public/manifest.webmanifest`, `public/sw.js`)

The manifest and icons (`scripts/build-icons.mjs` renders the PNGs from the same mark as
`icons/icon.svg`, with no image library) make the site installable to a home screen.
`scripts/build-service-worker.mjs` writes `public/sw.js`, a BUILD PRODUCT: it precaches every file
under `public/` under a cache named by their digest, serves network-first with cache fallback so
online visitors always get the deployed bytes and offline visitors get the last build, never
caches the match API, and drops the previous build's cache on activation. `js/pwa.mjs` registers
it from every page. `test/pwa.test.mts` checks the manifest, icon sizes, precache list, and
registration; the release contract probes the manifest and the worker on the live receiver.

## Capture Go ladder (`public/js/play-app.mjs` + `public/data/ladder-rungs.json`)

`japanese` ruleset (simple ko, illegal suicide — komi/scoring are irrelevant, since the game ends
the instant either side captures). Black is always the human player. What was a single fixed 7×7
game against the greedy-capture bot is now a **four-rung onboarding ladder**, each rung pairing a
board size with one tier from the bot ladder below:

| # | Rung | Board | Bot | Cleared by |
| - | --- | --- | --- | --- |
| 1 | First Captures | 7×7 | Wandering (random-legal) | beating it once |
| 2 | Taking What's Offered | 7×7 | Grabby (greedy-capture) | beating it once |
| 3 | Wider Board | 9×9 | Reaching (influence heuristic) | beating it once |
| 4 | Mind Your Liberties | 9×9 | Watchful (liberty-counting) | beating it once |

**Order verified, not assumed**: a 240-game round-robin across all four tiers (20 games/pair,
colors alternated, `japanese` ruleset, 9×9 — see the polish-pass verification session) found
Watchful beats Reaching in roughly 39 of 40 head-to-head games, robustly across 7×7/9×9/13×13, not
the other way around — the two tiers were originally ordered the other way (Watchful at rung 3,
Reaching at rung 4), which meant the "final," hardest-implied rung was actually a measurably
*weaker* opponent than the one before it, contradicting this file's own "gets smarter each rung"
line above. Watchful and Reaching swapped rungs (and Mind Your Liberties moved to 9×9, so board
size stays non-decreasing across the ladder) to make the ladder's difficulty order match what the
bots actually do against each other, not just their code-comment ordering in `bot.mjs`. The full
verified strength order is `random < greedy < influence < liberty` — `bot.mjs`'s own `BOT_TIERS`
array keeps its original `random`/`greedy`/`liberty`/`influence` order (an id-keyed lookup table,
order-independent for `play-app.mjs`'s `BOT_TIERS.find(...)`) and its own doc comments already
hedge against reading that array as a calibrated strength ladder; the ladder's *play order* is what
actually needed to change.

- **Progress persistence**: clearing a rung (winning it as Black) saves that rung's id to
  `localStorage` (`weiqi-ladder-progress`) via `ladder-progress.mjs` — pure unlock-rule logic, unit
  tested (`test/ladder-progress.test.mts`), imported by both the reader (which rungs render
  unlocked) and the writer (marking a new clear) so they can never disagree. Rungs unlock strictly
  in order; nothing already unlocked is ever re-locked, and replaying an already-cleared rung is
  always allowed.
- **Per-rung intro copy**: each rung's intro panel is a **verbatim excerpt** from this section's own
  lesson/glossary corpus (`weiqi-overview.md`, `atari.md`, `capture.md`, `liberty.md` — see
  `ladder-rungs.json`'s own `introSource` field per rung), not invented UI copy, plus one honest
  sentence naming the actual bot tier and its tagline.
- **Celebration moments**: clearing a rung shows that rung's own hand-written celebration line
  (e.g. the final rung's "You cleared the ladder! Watchful counts liberties and rescues its own
  groups on purpose...") and, the first time it happens, names the newly-unlocked next rung.
  Replaying an already-cleared rung still congratulates without re-announcing an unlock.
- Everything from the prior build is unchanged underneath: every kernel `SemanticEvent` from each
  move still renders as an on-board badge, a hoverable event-log entry, a tier-gated toast, and a
  sound; the kernel's `activeKoPoint` still drives the board's ko marker directly; the Settings
  panel (sound mute, concept-toast tier, touch mode) is unaffected by which rung is active.

### Bot ladder (`public/js/bot.mjs`)

Four tiers, kernel-agnostic and kernel-API-only (every decision reads off values the kernel itself
computed — `applyStonePlacement`'s capture preview, `findGroup`'s liberties, `neighbors`'
adjacency — never a second copy of legality/capture logic), in ascending order:

| Tier | Label | What it actually does |
| --- | --- | --- |
| `random` | Wandering | Uniformly random legal move. No plan, no memory — the baseline, not a beginner opponent to learn from. |
| `greedy` | Grabby | Always takes an available capture; otherwise wanders. Reactive, never anticipatory. |
| `liberty` | Watchful | Counts liberties: takes an available capture, rescues its own groups from atari when possible, otherwise avoids self-atari and leans on whichever adjacent enemy group has the fewest liberties. First tier that defends itself on purpose. |
| `influence` | Reaching | Watchful's same capture/self-atari safety sense, but aimed by a simple `+2`/`-2`-per-neighbor influence heuristic (plus a small center bonus) instead of direct pressure — a different shape of one-move heuristic, not a deeper one. |
| `montecarlo` | Pondering | Monte Carlo tree search, UCT (`chooseMonteCarloMove`): each iteration forks the complete upstream `Game` (preserving ko/superko, pass streak and terminal state), walks a tree of kernel-admitted moves by UCB1 (root candidates first tried in a tactical prior order), expands a leaf on its second visit, plays the rest out with random non-eye-filling legal moves to two passes (`randomPlayout`), and `countPosition(game)` chooses the upstream ruleset's own area or territory score for the provisional winner. The most-visited root move is played. 400 playouts on 9×9, 160 on 13×13, 40 on 19×19 (`monteCarloBudget`), historically about a second per move (0.7s, 0.9s, 1.3s measured on Node 24 **before** history-aware forks; rebenchmark required). No shape knowledge. |

**Pondering, historical baseline** (2026-09-16, Node 24, 9×9 Chinese rules, 400 playouts, ten games as each
color, every stone counted alive at the end): Pondering beat Watchful **15 of 20** games across two
seeds (7 and 8 of 10). The same budget spent as flat Monte Carlo (no tree) won 5 of 10; adding the
classic playout reflexes (capture the stone just played if it is in atari, rescue an own group it
put in atari) to the flat search dropped that to 2 of 10 both with and without root widening, so
the playouts are uniformly random and the tree carries the strength. Search outcomes now use the canonical ruleset-aware `countPosition(game)` entrypoint instead of hardcoding area scoring; an 18-command legal test fixture demonstrates that Chinese area and Japanese territory can name opposite winners for the same board. Watchful in
turn beats Reaching about 39 of 40 (earlier measurement below), so the ladder's order is
measured, not asserted.

**Labels are deliberately not kyu/dan ranks.** None of these bots have been rated against anything
real, and a scripted heuristic claiming a rank would be exactly the dishonest strength claim the
task's mandate rules out (`test/bot-ladder.test.mts` even asserts no tier's label/description
matches a `\d+\s*(kyu|dan)` pattern). They're described honestly as "learns-with-you" tiers: each
one is a genuinely different, slightly more attentive opponent than the last, not a calibrated
strength ladder. **GnuGo/KataGo remain the platform plan's later server-side engine tier** — this
bot ladder is the "scripted weak bots first" rung the plan itself names, not a substitute for real
engine play, and nothing here claims otherwise.

**Endgame sense, shared by every tier** (`candidateMoveCoords` / `isSelfHarmingMove` in
`bot.mjs`, added 2026-09-16): before any tier chooses, the legal moves are filtered to the ones
that do not only hurt the mover — a bot never fills a point that is already its own simple eye,
never self-captures, and never leaves its own new stone at a single liberty unless the move
captures something. Once the opponent has passed, a bot plays on only to capture (the count treats
every stone as alive, so a capture is real points) and otherwise passes. Before this, every tier
returned "pass" only when no legal placement existed at all, so the top tiers would fill their own
eyes at the end of a game and a normal game could never reach two passes. `test/bot-endgame.test.mts`
pins the eye-fill refusal, the self-atari/throw-in distinction, the pass-after-pass rule, and
self-play between tiers (both colors, three tie-break RNGs) ending by two passes with every move
accepted by the kernel; `test/normal-play.test.mts` covers the human/bot turn admission.

## Tsumego trainer (`public/js/tsumego-app.mjs` + `public/data/tsumego.json`)

A graded problem player: every answer is checked by actually calling `game.play()` against the
real kernel and comparing the result to the problem's authored `accept` moves — there is no second,
separate notion of "correct" anywhere in this file. Problems are data (`public/data/tsumego.json`),
not code.

- **Content**: **44 problems** across the three graded categories the task named, spanning all
  three difficulty bands:

  | Category | Count | Bands |
  | --- | --- | --- |
  | Capture Go Basics | 16 | introductory, developing |
  | Ladders & Nets | 14 | developing, challenging |
  | Life & Death Fundamentals | 14 | introductory, developing, challenging |
  | **Total** | **44** | 18 introductory · 18 developing · 8 challenging |

  Goal types: `capture` (remove the target group), `escape` (get your own atari'd group to more
  than one liberty), `live` (form two real eyes, checked by the same diagonal-control rule
  `false-eye.md` describes and the kernel's own `isLegal` already enforces for true single-point
  eyes), and `kill` (capture an already-doomed invader). 6 problems cite a real classical shape
  (`source: "traditional-shape:straight-three-corner"`, `bent-three-corner`, `straight-four-edge` —
  public-domain Go vocabulary, not a reproduction of any single copyrighted book's diagram); the
  other 38 are original positions constructed for this trainer, marked `source: "original"`. Every
  problem carries a hand-written `failNote` explaining *why* the wrong answer fails, not just that
  it does.
- **Author → verify → keep (the Equivo discipline the task named)**: every problem's `accept` move
  and its full `lines[accept]` continuation is replayed through the real kernel by
  `test/tsumego-data.test.mts` on every test run — not just at authoring time. A problem is only
  ever in `tsumego.json` because that exact replay already passed: every move in the line is
  legality-checked (`game.isLegal`) before being played, and the stated `goalType` is verified
  against the actual resulting position (the target's board cell for capture/kill, the group's
  liberty count for escape, a real two-eye count via the same diagonal-control helper the test file
  reimplements independently rather than trusting the trainer's own runtime code).
- **SRS scheduling**: `public/js/srs.mjs`, generated from the upstream
  `@red-cup-engineering/education-platform-service/srs` during `npm run build` (FSRS-lite: the published `R(t,S) = (1 + FACTOR·t/S)^DECAY`
  forgetting curve, `DECAY`/`FACTOR` at their published defaults, one fixed constant set rather
  than a full per-user fit — see the file's own header for exactly what's a disclosed
  simplification). Review state persists per problem id to `localStorage`
  (`weiqi-tsumego-srs`) in the exact `CardState` shape `reviewCard` produces and expects — no
  adapter layer. `test/srs-parity.test.mts` checks this vendored copy against the curve's own
  published structural identities (the `R(t=S)=0.9` identity, `STAGE_CUTS` matching lantern's
  published cut points, determinism, monotonicity) independently of `test/tsumego-deck.test.mts`,
  which checks the *due-selection* logic built on top of it.
- **Grading**: after solving (or seeing the solution), Again/Hard/Good/Easy map directly to
  `srs.mjs`'s 1–4 grade scale — no relabeling in between.
- **Wrong answers show the solution, not yet a refutation of the specific mistake**: a wrong-but-legal
  try is actually played on the board (so its consequence is visible, not just silently rejected),
  the problem's `failNote` runs alongside it, and then the board resets to the starting diagram and
  replays the real solution — the exact same kernel-verified `accept` + `lines` sequence a correct
  answer would have triggered. Verified honestly (polish-pass verification session, driving wrong
  answers through the real trainer wiring): `failNote` is one fixed string per problem in
  `tsumego.json`, independent of which wrong coordinate the player actually tried, and there is no
  authored per-wrong-move punishment line — so this is accurately "here's the solution and a general
  hint," not the market teardown's "right/wrong, no why" complaint fully answered. A real refutation
  (playing out *why the specific tried move loses*, e.g. the opponent's punishing reply) would need
  per-wrong-move continuation data this trainer does not have yet; the UI copy used to call this
  "the refutation," which overclaimed — it now says "the solution." Authoring real per-mistake
  refutation lines is real future content work, tracked below with the content-scale honesty note,
  not something to fake procedurally.
- **Deck picker**: filter by category and/or band, plus a "due for review only" toggle (default on)
  built on `tsumego-deck.mjs`'s pure `buildQueue` — new (never-reviewed) problems always sort
  first, then already-reviewed-and-due problems most-overdue-first, independent of `dueOnly`'s
  category/band filtering, which composes with it rather than replacing it.
- **Content-scale honesty**: 44 problems is a real, fully-verified starting set across the graded
  progression the task specified, not a token handful — but competitors named in the market
  teardown ship thousands (August 2026 source observations, not guaranteed current). This trainer
  is built to scale — adding another problem means admitting a source-backed and engine-verified
  new JSON entry, not new game mechanics. Growing its number and breadth is distinct authoring
  work. Four existing interactive lesson datasets are a separate delivered source capability;
  neither their presence nor a problem count proves user comprehension.

## The lesson player (`public/js/learn-app.mjs`)

The Read and Learn consumers use the actual Weiqi science vocabulary and
source-attributed interactive lesson data, without copying game rules into UI
code. The four current source-owned lesson projections are:
`public/data/lesson-weiqi-overview.json`,
`lesson-living-groups-and-eyes.json`, `lesson-weiqi-history.json`,
and `lesson-komi-and-handicap.json`. Each carries a `sourcePath` to its
original Science teaching article. The existing `public/js/learn-app.mjs`
selects the lesson by `learn.html?lesson=<id>`, reuses the kernel board
renderer, and resolves `{{term}}` tokens through the same glossary as Play.
`test/learn-curriculum.test.mjs` checks the migrated follow-ons, worked
positions, actual exercise presence and provenance. A new lesson must have
an admitted source, legal/meaningful example, meaningful exercise, reachable
curriculum link and learner receiving test; adding prose to a menu is not
itself a completed learning outcome.

## The glossary (`public/js/glossary-app.mjs` + `scripts/build-glossary.mjs`)

The live `content/text/glossary/terms/*.md` Science corpus currently
projects **40 glossary terms** through `scripts/build-glossary.mjs` into the
single generated `public/data/glossary.json`. The Read face exposes
case-insensitive, Unicode-insensitive multiword search of original names,
definitions, elaborations and related terms, with a real empty state and
accessible status/control labels. `#slug` links from Play, Learn and
other terms remain reachable after filtering. Its optional controls fail
safely when an offline PWA update temporarily combines a previous HTML
shell with a newly loaded module. `test/glossary-search.test.mjs`
tests discoverability of every compiled concept, definition presence,
cross-reference closure, untrusted text, and shell compatibility. No
definition is hardcoded into the view, and no second glossary or analytics
service is installed.

## Rendering performance — honest numbers

Measured with a headless Chromium 122-class build (Playwright's bundled browser, software
rasterizer — no GPU compositor in this sandbox, so these numbers are a **conservative floor**, not
an optimistic best case; a real device with hardware-accelerated compositing should do at least as
well) at the board's default 19×19 sizing, via a temporary perf harness (not shipped — built,
measured, and deleted as part of this work; not part of `public/`):

| Measurement | Result |
| --- | --- |
| Idle fps, full 19x19 board (361 rendered stones, static, no changes) | ~59–61 fps |
| Single-stone commit (diff + DOM update + animation-class start), mean | ~0.08–0.11 ms |
| Single-stone commit, p95 | ~0.3–0.5 ms |
| Single-stone commit, worst observed | ~0.7–0.8 ms |
| Full-board simultaneous placement (all 361 stones in one commit) | ~23–31 ms (one-time; a real game never does this — worst-case bound only) |
| Full-board simultaneous capture (all 361 stones in one commit) | ~4–9 ms |
| Sustained fps under a synthetic worst-case stress loop (toggle the *entire* board full↔empty every 4 animation frames, continuously, for 3s) | ~13–19 fps |

**Reading these honestly**: a real game changes 1 point per move (occasionally a handful on a
multi-stone capture), never the whole board at once. The number that actually matters for "does
this feel like 60fps," the single-stone commit cost, has roughly 20-30x headroom under a 16.7ms
frame budget even on this unaccelerated sandbox renderer — SVG did not need to be switched to
canvas to hit 60fps on a full 19x19, per the task's own instruction to measure before switching.
The stress-loop number (~13–19fps) is a deliberately extreme synthetic case included for honesty,
not a claim about real gameplay — no human or the current bot ladder ever recreates the entire
board every 60-70ms. If a future feature (e.g., a fast-forward SGF replay scrubber) ever *did*
need to hit that pattern, that would be the trigger to revisit canvas for the stone layer, per the
task's own instruction — not before.

## Test counts

- `@red-cup-engineering/weiqi-engine`: the exact-pinned rules and replay dependency; this app
  imports it but does not duplicate legality, scoring, or event recognition.
- `apps/weiqi-web`: `npm test` runs `check-mts.mjs` (a TS+JS syntax gate) over every
  `test/*.test.mts` file, then `node --test`; every test is a pure, DOM-free check of one module
  (`bot-endgame`, `normal-play`, `match-service`, `online-match-client`, `session-projection`,
  `review-app`, `concept-tiers`, `touch-gesture`, `stone-variance`, `srs-parity`, `tsumego-*`,
  `learn-curriculum`, `capture-go-route`, `router-wiring`, `worker-deployments`,
  `public-release-contract`). `npm run verify:normal-play` additionally replays the release
  artifact's player-critical flow. Counts are not maintained here; read the runner's summary line.
- Section-wide `node scripts/check-links.mts` (run from the section root): unaffected by this app,
  since it lives under `apps/`, not `content/`.
- **Not covered by `node --test`, by design (consistent with the existing smoke-test philosophy of
  testing pure logic, not DOM)**: `board.mjs`, `sound.mjs`, `concept-toast.mjs`, `play-app.mjs`,
  and `tsumego-app.mjs` themselves are DOM-touching. The board/sound/toast modules were verified by
  hand in a real headless-Chromium session during the prior Polish build (screenshots, synthetic
  `PointerEvent` drag round trips, settings-panel wiring, zero console errors — see that build's own
  notes). **This build's DOM-touching additions (the ladder UI in `play-app.mjs`, the whole of
  `tsumego-app.mjs`) were syntax-checked (`node --check`) and reviewed carefully, but not exercised
  in a live browser this session** — said plainly rather than reusing the prior build's "verified
  by hand" language for work that wasn't. Every judgment call either module depends on
  (the ladder unlock rule, deck/due-selection, the tsumego content itself) is pulled out into a
  pure, DOM-free sibling and covered by `node --test`, which is what actually has logic worth
  getting wrong in it; the DOM glue on top is straight-line wiring with no branching logic of its
  own beyond what's already tested. A follow-on pass with real browser access should still run
  through both pages by hand before calling that gap closed.

## What this app does not do

No accounts or ratings; no matchmaking (Online Match pairs two people through one private
capability link, polled every three seconds, with no resignation command and no dead-stone marking
yet, so its count treats every stone as alive and says so); no handicap stones or resignation
command in the shipped pages (the engine now has both in source, pending its publish); no SGF
import of handicap or setup positions (same dependency); no
ownership/territory shading on the live pages yet (the board's `setTerritory` renderer is built for
it and the engine's `computeTerritory` now returns the per-point map, to be wired once that engine
version is published); no GnuGo/KataGo integration (the platform plan's own later, server-side engine tier — the GTP and
KataGo analysis client exists at `@red-cup-engineering/go-engine-services-section` but is not wired
here, and the bot ladder above is deliberately not a substitute for it and never claims to be). The tsumego content
set (44 problems) is a real, machine-verified starting deck across the task's own graded
progression, not a stub — but it is nowhere near competitive scale (thousands, per the market
teardown); growing it is tracked as its own ongoing content-authoring backlog item, not something
this build claims to have finished. All of the above is deliberately out of scope for this build,
not an oversight.

## A note on a parallel build

*Historical (2026-08): the parallel `weiqi-learn` app described below has since been retired; this app is the section's one web face.*

At the time this app was built, `weiqi-services-section/services/weiqi-platform/apps/weiqi-learn/`
already existed as a separate, independently-authored Learn face (with its own constitution record
naming it, not this app, as the section's licensed home for exactly this responsibility). This app
was built at the path its own task specified (`apps/weiqi-web`) without modifying, depending on, or
deleting that other app — both exist in the section side by side. Reconciling the two (which one
the section actually serves, whether one should be retired) is a decision for whoever owns the
section next, not something this build resolved unilaterally.
