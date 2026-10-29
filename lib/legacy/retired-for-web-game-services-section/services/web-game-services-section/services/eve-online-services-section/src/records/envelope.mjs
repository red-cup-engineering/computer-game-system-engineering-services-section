// src/records/envelope.mjs
//
// The shared provenance envelope every typed record in the interchange
// format wears: `type` + `schemaVersion` names *what* the record is and
// which shape of it, `recordedAt` + `source` say *when and from where* the
// enclosed `data` was learned, and `id` (added by `withIdentity`, not by
// `makeRecord` itself) is the record's dedup/lookup handle. See README.md
// ("The interchange-format doctrine") for the fuller rationale.
//
// This file validates the envelope shape itself with plain hand-written
// checks (not the engine's interpretive JSON Schema validator) so it has no
// dependency on any particular record kind's schema — a wallet-journal
// record and a player note wear the same envelope, checked the same way.
// Per-kind payload validation against lib/schemas/*.schema.json is the
// caller's job (see src/records/eve-records.mjs for the pattern).
//
// Web APIs only: no node:fs, no node:*. Runs under Node 24 and Cloudflare
// Workers alike. Identity comes from the house identity owner
// (@red-cup-engineering/computer-system-engine's semanticId, an ni: URI
// over canonical CBOR) rather than a hand-rolled canonicalJson/sha256 pair;
// nothing persists these ids, so every record's id is simply its own
// content hash — there is no "declared id wins" precedence to preserve.

import { semanticId } from "@red-cup-engineering/computer-content-engineering-services-section/semiotic-content-address";

const VALID_SOURCE_KINDS = new Set(["esi", "zkillboard", "player", "derived"]);

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

function requireFiniteNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return value;
}

function validateSource(source) {
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new TypeError("makeRecord: source must be an object");
  }
  if (!VALID_SOURCE_KINDS.has(source.kind)) {
    throw new TypeError(
      `makeRecord: source.kind must be one of ${[...VALID_SOURCE_KINDS].join(", ")}, got ${JSON.stringify(source.kind)}`,
    );
  }
  if (source.path !== undefined && typeof source.path !== "string") {
    throw new TypeError("makeRecord: source.path must be a string when provided");
  }
  if (
    source.expiresAt !== undefined &&
    source.expiresAt !== null &&
    !(typeof source.expiresAt === "number" && Number.isFinite(source.expiresAt))
  ) {
    throw new TypeError("makeRecord: source.expiresAt must be a finite number or null when provided");
  }
  const validated = { kind: source.kind };
  if (source.path !== undefined) validated.path = source.path;
  validated.expiresAt = source.expiresAt ?? null;
  return Object.freeze(validated);
}

/**
 * Builds one provenance-enveloped record. `data` is opaque to this
 * function — it is whatever the caller's record kind carries — but it must
 * be present (not `undefined`); callers wanting per-kind shape guarantees
 * validate `data` separately (see ./validate.mjs and
 * src/records/eve-records.mjs).
 *
 * `now` defaults to `() => Date.now()` (an injected clock, per the network
 * test-fakes convention) and its return value becomes `recordedAt` as a raw
 * epoch-ms number — the same shape src/esi/esi-client.mjs uses for its own
 * `observation.recordedAt`/`expiresAt`, so a record built from an ESI
 * observation can just forward that timestamp (`now: () => observation.recordedAt`)
 * rather than re-deriving a fresh one for "when we learned this fact".
 *
 * Returns a frozen object; this function does not attach `id` (see
 * `withIdentity`) because content-hash identity depends on the record's
 * *complete* final shape, and freezing here before an `id` land would force
 * every caller to immediately unfreeze-and-refreeze anyway.
 */
export function makeRecord({ type, schemaVersion = 1, source, data, now = () => Date.now() }) {
  requireNonEmptyString(type, "makeRecord: type");
  requirePositiveInteger(schemaVersion, "makeRecord: schemaVersion");
  if (data === undefined) {
    throw new TypeError("makeRecord: data is required (use null explicitly if a record truly carries none)");
  }
  if (typeof now !== "function") {
    throw new TypeError("makeRecord: now must be a function");
  }
  const validatedSource = validateSource(source);
  const recordedAt = now();
  requireFiniteNumber(recordedAt, "makeRecord: now()");

  return Object.freeze({
    type,
    schemaVersion,
    recordedAt,
    source: validatedSource,
    data,
  });
}

/**
 * Attaches an identity to an already-built record: `id: semanticId(record)`,
 * an `ni:` URI over the record's canonical CBOR encoding (house identity
 * convention, @red-cup-engineering/computer-system-engine). Returns a new
 * frozen object; does not mutate `record`.
 */
export async function withIdentity(record) {
  if (typeof record !== "object" || record === null) {
    throw new TypeError("withIdentity: record must be a non-null object");
  }
  const id = semanticId(record);
  return Object.freeze({ ...record, id });
}
