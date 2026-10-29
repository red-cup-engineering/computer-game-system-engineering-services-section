# EVE Online services section — EVE Assist engine

Red Cup Engineering's EVE Online service boundary: the engine and web
application behind **EVE Assist**, a cloud-hosted decision-support tool for
EVE Online players (`https://eve-assist.561.group`).

Governing documents (binding, read before changing anything here):

- `ROADMAP.md` (this package) — status, decisions log, architecture sketch,
  file-ownership assignments, external blockers.
- The product brief / aspirations note, downstream:
  `.../emsenn-eve-online-service/content/text/documents/articles/notes/2026/08/03/2026-08-03-note-on-emsenn-eve-online-aspirations.md`
  ("EVE quant firm": disciplined data collection, cited observations, explicit
  uncertainty, human makes every decision).
- Network conventions:
  `content/text/documents/articles/notes/2026/08/05/2026-08-05-note-on-network-software-design-conventions.md`
  (this package).

## What this is

Decision support, never gameplay automation. The engine is a dependency-free
set of ESM modules — ESI client, EVE SSO login, at-rest encryption, D1-backed
storage, a model-agnostic tool registry, a Gemini-based chat analyst, an SSE
wire codec, a remote MCP server, and a Cloudflare Worker that serves the GUI,
JSON API, and both chat surfaces. It targets both plain Node 24 and the
Cloudflare Workers runtime: no `node:fs`, no `node:http`, no non-Web-API
builtins in `src/` — only `fetch`, `crypto.subtle`, `TextEncoder`, `URL`, and
`ReadableStream`, with every effectful dependency (fetch implementation,
clock, crypto, D1 handle) passed in by the caller.

## Module map (`exports`)

| Import path | File | Provides |
| --- | --- | --- |
| `./esi` | `src/esi/esi-client.mjs` | `createEsiClient`, `EsiError` — authenticated, rate-limit-aware ESI GET client |
| `./esi/endpoints` | `src/esi/endpoints.mjs` | ESI path builders / endpoint catalog |
| `./sso` | `src/sso/eve-sso.mjs` | `buildAuthorizationUrl`, `exchangeAuthorizationCode`, `refreshAccessToken`, `decodeAccessToken` — EVE SSO OAuth2 |
| `./crypto` | `src/crypto/seal.mjs` | `sealSecret`, `openSecret`, `generateKeyBase64`, `hashToken` — AES-GCM-256 at-rest encryption |
| `./db` | `src/db/store.mjs` | `createStore(d1)` — all D1 reads/writes (users, tokens, settings, MCP tokens, observations, chat) |
| `./tools` | `src/tools/registry.mjs` | `toolRegistry`, `getTool`, `ToolError` — the shared tool catalog used by both chat surfaces |
| `./chat` | `src/chat/gemini-analyst.mjs` | `runAnalystTurn` — provider-agnostic tool-calling analyst loop (async generator) |
| `./chat/providers` | `src/chat/providers.mjs` | `getProvider`, `PROVIDER_PRESETS` — the AI-provider adapter registry (`gemini`, `openai-compatible`, `anthropic`) |
| `./chat/sse` | `src/chat/sse.mjs` | SSE framing helpers for the chat wire format |
| `./mcp` | `src/mcp/mcp-server.mjs` | Remote MCP server over Streamable HTTP, backed by `toolRegistry` |
| `./web` | `src/web/worker.mjs` | `createEveAssistWorker()` — the Cloudflare Worker `fetch` handler (routes, GUI passthrough) |
| `./web/session` | `src/web/session.mjs` | `createSessionCookie`, `readSession` — HMAC-signed session cookies |

## Pinned cross-module contracts

These exact shapes are relied on by every module in this package; changing
one is a breaking change across files owned by different agents/sessions —
do not deviate without updating `ROADMAP.md` and every caller.

- **ESI client** (`./esi`): `createEsiClient({ fetchImpl, userAgent, now, baseUrl })`
  → `{ async get(path, { token, query }) }` resolving to `{ data, observation }`
  where `observation = { type: "EsiObservation", path, query, status,
  expiresAt, recordedAt, etag }`. Non-2xx throws `EsiError` (`status`, `path`,
  `errorLimitRemain`, `errorLimitReset`). When `X-ESI-Error-Limit-Remain <= 5`
  the client delays or throws — it never spends the budget to zero.
- **EVE SSO** (`./sso`): `buildAuthorizationUrl` targets
  `https://login.eveonline.com/v2/oauth/authorize`; code exchange and refresh
  both POST `https://login.eveonline.com/v2/oauth/token` with HTTP Basic auth
  and a form body, returning `{ accessToken, refreshToken, expiresAt }`.
  `decodeAccessToken` decodes the JWT payload only (no signature
  verification — this package only ever decodes tokens it minted itself
  server-side) to get `{ characterId, characterName, scopes }`.
- **Encryption at rest** (`./crypto`): `sealSecret`/`openSecret` are AES-GCM-256
  via WebCrypto, format `"v1.<iv b64url>.<ciphertext b64url>"`, a fresh random
  12-byte IV every call. `hashToken` is hex SHA-256, used so MCP bearer tokens
  are stored only as hashes.
- **Storage** (`./db`): `createStore(d1)` wraps a D1Database; see
  `migrations/0001_init.sql` + `migrations/0002_ai_provider.sql` for the
  exact table shapes (`users`, `esi_tokens`, `user_settings`, `mcp_tokens`,
  `observations`, `chat_messages`). Access tokens, refresh tokens, and the
  AI provider key are stored only in sealed form — `user_settings.gemini_key_sealed`
  holds the sealed key regardless of provider (historical column name, not a
  Gemini-only claim; see that migration's comment). `saveAiSettings({userId,
  aiKeySealed, aiProvider, aiBaseUrl, aiModel})` is the provider-agnostic
  write path; `saveGeminiKey` is now a thin delegate to it for backward
  compatibility. `getSettings(userId)` returns both the legacy
  (`geminiKeySealed`, `geminiModel`) and current (`aiKeySealed`,
  `aiProvider`, `aiBaseUrl`, `aiModel`) field names — `aiModel` falls back to
  `geminiModel` for rows written before this migration.
- **Tool registry** (`./tools`): `toolRegistry: Array<{ name, description,
  parameters, handler }>` plus `getTool(name)`. `handler(ctx, args)` returns
  `{ data, observations }`; `ctx = { esi, store, userId, characterId,
  accessToken, fetchImpl, now }`. Bad args or a missing ESI scope throws
  `ToolError` (field `code`). This same registry drives both the built-in
  chat and the remote MCP endpoint — one tool catalog, two adapters.
- **AI provider adapters** (`./chat/providers`): `getProvider(id)` (throws on
  an unknown id) resolves an adapter `{ id, keyLooksValid(key), defaultModel,
  buildRequest({model, systemText, turns, toolDeclarations, baseUrl, apiKey})
  -> {url, headers, body}, parseResponse(json) -> {texts, toolCalls},
  appendModelTurn(turns, rawJson), appendToolResults(turns, results) }`.
  Adapters: `gemini` (v1beta `generateContent`, `x-goog-api-key`; key formats
  `AIza...` and the newer AI-Studio `AQ.` format; default model
  `gemini-flash-latest`), `openai-compatible` (Chat Completions shape —
  covers Groq, OpenRouter, and any self-hosted OpenAI-compatible gateway via
  a per-user `baseUrl`), `anthropic` (Messages API, `x-api-key` +
  `anthropic-version`). `PROVIDER_PRESETS` lists the settings-page starting
  points (Google AI Studio, Groq, OpenRouter, Anthropic, Custom
  OpenAI-compatible) with their model suggestions.
- **Chat analyst** (`./chat`): `runAnalystTurn({ provider, baseUrl, apiKey,
  model, history, userText, ctx, fetchImpl, maxSteps })` is an async
  generator yielding `{type:"text"}`, `{type:"tool_call"}`,
  `{type:"tool_result"}`, `{type:"done", history}`, `{type:"error"}` —
  identical regardless of which provider answers. `provider` defaults to
  `"gemini"`; a falsy `model` or the retired `"gemini-2.5-flash"` default
  falls back to the selected adapter's `defaultModel`. `history`/`done`'s
  `history` are the provider's own opaque conversation-turn array (Gemini
  `contents`, OpenAI-compatible/Anthropic `messages`) — only the matching
  adapter interprets its shape. Loops tool calls against `toolRegistry`
  until none remain or `maxSteps` is hit; an HTTP 429 yields an `{type:
  "error"}` event naming the provider's rate limit rather than throwing.
- **SSE wire** (`./chat/sse`, used by `POST /api/chat`): headers
  `content-type: text/event-stream`, `cache-control: no-cache`,
  `x-accel-buffering: no`; each frame is `event: <type>\ndata: <json>\n\n`,
  one frame per `runAnalystTurn` event.
- **Sessions** (`./web/session`): `createSessionCookie({userId, secret, now,
  ttlSeconds})` returns a `Set-Cookie` value for cookie `eve_assist_session`
  (`HttpOnly; Secure; SameSite=Lax; Path=/`), value
  `"<payload b64url>.<hmac b64url>"` (HMAC-SHA256). `readSession(request,
  secret, now)` returns `{userId}` or `null`.
- **Worker** (`./web`): `createEveAssistWorker()` → `{ async fetch(request,
  env, ctx) }`. Routes: `GET /auth/login`, `GET /auth/callback`,
  `POST /auth/logout`, `GET /api/me`, `GET /api/dashboard`,
  `POST /api/settings/gemini-key`, `GET`/`POST /api/settings/mcp-tokens`,
  `POST /api/settings/mcp-tokens/revoke`, `POST /api/chat` (SSE),
  `POST`/`GET`/`DELETE /mcp` (per-user bearer auth against `mcp_tokens`
  hashes). Everything else falls through to `env.ASSETS.fetch(request)`.

## AI provider settings

`POST /api/settings/gemini-key` — path kept stable for backward
compatibility, but the body now accepts any provider:

```json
{ "key": "...", "provider": "gemini|openai-compatible|anthropic", "baseUrl": "https://...", "model": "..." }
```

- `provider` defaults to `"gemini"` (so a pre-refactor client sending only
  `{ key, model }` keeps working unchanged).
- `key` is checked against that provider's `keyLooksValid` (`./chat/providers`)
  — never echoed back, including in the 400 error body, which only names
  which check failed.
- `baseUrl` is required, and must start with `https://` with no trailing
  slash, iff `provider === "openai-compatible"` (Groq, OpenRouter, or a
  self-hosted OpenAI Chat Completions-compatible gateway); ignored for
  providers with a pinned URL (`gemini`, `anthropic`).
- `model` defaults to the resolved provider's `defaultModel`.
- On success the key is sealed (`./crypto`) and written via
  `store.saveAiSettings`. `GET /api/me` reports both `hasAiKey` and (mirroring
  it) `hasGeminiKey`, so any client still reading the pre-refactor field name
  does not see AI chat as permanently locked.

The settings page (`public/settings.html` + `public/settings.js`) offers a
provider dropdown seeded from a browser-side mirror of `PROVIDER_PRESETS`
(Google AI Studio, Groq, OpenRouter, Anthropic, Custom OpenAI-compatible),
auto-fills the base-URL field for non-custom `openai-compatible` presets
(editable only for Custom), offers each preset's model suggestions via a
`<datalist>`, and shows a per-provider key placeholder plus a "where to get
a key" link (aistudio.google.com/apikey, console.groq.com/keys,
openrouter.ai/settings/keys, console.anthropic.com).

## Environment / Worker bindings

The Worker (`./web`) requires, at deploy time:

| Binding | Kind | Purpose |
| --- | --- | --- |
| `DB` | D1 database | all persistent state (see `./db`) |
| `SESSION_SECRET` | secret | HMAC key for session cookies |
| `SEAL_KEY` | secret | AES-GCM key (base64) for `./crypto` at-rest sealing |
| `EVE_SSO_CLIENT_ID` | secret | EVE SSO application client id |
| `EVE_SSO_CLIENT_SECRET` | secret | EVE SSO application client secret |
| `PUBLIC_URL` | var | `https://eve-assist.561.group` — used to build the SSO redirect URI |
| `EVE_USER_AGENT` | var | descriptive User-Agent sent on every ESI request |

None of these are read, logged, or echoed by application code outside the
modules that need them; secret material is never written into observation
records or logs.

## Behavioral guarantees

1. **Read-only against the game world.** No tool in `toolRegistry` calls a
   write-scope ESI endpoint. Login requests only the eight pinned read
   scopes below — nothing that pilots, trades, or messages on the player's
   behalf.
2. **Provenance on every retrieval.** Every ESI call returns an `observation`
   (source path, query, HTTP status, `Expires`-derived `expiresAt`, the
   moment it was recorded, and the `ETag` if present); tool handlers pass
   these through in `{ data, observations }` so the chat analyst can cite
   exactly what it saw and when.
3. **Bring-your-own-key, any supported provider.** The GUI and dashboards
   work with no AI key configured; the chat analyst only runs once a user
   has saved their own key via `POST /api/settings/gemini-key` for the
   provider of their choice (Google AI Studio/Gemini, Groq, OpenRouter,
   Anthropic, or a self-hosted OpenAI-compatible gateway — see "AI provider
   settings" above), and it is billed against that key, not a shared one.
4. **Encryption at rest.** ESI access/refresh tokens and the user's AI
   provider API key are stored only as `sealSecret` output (AES-GCM-256,
   per-secret random IV); MCP tokens are stored only as their SHA-256 hash
   (`hashToken`) — the raw token is shown to the user exactly once, at
   mint time.
5. **ESI error-limit respect.** The ESI client tracks
   `X-ESI-Error-Limit-Remain`/`-Reset` on every response and backs off (or
   throws `EsiError`) once remaining budget drops to 5 or below, rather than
   racing the limit to zero and getting the caller's IP banned.

### Pinned ESI scopes (v1)

```text
esi-wallet.read_character_wallet.v1
esi-skills.read_skills.v1
esi-skills.read_skillqueue.v1
esi-location.read_location.v1
esi-location.read_ship_type.v1
esi-assets.read_assets.v1
esi-markets.read_character_orders.v1
esi-clones.read_clones.v1
```

## Test / verify

```sh
make package-check  package=lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section
make package-test   package=lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section
make package-verify package=lib/emsenn/services/561-group/services/engineering-services-section/services/computer-engineering-services-section/services/computer-systems-engineering-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section
```

Equivalent direct calls: `npm run check` (`node --check` over every
`src/*/*.mjs`), `npm test` (`node --test test/*.test.mjs`, fakes for
`fetchImpl`/`now`/`crypto`, no mocking frameworks), `npm run check && npm run test` (both).
No dependencies — the engine is dependency-free by design.

## Status

v1 scaffold under construction 2026-08-05; not yet deployed. See
`ROADMAP.md` for the live decisions log, file-ownership assignments, and
external blockers (EVE SSO application registration pending).
