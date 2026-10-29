-- EVE Assist 0.2.0 — migrate onto the Assist engine's six-table schema
-- (principals, credentials, ai_settings, mcp_tokens, observations,
-- chat_messages — @red-cup-engineering/personal-intelligence-systems-services-section
-- migrations/0001_assist.sql, its CREATE TABLE statements copied verbatim
-- below) and retire this package's own users/esi_tokens/user_settings
-- tables. Applied by every seat that runs this package's migrations
-- (currently sites/eve-assist.561.group), after 0001_init.sql and
-- 0002_ai_provider.sql, before any later migration.
--
-- Row-copy strategy (decided here, not attempted cleverly in SQL):
--
--   users -> principals: one row per user, id kept IDENTICAL (every table
--   below that used to key off users.id keys off principals.id instead,
--   unchanged), principal_key is "eve-character:<character_id>" (this
--   package's principalKind/credentialProvider pairing), subject is the
--   character id as text, display_name is the character name.
--
--   user_settings -> ai_settings: key_sealed = gemini_key_sealed,
--   provider = ai_provider, base_url = ai_base_url,
--   model = COALESCE(ai_model, gemini_model). principal_id = user_id
--   (valid because principals.id was copied identical to users.id above).
--
--   esi_tokens -> credentials: NOT copied — chosen deliberately, the
--   simpler and honest path. The engine's credentials table seals one JSON
--   object of the whole credential secret ({accessToken, refreshToken}
--   together); esi_tokens sealed the access and refresh tokens SEPARATELY
--   (access_token_sealed, refresh_token_sealed as two independent sealed
--   values). There is no way to re-seal one shape from the other inside a
--   SQL migration (sealing happens in application code, not SQL), and
--   inventing a "legacy" provider/shape here to carry the old sealing
--   scheme forward would mean the engine's credential-refresh path has to
--   understand two sealing schemes forever. So: esi_tokens is dropped
--   without copying. Every other EVE Assist user's account survives this
--   migration (principal, AI settings, MCP tokens, observations, and chat
--   history all carry over); every user simply has to click through EVE
--   SSO login once more afterwards — login re-establishes their credential
--   under the engine's sealing scheme immediately, same as a first login.
--
--   mcp_tokens / observations / chat_messages: same rows, user_id renamed
--   to principal_id, ids kept identical. D1/SQLite's ALTER TABLE RENAME
--   COLUMN is not relied on here (portability across D1's SQLite version);
--   instead each table is rebuilt under a temporary name with the new
--   column, rows are copied across with INSERT ... SELECT, the old table
--   is dropped, and the temporary table is renamed into the old table's
--   name — the standard SQLite "recreate and rename" column-rename idiom.

-- --- new tables (engine's migrations/0001_assist.sql, verbatim) -----------

CREATE TABLE principals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  principal_key TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL,
  subject TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE credentials (
  credential_key TEXT PRIMARY KEY,
  principal_id INTEGER NOT NULL REFERENCES principals(id),
  provider TEXT NOT NULL,
  sealed_json TEXT NOT NULL,
  expires_at INTEGER,
  scopes_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE ai_settings (
  principal_id INTEGER PRIMARY KEY REFERENCES principals(id),
  key_sealed TEXT,
  provider TEXT NOT NULL DEFAULT 'gemini',
  base_url TEXT,
  model TEXT
);

CREATE TABLE mcp_tokens_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  principal_id INTEGER NOT NULL REFERENCES principals(id),
  token_hash TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at TEXT
);

CREATE TABLE observations_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  principal_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  params_json TEXT NOT NULL,
  status INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  expires_at INTEGER,
  recorded_at INTEGER NOT NULL
);

CREATE TABLE chat_messages_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  principal_id INTEGER NOT NULL,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- --- row copies -------------------------------------------------------------

INSERT INTO principals (id, principal_key, kind, subject, display_name, created_at)
SELECT id, 'eve-character:' || character_id, 'eve-character', CAST(character_id AS TEXT), character_name, created_at
FROM users;

INSERT INTO ai_settings (principal_id, key_sealed, provider, base_url, model)
SELECT user_id, gemini_key_sealed, ai_provider, ai_base_url, COALESCE(ai_model, gemini_model)
FROM user_settings;

INSERT INTO mcp_tokens_v2 (id, principal_id, token_hash, label, created_at, revoked_at)
SELECT id, user_id, token_hash, label, created_at, revoked_at
FROM mcp_tokens;

INSERT INTO observations_v2 (id, principal_id, kind, path, params_json, status, body_json, expires_at, recorded_at)
SELECT id, user_id, kind, path, params_json, status, body_json, expires_at, recorded_at
FROM observations;

INSERT INTO chat_messages_v2 (id, principal_id, thread_id, role, content_json, created_at)
SELECT id, user_id, thread_id, role, content_json, created_at
FROM chat_messages;

-- --- swap the renamed tables into place, drop everything superseded -------

DROP TABLE mcp_tokens;
ALTER TABLE mcp_tokens_v2 RENAME TO mcp_tokens;

DROP TABLE observations;
ALTER TABLE observations_v2 RENAME TO observations;

DROP TABLE chat_messages;
ALTER TABLE chat_messages_v2 RENAME TO chat_messages;

DROP TABLE users;
DROP TABLE esi_tokens;
DROP TABLE user_settings;
