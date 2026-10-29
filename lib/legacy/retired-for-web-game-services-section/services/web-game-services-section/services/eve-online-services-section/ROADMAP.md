# EVE Assist — roadmap and coordination document

Status: pre-implementation. Recon research and an architecture document are in
progress; this file is the durable home for decisions and ideas so they survive
across sessions and agents. Last updated 2026-08-05.

## What this is

A cloud-hosted web application at <https://eve-assist.561.group>: a rich GUI for
EVE Online players (Morgan is the first user, and a newbie — that's the design
center) plus an AI research assistant. Decision support, never gameplay
automation. The governing product brief is the aspirations note in the
downstream package:
`.../emsenn-eve-online-service/content/text/documents/articles/notes/2026/08/03/2026-08-03-note-on-emsenn-eve-online-aspirations.md`
("EVE quant firm": disciplined data collection, cited observations, explicit
uncertainty, human makes every decision).

Code ownership:

- `@red-cup-engineering/eve-online-services-section` (this package) — the
  engine and application: ESI client, analysis modules, tool registry, chat
  backend, web GUI, Worker entry.
- `@561-group/personal-eve-online-service` (downstream, under
  public-services-section) — Morgan's personal interface: notes, goals,
  personal configuration, first-user feedback.
- `sites/eve-assist.561.group/` — the colocated deployable carrier: Wrangler
  config, deployment migrations, and built assets.

## Product principles (from the aspirations note — binding)

1. Decision support, not decisions. No automation of piloting, trading,
   messaging, or anything in-game. Read-only against the game world.
2. Every retrieved fact carries provenance: source, timestamp, identifiers,
   assumptions. The AI cites what it retrieved and separates retrieval from
   inference.
3. The AI may say "I don't know" / "the data is insufficient" and is prompted
   to prefer that over confident invention.
4. Different sources have different authority (API observation ≠ wiki ≠ forum
   post); don't flatten them.
5. Small products that produce genuine player benefit now, on a shared
   foundation, over a grand system later.

## Decisions so far (append-only, dated)

- 2026-08-05 — Host on Cloudflare Workers on the existing 561.group zone;
  D1 for storage; headless deploys via the scoped API tokens already in the
  environment (`API_KEY_CLOUDFLARE_WORKERS_EDIT`, `..._D1_EDIT`, `..._DNS_EDIT`,
  with `CLOUDFLARE_ACCOUNT_ID`). Verified working; only `wrangler whoami`
  needs the OS keyring, which we avoid.
- 2026-08-05 — Login is EVE SSO (OAuth2). Logging in *is* granting ESI scopes;
  no separate password system. Requires registering an application at
  developers.eveonline.com (client id/secret, callback
  `https://eve-assist.561.group/auth/callback`) — Morgan action, pending.
- 2026-08-05 — AI chat is bring-your-own-key: a user who adds their own
  Gemini API key (stored encrypted at rest, never shown to anyone) gets the
  assistant. GUI and dashboards work without any AI key.
- 2026-08-05 — The tool registry is model-agnostic and belongs to the app,
  not to any particular assistant. Tools are defined once (name, JSON-schema
  parameters, handler) and exposed through adapters. Frontend #1: Gemini
  function-calling for the built-in chat. Frontend #2: a remote MCP endpoint
  on the Worker so players' *own* assistants can use EVE Assist as their
  toolbelt. Explicitly NOT: registering anything into local Claude config on
  this machine — the consumer is whatever AI the *user* talks to.
- 2026-08-05 — Remote MCP endpoint (e.g. `/mcp`, Streamable HTTP) authed by a
  per-user token minted on the settings page, revocable. Full OAuth-for-MCP
  can come later.
- 2026-08-05 — `ask_analyst` meta-tool: an MCP-exposed tool that runs the
  internal tool-using analyst loop server-side (on the user's own AI key) and
  returns a cited briefing. External assistant delegates to the in-house
  quant desk. Only enabled when the user has an AI key configured. Target:
  after the internal chat loop is proven (v1.5).
- 2026-08-05 — Visual identity: the current 561.group theme (bone/ink OKLCH
  palette, Space Grotesk / Roboto Slab / JetBrains Mono, dot-grid texture,
  light+dark). Source:
  `.../engineering-services-section/lib/legacy/2026-08-03-red-cup-engineering-corpus/2026-07-02-561-group-website-theme/src/index.mts`
  and the live `sites/561.group/public/index.html`. Self-hosted fonts, no CDN.
- 2026-08-05 — Network conventions are binding and documented in
  `content/text/documents/articles/notes/2026/08/05/2026-08-05-note-on-network-software-design-conventions.md`
  (in this package). Operative highlights: ESM `.mjs`; vanilla-first
  dependencies (node builtins → internal packages → rare external);
  package scripts `check` (node --check per file) / `test` (node --test) /
  `verify` (both) so `make package-*` targets work; strict input validation
  with greppable thrown errors; atomic staged mutations producing typed JSON
  receipts; secrets via env with named-variable guards, never logged;
  `content/` (durable records) vs `data/` (regenerable, gitignored); README
  as operational contract; derive status, never assert it; this package
  publishes as `@red-cup-engineering/...`, the personal `@emsenn/...` package
  stays a leaf consumer (the registry refuses `@emsenn/*` publishes).

- 2026-08-05 — Recon architecture doc landed and is preserved at
  `content/text/documents/articles/notes/2026/08/05/2026-08-05-note-on-eve-assist-architecture.md`
  (7-agent research workflow). Reconciliation: its local-stdio-MCP suggestion
  is overruled by Morgan's earlier correction (no local Claude MCP; the tool
  registry serves the *user's* AI); `custom_domain: true` for
  eve-assist.561.group confirmed; ESI path question settled by live curl —
  bare paths with X-Compatibility-Date AND `/latest/` both return 200; v1
  ships `/latest/` (already built), header migration is a follow-up; chat
  history persists in D1; Gemini free-tier limits are never hardcoded —
  surface 429s and link users to aistudio rate-limit docs.
- 2026-08-05 — Git plumbing repair, round 1 complete: the EVE submodule
  chain (9 gitlink pairs incl. the mud-services legacy subtree) fixed after a
  directory rename stranded `gitdir:` pointers; content verified unchanged,
  backups + manifest in session scratchpad. Round 2 in progress: ~26 more
  same-pattern breaks across computer-services-section being repaired; known
  deeper issues (data-services-section store HEAD, capability-pricing-service
  divergence, four uninitialized web-services placeholders) documented and
  deliberately untouched.
- 2026-08-05 — Git plumbing repair, round 2 complete: all ~26 same-pattern
  breaks across computer-services-section now verified fixed (recorded
  gitlink commit = store HEAD for every one; audit trail of pre-fix values in
  session scratchpad `audit_pre_fix_record.txt`). `git status` runs cleanly
  at computer-services-section, web-services-section,
  engineering-services-section, and the superproject root — all four
  previously failed outright. Deliberately untouched, needing separate
  investigation: data-services-section (store HEAD unresolvable),
  capability-pricing-service (real history divergence), and four
  never-initialized placeholder submodules under web-services-section.
- 2026-08-05 — Provider-agnostic analyst: the built-in chat analyst is no
  longer Gemini-only. `src/chat/providers.mjs` defines a pinned adapter
  interface (`keyLooksValid`, `defaultModel`, `buildRequest`,
  `parseResponse`, `appendModelTurn`, `appendToolResults`) implemented for
  `gemini` (v1beta `generateContent`; accepts both legacy `AIza...` and the
  newer AI-Studio `AQ.`-format keys; default model bumped from the now-404ing
  `gemini-2.5-flash` to the rolling alias `gemini-flash-latest`, both
  verified live 2026-08-05), `openai-compatible` (Chat Completions shape —
  covers Groq and OpenRouter via a per-user `baseUrl`, plus any self-hosted
  gateway), and `anthropic` (Messages API). `src/chat/gemini-analyst.mjs`
  keeps its filename (every caller's import path) and its exact yielded SSE
  event contract (`text`/`tool_call`/`tool_result`/`done`/`error`) but now
  drives the adapter loop generically instead of hardcoding Gemini's wire
  format. `POST /api/settings/gemini-key` (path kept stable) now accepts
  `{ key, provider?, baseUrl?, model? }`; D1 gained
  `migrations/0002_ai_provider.sql` (`ai_provider`/`ai_base_url`/`ai_model`
  columns on `user_settings`; `gemini_key_sealed` keeps its name — historical,
  not a Gemini-only claim — and holds the sealed key for whichever provider
  is configured). GUI/SSE wire unchanged; see the engine README's "AI
  provider settings" section for the full contract.

- 2026-08-05 — Live bug fix: batch name resolution + a per-invocation
  subrequest budget. Origin: Cloudflare Workers' free plan caps a single
  Worker invocation at 50 external subrequests, and one chat turn = one
  invocation. Tool handlers resolved every id (skill/asset type, system,
  station, wallet-journal party) to a display name with its own ESI GET;
  `get_character_overview` cost ~7 fetches, and `get_skills` (one GET per
  distinct trained skill type) blew straight through the cap in production
  ("Too many subrequests by single Worker invocation"). Fix: `src/esi/
  endpoints.mjs` gained `universeNames(ids)` (POST `/universe/names/`, up to
  1000 mixed ids — characters, corporations, types, systems, stations — per
  call); the pre-existing `esi-client.mjs` `request()` method already
  supported POST bodies, so no client change was needed there. New `src/esi/
  name-resolver.mjs` (`createNameResolver({ esi }) -> { resolve(ids) ->
  { names: Map, observations } }`) dedupes, memoizes per resolver instance,
  chunks over 1000 ids, and — since ESI 404s a *whole* batch if any id in it
  is unresolvable — bisects to isolate bad ids under a hard recovery-attempt
  budget (so an all-bad chunk can't degrade toward one subrequest per id).
  `src/web/worker.mjs`'s `buildToolCtx` wires one fresh resolver per
  invocation into `ctx.names` (shared by chat, dashboard, and MCP, since all
  three build ctx through `buildToolCtx`) and wraps `ctx.fetchImpl` in a
  40-fetch soft budget that throws a greppable
  `Error("subrequest budget exhausted (N)")` before Cloudflare's hard cap
  kills the invocation mid-stream; the existing tool-call loop in
  `src/chat/gemini-analyst.mjs` already converts any thrown tool error into a
  `tool_result` SSE event, so this surfaces to the model/player instead of
  truncating the response (verified by a new test). Every per-id name lookup
  in `src/tools/character-tools.mjs` was refactored to collect ids first and
  make one batched `ctx.names.resolve()` call: `get_character_overview`
  5 subrequests worst case (was ~7), `get_skill_queue` 2 (was 1+N),
  `get_wallet_journal` 2 (party names are new — previously unresolved),
  `get_assets_summary` up to 4 (was up to 1+2N, now also resolves location
  names, new). `get_skills` is 2 subrequests regardless of trained-skill
  count (was 1+2N, the tool that broke production) — its prior per-skill
  category/group bucketing was dropped rather than kept via a fabricated
  skill-type-to-group table, since ESI has no batched type→group endpoint
  and inventing one would violate this project's evidence-provenance
  principle; `data.note` on the tool's output says so. `src/tools/
  market-tools.mjs` needed no per-id-lookup refactor (its tools mostly take
  ids as arguments already); `get_route`'s per-system GET loop and
  `compare_hubs`'s up-to-25-subrequest hub pagination are documented in that
  file as known, deliberately untouched risks (route length is uncapped;
  order-book pagination has no batch ESI alternative). Full `npm run check && npm run test`
  green: 400 tests passing (17 new/changed across
  `test/name-resolver.test.mjs` (new, 10), `test/character-tools.test.mjs`
  (rewritten fakes, net +3), `test/endpoints.test.mjs`, `test/esi-client.
  test.mjs`, `test/gemini-analyst.test.mjs`, and `test/worker.test.mjs`
  (+1 each)).

## Ideas inbox (nothing here is lost; promote to Decisions when adopted)

From Morgan:

- 2026-08-05 — A standardized serialization of EVE data, with real schemas,
  as the interchange layer for our own EVE app ecosystem: canonical typed
  records (network receipt convention: `type` + version + provenance
  envelope) with JSON Schemas, so every consumer — web app, MCP clients,
  ledger tools, later scripts — reads and writes the same shapes. Built for
  robustness and improvement over time, not just speed.
- 2026-08-05 — EVE↔Beancount and EVE↔hledger export: wallet journal (and
  eventually market/industry activity) serialized as double-entry plain-text
  accounting. The network already has beancount/hledger tooling elsewhere —
  find and match its conventions (research in progress). Sketch: commodity
  ISK; accounts like `Assets:EVE:<Character>:Wallet`,
  `Income:EVE:<ref-type>`, `Expenses:EVE:<ref-type>`; both exporters
  generated from the same canonical wallet-journal records. Likely home: a
  `src/records/` module + `lib/schemas/*.schema.json` in this package
  (divination-services-section precedent), splittable into its own package
  once stable.

- Anyone can use the GUI after logging in; own API keys unlock AI chat.
- Meet-or-beat the daily-driver value of existing supplemental tools
  (zKillboard, market sites, skill planners, fitting tools) for a new player.
- Players' own assistant AIs connecting over MCP "would be loved" — external
  assistant real-time against the app.
- External MCP endpoint able to talk to the internal analyst (`ask_analyst`).
- Use this project as the occasion to improve Claude↔network plumbing
  (first installment: the submodule repair, in progress).

From Claude (proposed, not yet adopted — see "Proposed features" below for
detail): post-session debrief, loss autopsy, undercut alerts, "am I safe
here" system check, goal ledger with outcome recording, session journal as
first-class evidence, ISK/hour by activity, glossary/mentor mode, daily
briefing page, observation export.

- 2026-08-05 — Wave 2 (Morgan): next-gen features + better UI, and the
  underlying tooling written as parameterizable, extraction-ready generic
  libraries for reuse across future network sites: `src/addressing/`
  (canonical JSON, content ids, record identity — network journal
  convention), `src/ledgering/` (generic double-entry engine + beancount and
  hledger serializers, commodity-agnostic), `src/charting/` (dependency-free
  isomorphic SVG charts, themeable, 561 palette default), `src/cataloging/`
  (typed keyed collections with facets), `src/graphing/` (nodes/edges,
  shortest path, DOT/JSON). Hard rule: these modules import nothing
  EVE-specific — EVE adapters live in `src/records/` and app wiring. Each is
  a future `@red-cup-engineering/*` package; extraction is a later mechanical
  move.
- 2026-08-05 — The GUI becomes a registry frontend like the others: generic
  session-authed `POST /api/tools/{name}` invokes the same tool registry the
  chat model and MCP clients use. New pages (market, assets, map/route) call
  tools through it; provenance shows in the UI everywhere.

## Provisional architecture (to be superseded by the recon architecture doc)

Single Worker at eve-assist.561.group serving:

- static GUI (Worker `assets`, per sibling site convention),
- JSON API (`/api/...`) — session-cookie authed,
- EVE SSO routes (`/auth/login`, `/auth/callback`),
- chat endpoint with SSE streaming (`/api/chat`),
- remote MCP endpoint (`/mcp`) — per-user bearer token.

D1 tables (sketch): users, characters, esi_tokens (AES-GCM encrypted at rest,
key from Worker secret), user_settings (encrypted AI key, MCP tokens),
observations (cached ESI facts with source+timestamp+expiry), chat threads.

ESI access layer: shared client honoring the error-limit headers and Expires
caching, descriptive User-Agent, every fetch recorded as an observation.

## Reuse targets (found 2026-08-05 by code archaeology; imitate, adapt, port)

- SSE codec: `.../http-services-section/services/computing-with-http/src/codecs/sse/`
  (`sseHeaders`/`sseFrame`/`parseSseStream`) — port near-verbatim.
- SSE hub with heartbeat/broadcast: legacy `ruinfold/server/sse.mjs`.
- Chat console shape (SSE `/events` + POST `/say` + EventSource client):
  legacy `organizing-with-the-living-web/src/swarm-console/index.mts`.
- Tool-use loop skeleton (append tool-calls turn → execute → tool-result turn
  → repeat, with maxSteps/maxTokens stops): legacy `swarm/src/agent-loop.mjs`
  and `tool-call.mjs` — strip governance machinery, adapt wire format to
  Gemini functionCall/functionResponse parts.
- Gemini REST wrapper: `.../emsweb/services/youtube-channel-enterprise/src/lib.mjs`
  (`x-goog-api-key`, v1beta generateContent, AbortSignal.timeout).
- OAuth client flow: `.../google-drive-use-team/src/google-oauth-refresh.mjs`
  (refresh exchange) and `.../alpaca-.../src/alpaca-connect-oauth.mjs`
  (authorize URL + state CSRF + code exchange + injected custody store).
- Worker factory + env-guard pattern:
  `.../software-sandbox-execution-service/src/worker.mjs`
  (`createX(deps) => fetch(request, env)`, `configured(env)` secret check).
- wrangler config patterns: `sites/561.group/wrangler.jsonc` (assets+route),
  koios.news (`html_handling`, `not_found_handling`), mathematical-readout-
  exchange (`nodejs_compat`, `observability`).
- Hygiene discipline: `credentialMaterialRecorded: false` pattern — secret
  material never appears in logs or observation records.

Known gaps (write fresh): EVE SSO specifics, AES-GCM encryption-at-rest
utility (WebCrypto), Gemini function-calling wire format, MCP server over
Streamable HTTP, all D1 usage (first D1 in the network).

## External dependencies / blockers

- EVE SSO application registration at developers.eveonline.com (needs Morgan's
  EVE account; produces client id + secret → Worker secrets). Until then, SSO
  code ships behind config and can be exercised with a mock.
- Users' own Gemini API keys (Morgan's own key, for first use).

## Coordination rules for agents working here

- This file is the shared memory. Read it before designing or building.
  Append decisions with dates; never delete ideas — move them or mark them
  superseded. Keep provenance (who proposed, when, where recorded).
- Respect repo policy in /home/emsenn/info/AGENTS.md (notably: never stage
  deletion of a gitlink; preserve working-tree material; ordinary software
  vocabulary).
- File-level ownership during implementation is assigned in the architecture
  doc's task breakdown — don't edit files outside your assignment.
- Secrets: only via environment / Worker secrets; never committed, never
  logged, never in observation records.

## Proposed features (Claude's additions, 2026-08-05 — for Morgan to react to)

Ranked roughly by newbie value per unit of build cost:

1. **Post-session debrief / "since you were gone".** On login: skill training
   completed, wallet delta with journal highlights, orders filled or expired,
   assets changed. ESI-only, high daily-driver value, cheap.
2. **Loss autopsy.** On a ship loss: pull the killmail, explain in plain
   language what killed you and why (weapon types, likely fit of attackers),
   critique your fit for its stated purpose, and produce a replacement
   shopping list priced at your current market hub. Newbies learn most from
   losses; nothing mainstream does this end-to-end.
3. **"Am I safe here?"** For current/target system: recent kill activity
   (zKillboard public API), gate-camp signature detection on your route,
   security status explained. One glance before undocking.
4. **Goal ledger with outcomes.** Player states goals ("fly a Retriever",
   "200M ISK for a battlecruiser"); the app tracks measurable progress and —
   the quant-firm loop — records what happened after decisions, so advice
   quality becomes inspectable over time.
5. **Session journal as evidence.** Free-text player notes ("lost Venture to
   gank in Tama, felt slow to warp") stored as first-class records with
   timestamps, retrievable by the analyst alongside API observations. This is
   the aspirations note's "player-authored notes are first-class input" made
   concrete.
6. **Undercut / order watch.** Your open market orders vs current best price;
   flag when undercut. Newbie-trader table stakes that normally requires a
   separate tool.
7. **ISK/hour by activity.** Infer sessions from location history + wallet
   journal; attribute income to mining/missions/trading windows. Rough is
   fine; even a crude number teaches newbies what their time is worth.
8. **Glossary / mentor mode.** Hover-explanations of EVE jargon in every
   briefing, citing EVE University wiki pages. The assistant already needs
   this corpus; surfacing it in the GUI is nearly free.
9. **Daily briefing page.** One page composing debrief + queue status + order
   watch + goal progress; the page you check at breakfast. (Later: the same
   briefing as an MCP resource so your own assistant reads it.)
10. **Observation export.** CSV/JSON export of your own observation store —
    your data is yours; also makes the app a data source for spreadsheet
    players rather than a competitor to them.

Deliberately deferred: fitting simulation (Pyfa-class dogma math is a huge
dependency; link out or wrap a library later), industry chain planning,
corp/alliance tooling, any write-scope ESI.
