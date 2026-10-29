<!-- Provenance: produced 2026-08-05 by the eve-assist-recon-design workflow's architect agent (7-agent run: six researchers + synthesis). Epistemic status: implementation-ready DRAFT, partially superseded by ROADMAP.md decisions — notably: NO local stdio MCP registration (Morgan's explicit correction overrules conflict #1 in this doc); ESI bare-vs-latest path question (conflict #3) settled by live verification the same day: both work, v1 ships /latest. The parallel build workflow was launched from the ROADMAP contracts before this doc landed; where they disagree, ROADMAP + shipped code win. -->

# EVE Assist — Architecture Document (v1)

Status: implementation-ready draft. Written against the six research briefings, the existing `ROADMAP.md` coordination doc found in the engine package, the product brief, and live inspection of this checkout's conventions and submodule health.

Contact/User-Agent identity used throughout: `morgan.sennhauser@gmail.com`.

---

## Conflicts and assumptions flagged for Morgan (read this before implementing)

1. **Local stdio MCP registration.** The task brief asks to register the tool registry as a local stdio MCP server in `/home/emsenn/info/.mcp.json`. The engine package's own `ROADMAP.md` (dated the same day, 2026-08-05) records a contrary decision: *"Explicitly NOT: registering anything into local Claude config on this machine — the consumer is whatever AI the user talks to,"* preferring a remote Streamable-HTTP `/mcp` endpoint for v1.5 instead. This document ships **both**, because the underlying registry is transport-agnostic and the marginal cost of a stdio adapter is small: local stdio MCP is included in the v1 cut (satisfies the explicit ask, and AGENTS.md's "don't add MCP deps unless explicitly requested" bar is met by this task itself), the remote HTTP endpoint stays v1.5 per the ROADMAP. **Before Task F actually edits `.mcp.json`, get Morgan's explicit go/no-go** — that file is shared machine-wide config, not scoped to this package.
2. **Custom Domain vs. zone route.** `sites/561.group` uses a zone-route pattern (`"pattern": "561.group/*", "zone_name": "561.group"`). This doc uses `"custom_domain": true` for `eve-assist.561.group` instead (cf-arch's explicit recommendation for a dedicated subdomain running one Worker — simpler, auto-DNS, auto-cert). This is an intentional deviation from the sibling site's convention, not an oversight. If `eve-assist.561.group` already has a CNAME record from prior experimentation, `custom_domain: true` will fail until that record is removed — check the zone first.
3. **ESI path shape.** The esi-sso briefing's endpoint examples are all written relative to `/latest/...`, but also documents the new `X-Compatibility-Date` header replacing version prefixes, with the stated example `/v1/status/` → `/status/`. It's unstated (and not verified live in the briefing) whether `/latest/status/` and `/status/` are the same alias or need separate handling. This doc adopts bare unversioned paths (`/status/`, `/characters/{id}/skills/`, no `/latest/`) plus the compatibility-date header, per "a 2026-built app should adopt this header from day one." **Verify with one live `curl` against a bare path before Task A ships** — flagged as unverified assumption, not confirmed fact.
4. **Chat history persistence** (the task brief itself flagged this with "chat history?"). Resolved: yes, persist (`chat_threads`/`chat_messages` tables below) — cheap, and directly serves the aspirations note's "record of what happened" requirement and citation UI. Cross-thread history browsing UI is deferred; only inline persistence + reload-current-thread ships in v1.
5. **Tool-set breadth vs. "be aggressive" cut instruction.** `get_clones` and `get_industry_jobs` are kept in the v1 tool list even though they rank low on the landscape briefing's newbie-value list, because they cost nothing extra (same ESI-client pattern as everything else already being built). If build time is tighter than expected, these two are the first things to cut — see §10.
6. **No authoritative Gemini free-tier numbers exist** (Google removed the static table). The app must never hardcode RPM/RPD figures; it must surface `429 RESOURCE_EXHAUSTED` gracefully and point users at `aistudio.google.com/rate-limit`. Treat this as a hard design constraint, not a nice-to-have.
7. **Submodule health.** `eve-online-services-section`'s own `.git` pointer file (and its two ancestors) are currently broken (stale `gitdir:` targets referencing a nonexistent `software-services-section` path segment). The object stores are healthy and already at the correct commit — this is a three-line pointer-file fix, zero risk to content — but it must run **before** any task in this doc tries to `git commit` inside that package. See Task 1.

---

## 1. System overview + component diagram

EVE Assist is a single Cloudflare Worker (`eve-assist.561.group`) serving static GUI assets plus a small JSON/SSE API, backed by D1, EVE SSO, ESI, and (per-user, BYOK) the Gemini API. A separate, locally-run stdio MCP process reuses the same tool-registry library for Claude Code sessions on this machine.

```
                                ┌───────────────────────────────┐
                                │   Player's browser              │
                                │   (any device, no install)      │
                                └────────────────┬─────────────────┘
                                                  │ HTTPS
                                                  ▼
                ┌───────────────────────────────────────────────────────────┐
                │  Cloudflare Worker — eve-assist.561.group                   │
                │                                                             │
                │  static assets (public/*)        /api/* /auth/* /mcp/*     │
                │  ────────────────────────        ──────────────────────    │
                │  dashboard.html, chat.html          src/worker.mjs router   │
                │  settings.html, characters.html     ├─ auth routes (SSO)    │
                │  css/, js/, fonts/                   ├─ api routes (JSON)   │
                │  (asset-served directly — Worker      ├─ chat route (SSE)   │
                │   only invoked for the globs at        └─ mcp route (v1.5) │
                │   right, via assets.run_worker_first)                      │
                └───────┬───────────────────┬───────────────────┬───────────┘
                        │                   │                   │
          ┌─────────────┘                   │                   └─────────────┐
          ▼                                 ▼                                 ▼
┌─────────────────────┐        ┌─────────────────────────┐       ┌─────────────────────┐
│  D1 (SQLite)          │        │  EVE SSO                  │       │  ESI                  │
│  users, characters,   │        │  login.eveonline.com      │       │  esi.evetech.net       │
│  esi_tokens (AES-GCM  │        │  /v2/oauth/authorize       │       │  authed + public        │
│  encrypted), user      │        │  /v2/oauth/token            │       │  endpoints               │
│  settings, observations│        └─────────────────────────┘       └─────────────────────┘
│  chat_*, mcp_tokens    │
└─────────────────────┘
          │  (chat route only, when the user has stored a Gemini key)
          ▼
┌─────────────────────┐        ┌─────────────────────┐
│  Gemini REST API       │        │  zKillboard (public)   │
│  generateContent /       │        │  kills/losses lookup    │
│  streamGenerateContent    │        │  (cached, batched,       │
│  (BYOK, server-side only) │        │   respects their ToS)    │
└─────────────────────┘        └─────────────────────┘

  Separately, on this machine only (/home/emsenn/info):

┌─────────────────────┐  stdio   ┌───────────────────────────────────┐
│  Claude Code session   │◄────────►│  local eve-tools-mcp server           │
│  (.mcp.json entry —     │          │  scripts/serve-eve-tools-mcp.mjs        │
│  see conflict #1 above)  │          │  same tool registry, direct ESI calls   │
└─────────────────────┘          │  using Morgan's own locally-stored       │
                                    │  refresh token (not the cloud D1)         │
                                    └───────────────────────────────────┘
```

Key property: the **tool registry is the single reusable core** — it doesn't know whether it's being called by Gemini function-calling, a remote MCP client, or a local stdio MCP client. Each frontend is a thin adapter over the same handler functions, and every handler returns a `{data, citations}` envelope so every surface (chat UI, MCP client, dashboard) can show sourced, timestamped facts per the aspirations note.

---

## 2. Repository layout

### 2a. Engine package — `@red-cup-engineering/eve-online-services-section`

Path: `lib/emsenn/services/561-group/services/engineering-services-section/services/computer-services-section/services/computer-systems-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section/`

Plain ESM `.mjs` (matches this package's current `"type": "module"` and the broader convention of flat `src/*.mjs`, `node --test`, `node --check` for `check`, no TypeScript/build step, no ESLint config). `README.md` and `ROADMAP.md` are existing hand-maintained files — do not edit without Morgan's explicit in-conversation authorization.

```
eve-online-services-section/
├── package.json                       # add: scripts.check/test/verify, bin, exports, deps
├── README.md                          # existing — do not edit without authorization
├── ROADMAP.md                         # existing living doc — append decisions, don't rewrite
├── src/
│   ├── index.mjs                      # public re-exports for downstream consumers
│   ├── esi/
│   │   ├── client.mjs                 # fetch wrapper: UA, error-limit + bucket rate limits, ETag cache
│   │   ├── endpoints.mjs              # path builders + scope map (single source of truth)
│   │   └── pagination.mjs             # X-Pages follower, Last-Modified consistency check
│   ├── sso/
│   │   ├── oauth.mjs                  # authorize URL, code exchange, refresh
│   │   ├── jwt.mjs                    # JWKS discovery/cache + verify (iss/aud/exp/sub/scp)
│   │   └── scopes.mjs                 # canonical v1 scope list
│   ├── crypto/
│   │   └── secretbox.mjs              # AES-GCM encrypt/decrypt, HMAC cookie sign/verify
│   ├── db/
│   │   ├── schema.sql                 # canonical schema (mirrored into site migrations/)
│   │   └── queries.mjs                # prepared-statement helpers over a D1 binding
│   ├── tools/
│   │   ├── registry.mjs               # tool definitions, transport-agnostic
│   │   ├── definitions/
│   │   │   ├── character.mjs          # get_character_overview
│   │   │   ├── skills.mjs             # get_skills, get_skill_queue
│   │   │   ├── wallet.mjs             # get_wallet
│   │   │   ├── assets.mjs             # get_assets_summary
│   │   │   ├── location.mjs           # get_location
│   │   │   ├── market.mjs             # get_market_orders_mine, check_market_price
│   │   │   ├── clones.mjs             # get_clones
│   │   │   ├── industry.mjs           # get_industry_jobs
│   │   │   ├── universe.mjs           # resolve_names, plan_route
│   │   │   └── losses.mjs             # get_recent_losses, explain_killmail (zKillboard + ESI)
│   │   ├── gemini-adapter.mjs         # registry -> functionDeclarations[] + dispatch
│   │   └── mcp-adapter.mjs            # registry -> McpServer.registerTool() calls
│   ├── chat/
│   │   ├── gemini-client.mjs          # generateContent/streamGenerateContent wrapper
│   │   └── loop.mjs                   # tool-call loop over contents[]
│   ├── web/
│   │   ├── app.mjs                    # createApp(env) => {fetch} factory
│   │   ├── router.mjs                 # small manual router
│   │   ├── sse.mjs                    # sseHeaders/sseFrame/parseSseStream (ported)
│   │   └── routes/
│   │       ├── auth.mjs               # /auth/login, /auth/callback, /auth/logout, /auth/link
│   │       ├── api.mjs                # /api/dashboard, /api/characters, /api/settings
│   │       ├── chat.mjs               # /api/chat (SSE)
│   │       └── mcp.mjs                # /mcp — v1.5, stub in v1
│   └── newbie/
│       └── guidance.mjs               # deterministic "what should I do next" rules (no AI)
├── scripts/
│   ├── serve-eve-tools-mcp.mjs        # stdio MCP entry point ("bin")
│   └── eve-local-login.mjs            # one-time local OAuth loopback for the stdio server's own token
└── test/
    ├── esi-client.test.mjs
    ├── sso-oauth.test.mjs
    ├── crypto-secretbox.test.mjs
    ├── tools-registry.test.mjs
    └── chat-loop.test.mjs
```

`package.json` additions (illustrative, not exhaustive):
```json
{
  "scripts": {
    "check": "node --check src/**/*.mjs && node --check scripts/*.mjs && node --check test/*.mjs",
    "test": "node --test test/",
    "verify": "npm run check && npm test"
  },
  "bin": { "eve-tools-mcp": "./scripts/serve-eve-tools-mcp.mjs" },
  "exports": { ".": "./src/index.mjs" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.0.0"
  },
  "engines": { "node": ">=22.18" }
}
```

### 2b. Site dir — `sites/eve-assist.561.group/`

Path: `lib/emsenn/services/561-group/services/engineering-services-section/services/computer-services-section/services/computer-systems-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section/sites/eve-assist.561.group/` (colocated with the EVE Online engine package; the app needs a real Worker script — see conflict #2).

```
eve-assist.561.group/
├── package.json            # depends on @red-cup-engineering/eve-online-services-section (private registry)
├── wrangler.jsonc           # see §9
├── migrations/               # deployment-owned; copied/kept in sync with engine's src/db/schema.sql
│   └── 0001_init.sql
├── src/
│   └── worker.mjs             # thin: import { createApp } from the engine package; export default
└── public/
    ├── index.html              # login/landing (public)
    ├── dashboard.html           # authed newbie home
    ├── characters.html          # linked-characters list + add-character
    ├── settings.html             # Gemini key, model, disclosure ack
    ├── chat.html                  # AI chat (requires Gemini key)
    ├── css/site.css                # ported 561.group OKLCH theme, "EVE ASSIST" folio
    ├── js/
    │   ├── dashboard.js
    │   ├── chat.js                    # SSE client (manual TextDecoderStream parse)
    │   ├── settings.js
    │   └── characters.js
    └── fonts/                            # self-hosted Space Grotesk / Roboto Slab / JetBrains Mono
```

`README.md` for this new directory is intentionally **not** authored by this doc or by implementation agents — per AGENTS.md, Morgan hand-writes package READMEs; leave a placeholder note for Morgan rather than generating one.

### 2c. Downstream personal package — `@emsenn/emsenn-eve-online-service`

No runtime code changes required for v1. Its role stays exactly what its README already says: Morgan's personal notes/goals/config, governed by the aspirations note already at `content/text/documents/articles/notes/2026/08/03/2026-08-03-note-on-emsenn-eve-online-aspirations.md`. Future goal-ledger/session-journal features (v1.5+, see ROADMAP's "Proposed features") would read from a new note under the same `content/text/documents/articles/notes/YYYY/MM/DD/` convention — not built in v1.

---

## 3. Data model — D1 schema

One database (`eve-assist`), owned by the site's `wrangler.jsonc` binding `DB`. FK enforcement in D1/SQLite depends on `PRAGMA foreign_keys` being on for the connection — **verify this at implementation time**; don't assume cascade deletes fire without checking.

```sql
-- 0001_init.sql

CREATE TABLE users (
  id                    TEXT PRIMARY KEY,               -- uuid v4
  primary_character_id  INTEGER,                         -- set after first login; not FK-enforced (avoids circular decl)
  gemini_api_key_ct      BLOB,                             -- AES-GCM ciphertext; NULL until user supplies a key
  gemini_api_key_iv      BLOB,                             -- 12-byte IV; NULL until set
  gemini_model            TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  ai_disclosure_ack_at    TEXT,                             -- ISO8601; NULL until user acks the free-tier data-use notice
  created_at              TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE characters (
  character_id   INTEGER PRIMARY KEY,        -- EVE character ID, from the SSO JWT's sub claim
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  corporation_id INTEGER,
  is_primary     INTEGER NOT NULL DEFAULT 0,     -- 0/1
  added_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_characters_user ON characters(user_id);

CREATE TABLE esi_tokens (
  character_id             INTEGER PRIMARY KEY REFERENCES characters(character_id) ON DELETE CASCADE,
  scopes                    TEXT NOT NULL,                  -- space-separated esi-*.v1 scopes actually granted
  refresh_token_ct           BLOB NOT NULL,                    -- AES-GCM ciphertext of the SSO refresh token
  refresh_token_iv           BLOB NOT NULL,
  access_token_ct             BLOB,                             -- cached short-lived access token, ciphertext
  access_token_iv             BLOB,
  access_token_expires_at      TEXT,                              -- ISO8601; refresh when expired/absent/<60s left
  granted_at                    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE observations (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  character_id            INTEGER REFERENCES characters(character_id) ON DELETE CASCADE, -- NULL for public/3rd-party data
  kind                     TEXT NOT NULL,          -- 'esi:skills' | 'esi:wallet' | 'esi:market_orders' | 'zkillboard:losses' ...
  source_url                TEXT NOT NULL,           -- exact endpoint fetched, query params included
  request_params_json        TEXT,                     -- JSON of any params not already folded into source_url
  payload_json                TEXT NOT NULL,             -- the fetched/lightly-normalized JSON
  etag                         TEXT,                       -- ESI ETag, for conditional refetch
  fetched_at                    TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at                    TEXT NOT NULL              -- from the source's Expires header, or a computed TTL
);
CREATE INDEX idx_observations_lookup ON observations(character_id, kind, fetched_at DESC);
CREATE INDEX idx_observations_expiry ON observations(expires_at);

CREATE TABLE chat_threads (
  id         TEXT PRIMARY KEY,     -- uuid v4
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_threads_user ON chat_threads(user_id, updated_at DESC);

CREATE TABLE chat_messages (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id               TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
  role                      TEXT NOT NULL CHECK (role IN ('user','model','tool')),
  parts_json                 TEXT NOT NULL,      -- raw Gemini Content.parts[] for this turn
  cited_observation_ids       TEXT,                 -- JSON array of observations.id this turn drew on
  created_at                   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_messages_thread ON chat_messages(thread_id, created_at);

-- v1.5: remote MCP endpoint auth. Table ships now (cheap), unused until /mcp exists.
CREATE TABLE mcp_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,     -- SHA-256 of the bearer token; raw token shown once at mint time, never stored
  label         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at  TEXT,
  revoked_at    TEXT
);
CREATE UNIQUE INDEX idx_mcp_tokens_hash ON mcp_tokens(token_hash);
```

No `sessions` or `oauth_states` table: session cookies and OAuth `state` are stateless, HMAC-signed (see §4) — deliberately keeping D1 lean and avoiding a hot write path on every request.

---

## 4. Auth flows

### 4a. What Morgan must register at developers.eveonline.com

1. Go to `https://developers.eveonline.com/applications` (requires EVE SSO login).
2. Create an application: name "EVE Assist", connection type = confidential/server-backed (Authentication & API Access).
3. Callback URLs (register **both**):
   - `https://eve-assist.561.group/auth/callback` — the production web flow.
   - `http://127.0.0.1:<port>/callback` — for the local stdio MCP server's own one-time login (§6, §9). Pick a fixed port (e.g. `18717`) so it can be registered as an exact literal.
4. Scopes to tick (must match what the app will ever request in `scope=`; only ticked scopes are grantable):
   ```
   esi-skills.read_skills.v1
   esi-skills.read_skillqueue.v1
   esi-wallet.read_character_wallet.v1
   esi-assets.read_assets.v1
   esi-location.read_location.v1
   esi-location.read_ship_type.v1
   esi-markets.read_character_orders.v1
   esi-clones.read_clones.v1
   esi-industry.read_character_jobs.v1
   ```
5. Registration issues a Client ID (public) and Client Secret (server-side only) → become Worker secrets `ESI_CLIENT_ID` / `ESI_CLIENT_SECRET`.

**Flagged risk (from esi-sso briefing):** the live registration form's exact field names/labels were not directly observed (it redirected to SSO login when fetched). Double-check field labels against the actual form at registration time — the scope list and callback-URL requirement above are the load-bearing facts, not the exact UI wording.

### 4b. Web login end-to-end

1. `GET /auth/login` — Worker builds `state` = a signed, single-use payload `{nonce, mode:'login', exp}` (HMAC-SHA256, base64url), also sets a short-lived `eve_oauth_nonce` HttpOnly cookie holding the raw `nonce` (defense-in-depth CSRF check independent of the signature). Redirects to:
   ```
   https://login.eveonline.com/v2/oauth/authorize
     ?response_type=code
     &client_id=<ESI_CLIENT_ID>
     &redirect_uri=https://eve-assist.561.group/auth/callback
     &scope=<space-separated v1 scopes>
     &state=<signed state>
   ```
2. `GET /auth/callback?code&state` — verify the state signature and expiry, verify the nonce inside it matches the `eve_oauth_nonce` cookie (constant-time compare via `crypto.subtle.verify`), then clear the cookie. POST to the token endpoint:
   ```
   POST https://login.eveonline.com/v2/oauth/token
   Content-Type: application/x-www-form-urlencoded
   Authorization: Basic base64(ESI_CLIENT_ID:ESI_CLIENT_SECRET)

   grant_type=authorization_code&code=<code>
   ```
3. Receive `{access_token, token_type, expires_in, refresh_token}`. Fetch JWKS (via `https://login.eveonline.com/.well-known/oauth-authorization-server` → `jwks_uri`, cached in the Workers Cache API with a ~1h TTL rather than D1, since it's infrequent and doesn't need cross-worker durability). Verify the JWT: `iss` is `https://login.eveonline.com/` (or bare `login.eveonline.com`), `aud` array contains both `ESI_CLIENT_ID` and the literal string `"EVE Online"`, `exp` valid. Extract `character_id` from `sub` (`CHARACTER:EVE:<id>`), `name`, and `scp`.
4. Upsert `users`/`characters`/`esi_tokens` (encrypt `refresh_token` and `access_token` with AES-GCM under the `ENC_KEY` Worker secret, random 12-byte IV per encryption, per row).
5. Mint session cookie `eve_assist_session` = `base64url(JSON{uid, iat, exp}) + "." + base64url(HMAC-SHA256(payload, COOKIE_HMAC_SECRET))`, `HttpOnly; Secure; SameSite=Lax; Path=/`, ~30-day sliding expiry (reissued whenever more than half-expired on an authenticated request).
6. Redirect to `/dashboard`.

**Linking an additional character** (`/auth/link`, same flow with `mode:'link'` baked into the signed state instead of `'login'`): on callback, if the session cookie is present and `mode==='link'`, attach the new character to the existing `user_id` instead of creating a new user.

### 4c. Token refresh

Lazy, per-request: before any authenticated ESI call, check `esi_tokens.access_token_expires_at`; if missing/expired/expiring within 60s, POST to the token endpoint with `grant_type=refresh_token&refresh_token=<decrypted refresh token>` using the same HTTP Basic client auth. **Always persist whatever `refresh_token` comes back** (it may rotate) — re-encrypt and overwrite both tokens + new expiry. No proactive cron refresh in v1 (stateless-per-request lazy refresh is sufficient at this scale).

### 4d. Encryption at rest

- `ENC_KEY` (Worker secret, 32 random bytes, base64): AES-GCM-256 for refresh tokens, access tokens, and Gemini API keys. `crypto.subtle.importKey("raw", ..., {name:"AES-GCM", length:256}, false, ["encrypt","decrypt"])`, fresh random 12-byte IV per encryption via `crypto.getRandomValues`, IV stored alongside ciphertext.
- `COOKIE_HMAC_SECRET` (Worker secret, separate from `ENC_KEY` — different algorithm, different blast radius if leaked): HMAC-SHA256 for session cookies and the OAuth `state` param, verified via `crypto.subtle.verify` (never string comparison).

---

## 5. ESI access layer

`src/esi/client.mjs` is the single fetch surface all tools and dashboard queries go through.

**Every request** carries:
- `User-Agent: EVE Assist/0.1.0 (morgan.sennhauser@gmail.com; +https://eve-assist.561.group)`
- `X-Compatibility-Date: 2026-08-05` (a named constant, reviewed periodically — see conflict #3 for the one open verification item)
- `Authorization: Bearer <access_token>` for character-scoped routes
- `If-None-Match: <etag>` when a cached observation exists for the exact (path, params) pair

**Error-limit handling (legacy system):** read `X-Esi-Error-Limit-Remain` / `X-Esi-Error-Limit-Reset` on every response. Below a safety threshold (e.g. remain < 10), stop issuing non-critical requests until reset; on HTTP 420, hard-stop all ESI calls for the reset window and surface a typed `EsiThrottledError` up to tools/UI ("ESI is rate-limiting us, try again in Ns").

**Bucket rate-limit handling (new system):** read `X-Ratelimit-Group/Limit/Remaining/Used` per response — do not hardcode bucket sizes (only `status`=600/15m and `market-order`=12000/15m were confirmed live; others must be read, not assumed). On 429, read `Retry-After` and back off.

**Caching:** before fetching, check `observations` for a non-expired row matching `(character_id, kind, request_params)`; if fresh, skip the network call entirely. When fetching, always send `If-None-Match` if an etag is on file. A 200 or 304 both produce/update an `observations` row (`source_url`, `fetched_at=now`, `expires_at` from the response's `Expires` header, `etag`, `payload_json` — reused unchanged on 304). This is the mechanism that gives every tool result and dashboard fact its provenance per the aspirations note.

**Pagination:** follow `X-Pages`; if `Last-Modified` changes between pages of one fetch, restart per the docs' explicit warning.

**v1 endpoint/scope set** (aligned 1:1 with the tool registry in §6):

| Endpoint | Scope | Used by |
|---|---|---|
| `GET /characters/{id}/` | none (public) | get_character_overview |
| `GET /characters/{id}/skills/` | `esi-skills.read_skills.v1` | get_skills |
| `GET /characters/{id}/skillqueue/` | `esi-skills.read_skillqueue.v1` | get_skill_queue |
| `GET /characters/{id}/wallet/`, `/wallet/journal/` | `esi-wallet.read_character_wallet.v1` | get_wallet |
| `GET /characters/{id}/assets/` + `POST .../assets/names/`, `.../locations/` | `esi-assets.read_assets.v1` | get_assets_summary |
| `GET /characters/{id}/location/` | `esi-location.read_location.v1` | get_location |
| `GET /characters/{id}/ship/` | `esi-location.read_ship_type.v1` | get_location |
| `GET /characters/{id}/orders/`, `/orders/history/` | `esi-markets.read_character_orders.v1` | get_market_orders_mine |
| `GET /characters/{id}/clones/` | `esi-clones.read_clones.v1` | get_clones |
| `GET /characters/{id}/industry/jobs/` | `esi-industry.read_character_jobs.v1` | get_industry_jobs |
| `GET /markets/{region_id}/orders/`, `/history/` | none (public) | check_market_price |
| `POST /universe/ids/`, `POST /universe/names/` | none (public) | resolve_names |
| `GET /route/{origin}/{destination}/`, `/universe/systems/{id}/` | none (public) | plan_route |
| `GET /killmails/{id}/{hash}/` | none (public, hash required) | explain_killmail |
| zKillboard character kills/losses (third-party) | n/a | get_recent_losses (cached aggressively, batched, identifying UA, per landscape briefing's ToS note) |

---

## 6. Tool registry

10–16 tools, chosen against the landscape briefing's ranked newbie-value list, minus fitting/appraisal/industry-chain (explicitly deferred per ROADMAP and the aspirations note's "small products first"). Params are defined once as a zod raw shape (matching the house MCP-SDK convention already used elsewhere in the repo); the Gemini adapter converts that shape to a JSON-schema `parameters` object. Every handler returns `{ data, citations: [{observationId, source, fetchedAt, expiresAt}] }`.

| # | Tool | Params | Returns (data) | Backing call(s) |
|---|---|---|---|---|
| 1 | `get_character_overview` | `characterId` | name, corp, security status, birthday | ESI public `/characters/{id}/` |
| 2 | `get_skills` | `characterId` | trained skills + levels, attributes | ESI `/skills/`, `/attributes/` |
| 3 | `get_skill_queue` | `characterId` | queue entries, ETA per entry, total idle/queued time | ESI `/skillqueue/` |
| 4 | `get_wallet` | `characterId`, `journalLimit?` | balance, last N journal entries | ESI `/wallet/`, `/wallet/journal/` |
| 5 | `get_assets_summary` | `characterId`, `groupBy?` | assets grouped by location/type with resolved names | ESI `/assets/` + names/locations |
| 6 | `get_location` | `characterId` | current system, station/structure, ship type+name | ESI `/location/`, `/ship/` |
| 7 | `get_market_orders_mine` | `characterId` | active + recent-history orders | ESI `/orders/`, `/orders/history/` |
| 8 | `get_clones` | `characterId` | jump clones, home station, implant sets | ESI `/clones/` |
| 9 | `get_industry_jobs` | `characterId` | active/recent industry jobs | ESI `/industry/jobs/` |
| 10 | `check_market_price` | `typeName` or `typeId`, `regionId?` (default The Forge/10000002) | buy/sell aggregates + 13-month history summary | ESI public `/markets/{region}/orders/`, `/history/` |
| 11 | `resolve_names` | `names[]` or `ids[]`, `direction` | id↔name pairs with category | ESI public `/universe/ids/`, `/universe/names/` |
| 12 | `plan_route` | `originSystem`, `destinationSystem`, `flag?` | system-by-system route + security status per hop | ESI public `/route/{o}/{d}/`, `/universe/systems/{id}/` |
| 13 | `get_recent_losses` | `characterId` or `characterName` | recent kills/losses summary | zKillboard public API (cached ≥15min) |
| 14 | `explain_killmail` | `killmailId`, `killmailHash` | attackers, weapons, victim fit summary (type names resolved) | ESI public `/killmails/{id}/{hash}/` + resolve_names |

The dashboard's "what should I do next" panel (§8) deliberately does **not** call the LLM or a tool — it's a deterministic ruleset in `src/newbie/guidance.mjs` reading straight off `get_skills`/`get_skill_queue`/`get_location`, so the GUI stays useful with no Gemini key at all (per ROADMAP's explicit decision).

---

## 7. Chat backend

Route: `POST /api/chat` (SSE response), session-cookie authed. Requires `users.gemini_api_key_ct` set and `ai_disclosure_ack_at` set (else a 403 pointing at Settings — the app never lets Google process anything before the user has seen the "free-tier chats may be reviewed by Google" notice per the gemini briefing's terms finding).

1. Load or create `chat_threads`/prior `chat_messages`, reconstruct `contents[]` (alternating `role:"user"`/`role:"model"`), append the new user turn.
2. Decrypt the user's Gemini key (AES-GCM under `ENC_KEY`).
3. Call `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse` with header `x-goog-api-key: <decrypted key>`, `tools: [{functionDeclarations: <from gemini-adapter>}]`, `toolConfig.functionCallingConfig.mode: "AUTO"`, `systemInstruction` = the analyst persona (cite sources by observation id, prefer "I don't know" over invention, never suggest automating gameplay — directly encodes the aspirations note's "what it must not become").
4. Relay text-delta chunks to the browser immediately over the Worker's own SSE stream. When a chunk assembles a complete `functionCall` part, pause relay, emit a custom `event: tool-call` SSE frame (so the UI can show "Checking your skill queue via ESI…"), execute the tool(s) through the registry (respecting the ESI client's cache/rate-limit rules from §5), emit `event: tool-result` carrying the `{data, citations}` envelope, append the `functionCall` + `functionResponse` turns to `contents[]`, and re-POST to continue — bounded to a `maxSteps` (e.g. 6) to cap latency/cost.
5. On completion, persist the assistant message and its `cited_observation_ids` to `chat_messages`.
6. Wire hygiene (per cf-arch's confirmed buffering gotchas): return the upstream stream in a **single** `new Response(stream, {headers})` — never re-wrap it through middleware — and set `Content-Encoding: identity` to defeat Cloudflare's edge compression buffering. Port `sseHeaders`/`sseFrame`/`parseSseStream` from `computing-with-http`'s codec rather than reinventing framing.
7. Errors: Gemini `429 RESOURCE_EXHAUSTED` → friendly message pointing at `aistudio.google.com/rate-limit` (never a hardcoded number, per conflict #6); ESI throttling → surfaced as a `tool-result` error envelope with retry timing so the model can honestly say it doesn't know right now.

**UI citation rendering:** each assistant message shows inline footnote markers tied to the `tool-result` events it consumed; a "Sources" strip per message lists `source_url`, `fetched_at`, `expires_at` — small "data as of HH:MM" badges, directly implementing the aspirations note's provenance requirement.

---

## 8. Web GUI

**Tech choice:** static HTML pages (asset-served, no Worker invocation unless matched by `assets.run_worker_first`) + vanilla JS per page, fetching JSON from `/api/*` and rendering into the DOM. No framework, no build step — matches the convention observed across non-TypeScript packages in this repo, and fits cleanly with Workers' assets-first serving model (cheap, fast, no SSR templating needed in the Worker). Shared CSS ports the 561.group OKLCH theme tokens (bone/ink palette, Space Grotesk/Roboto Slab/JetBrains Mono, dot-grid texture, folio-bar chrome relabeled "EVE ASSIST"), self-hosted fonts, light/dark via `prefers-color-scheme`.

**Pages:**

- `index.html` — public landing/login: "Log in with EVE Online" button, one paragraph on what scopes will be requested and why, link to the aspirations-note-derived "what this is / isn't" blurb (decision support, never automation).
- `dashboard.html` — authed newbie home. Character header (portrait via `images.evetech.net/characters/{id}/portrait`, name, corp, security status), skill-queue widget (current training + ETA, queue-length warning if under a day queued), wallet balance + last journal lines, current location + ship, and the **static "what's next" panel** (deterministic rules over `get_skills`/`get_skill_queue`/`get_location` — works with zero AI key). Quick links to Chat and Settings.
- `characters.html` — linked characters, per-character granted-scope summary, "add another character" (re-auth via `/auth/link`).
- `settings.html` — Gemini API key form (masked input; once saved, shows "key set on <date>", never echoes the value back), the unpaid-services disclosure checkbox (must be checked before Chat is reachable), model picker defaulting to `gemini-2.5-flash`, and an MCP-tokens stub marked "coming soon" (v1.5).
- `chat.html` — authed + requires a saved Gemini key. Message list with inline citation markers + a "Sources" strip per message, streaming render via `TextDecoderStream` over the SSE body (native `EventSource` can't POST or set headers, so this is hand-parsed per cf-arch's note), a live "Checking your wallet via ESI…" status line during tool calls.

---

## 9. Deployment

### 9a. `sites/eve-assist.561.group/wrangler.jsonc`

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "eve-assist-561-group-site",
  "main": "src/worker.mjs",
  "compatibility_date": "2026-08-05",
  "workers_dev": false,
  "routes": [
    { "pattern": "eve-assist.561.group", "custom_domain": true }
  ],
  "assets": {
    "directory": "public",
    "binding": "ASSETS",
    "run_worker_first": ["/api/*", "/auth/*", "/mcp", "/mcp/*"],
    "html_handling": "drop-trailing-slash",
    "not_found_handling": "404-page"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "eve-assist",
      "database_id": "<filled in after `wrangler d1 create eve-assist`>",
      "migrations_dir": "migrations"
    }
  ],
  "vars": {
    "ESI_COMPATIBILITY_DATE": "2026-08-05",
    "ESI_USER_AGENT_CONTACT": "morgan.sennhauser@gmail.com",
    "GEMINI_DEFAULT_MODEL": "gemini-2.5-flash"
  },
  "limits": { "cpu_ms": 50000 }
}
```

Note: this Worker's `compatibility_date` (a Cloudflare Workers-runtime concept) and ESI's `X-Compatibility-Date` header (an unrelated CCP API-behavior concept) are two independent dates that happen to share a name — don't conflate them.

### 9b. Secrets (Worker, `wrangler secret put`)

| Name | Purpose |
|---|---|
| `ESI_CLIENT_ID` | EVE SSO application client ID |
| `ESI_CLIENT_SECRET` | EVE SSO application client secret |
| `ENC_KEY` | 32 random bytes, base64 — AES-GCM key for tokens + Gemini keys at rest |
| `COOKIE_HMAC_SECRET` | 32 random bytes, base64 — HMAC key for session cookies + OAuth state |

Gemini API keys are **not** a Worker secret — they're per-user, BYOK, encrypted in D1 (§3, §4d).

### 9c. Headless deploy sequence

Wrangler wants a single `CLOUDFLARE_API_TOKEN`; the scoped tokens already in env map to it per-operation:

```bash
cd lib/emsenn/services/561-group/services/engineering-services-section/services/computer-services-section/services/computer-systems-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section/sites/eve-assist.561.group

# 1. Build & publish the engine package into the private registry first
make package-verify package=lib/emsenn/services/561-group/services/engineering-services-section/services/computer-services-section/services/computer-systems-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section
node /home/emsenn/info/scripts/publish-local-package.mjs \
  --package lib/emsenn/services/561-group/services/engineering-services-section/services/computer-services-section/services/computer-systems-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section \
  --registry data/records/npm/package-registry \
  --registry-url http://127.0.0.1:4873/ \
  --service-unit union-private-package-registry.service

# 2. Install the site package (now resolvable via the private registry)
make package-install package=lib/emsenn/services/561-group/services/engineering-services-section/services/computer-services-section/services/computer-systems-services-section/services/web-services-section/services/web-game-services-section/services/eve-online-services-section/sites/eve-assist.561.group

# 3. Create the D1 database (first run only) — needs D1 Edit scope
CLOUDFLARE_API_TOKEN="$API_KEY_CLOUDFLARE_D1_EDIT" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  npx wrangler d1 create eve-assist
# → paste the printed database_id into wrangler.jsonc's d1_databases[0].database_id

# 4. Apply migrations
CLOUDFLARE_API_TOKEN="$API_KEY_CLOUDFLARE_D1_EDIT" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  npx wrangler d1 migrations apply eve-assist --remote

# 5. Set secrets — needs Workers Edit scope
for NAME in ESI_CLIENT_ID ESI_CLIENT_SECRET ENC_KEY COOKIE_HMAC_SECRET; do
  printf '%s' "${!NAME}" | CLOUDFLARE_API_TOKEN="$API_KEY_CLOUDFLARE_WORKERS_EDIT" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
    npx wrangler secret put "$NAME"
done

# 6. Deploy — creates the Custom Domain route + DNS + cert automatically
CLOUDFLARE_API_TOKEN="$API_KEY_CLOUDFLARE_WORKERS_EDIT" CLOUDFLARE_ACCOUNT_ID="$CLOUDFLARE_ACCOUNT_ID" \
  npx wrangler deploy
```

If step 6 fails because `eve-assist.561.group` already has a CNAME record, remove that record via the dashboard (or `API_KEY_CLOUDFLARE_DNS_EDIT`) first — `custom_domain: true` cannot coexist with an existing CNAME (cf-arch, confirmed).

---

## 10. v1 cut list

**Ships in v1:**
- EVE SSO login/session, multi-character linking (schema + `/auth/link`, cheap given tool design is already `characterId`-parametrized)
- Dashboard: skill queue, wallet, location/ship, static deterministic "what's next" panel (works with no AI key)
- Settings: Gemini BYOK key storage, disclosure acknowledgment, model picker
- Chat: streaming + tool-call loop + inline citations, all 14 tools in §6
- Local stdio MCP server (per explicit task ask — flagged conflict #1)
- Full D1 schema as designed (including `mcp_tokens`, unused until v1.5)
- Submodule pointer-file repair (prerequisite, see Task 1)

**Explicitly deferred (per ROADMAP's own deferred list and this doc's aggressiveness mandate):**
- Remote Streamable-HTTP `/mcp` endpoint and `ask_analyst` meta-tool
- Cross-thread chat history browsing UI (persistence ships; browsing doesn't)
- Loss-autopsy polished UI page (the two backing tools ship; usable via chat only)
- Goal ledger, session journal, undercut/order-watch, ISK/hour, glossary/mentor mode, daily-briefing composite page, observation export
- Fitting simulation, industry-chain planning, corp/alliance tooling, any write-scope ESI
- Cut-if-tight: `get_clones`, `get_industry_jobs` (see conflict #5)

---

## 11. Task breakdown

11 tasks, file-scoped to avoid collisions. All paths relative to the engine package root unless prefixed `site:`.

| # | Task | Owns (files/dirs) | Depends on |
|---|---|---|---|
| 1 | **Submodule repair** — fix the three stale `.git` pointer files per the submodule briefing's verified recipe (no fetch/checkout needed, object stores already correct) | the three `.git` pointer files at the `web-services-section`, `web-game-services-section`, `eve-online-services-section` levels | none — run first |
| A | **ESI client + observation cache** | `src/esi/*` | B (needs `observations`/`esi_tokens` shape agreed) |
| B | **D1 schema + crypto** | `src/db/schema.sql`, `src/crypto/secretbox.mjs`, `site:migrations/0001_init.sql` | 1 |
| C | **SSO/auth module + routes** | `src/sso/*`, `src/web/routes/auth.mjs` | B |
| D | **Tool registry + definitions** | `src/tools/registry.mjs`, `src/tools/definitions/*` | A |
| E | **Chat: Gemini adapter + loop + route** | `src/tools/gemini-adapter.mjs`, `src/chat/*`, `src/web/routes/chat.mjs` | D, B, C |
| F | **MCP: adapter + local stdio server** — includes the flagged `.mcp.json` edit, gated on Morgan's go/no-go (conflict #1) | `src/tools/mcp-adapter.mjs`, `scripts/serve-eve-tools-mcp.mjs`, `scripts/eve-local-login.mjs`, `.mcp.json` (repo root — this task only) | D |
| G | **Worker app assembly + non-chat API routes** | `src/web/app.mjs`, `src/web/router.mjs`, `src/web/sse.mjs`, `src/web/routes/api.mjs` | C, D |
| H | **Web GUI** | `site:public/**` | contract-only (can mock `/api/*` shapes early; real integration needs G, E) |
| I | **Site deployable wiring + deploy** | `site:wrangler.jsonc`, `site:src/worker.mjs`, `site:package.json`, `site:migrations/**` (sync from B) | G, H, B |
| J | **Newbie guidance rules** | `src/newbie/guidance.mjs` | contract-only (needs `get_skills`/`get_skill_queue`/`get_location` output shapes from A/D) |

Parallelizable groups: `{A, B}` after 1; `{C, D, J}` after B/A; `{E, F, G}` after C/D; `H` can start immediately against a written contract doc, integrates once G/E land; `I` is last.
