/**
 * intent-log.mjs — the append-only intent log: envelope, canonical JSON, encode/decode.
 *
 * Per the cartridge spec §1.2–1.3: the log is the single source of truth for a playthrough,
 * not a second data structure kept in sync with state. An `Intent` (and a `GameEvent`) is
 * game-declared, opaque data to this module — the only requirement this file enforces is the
 * envelope shape (`kind: string`, JSON-serializable payload) and the log's own invariants
 * (monotonic `seq`). This module does not know what a "swap" or a "pile move" is.
 *
 * `canonicalJson` exists so that (a) two logically-identical logs/states serialize to
 * the *same* bytes regardless of object-key insertion order, and (b) replay.mjs can hash a
 * recomputed state deterministically. It never touches the clock or any RNG — it is a pure
 * function of its argument, full stop.
 *
 * Plain JavaScript, no TypeScript syntax — see manifest.mjs's header comment for why. Types
 * are declared in the co-located intent-log.d.ts.
 */

/** True iff `x` has the minimal intent/event envelope shape: a plain object carrying a
 *  non-empty string `kind`. Used to validate both `Intent` and `GameEvent` payloads, which
 *  share this one envelope by design. */
import { canonicalJson } from "@red-cup-engineering/json-services-section/canonical-json";
function hasKindEnvelope(x) {
  return (
    typeof x === 'object' &&
    x !== null &&
    !Array.isArray(x) &&
    typeof x.kind === 'string' &&
    x.kind !== ''
  );
}

export function isIntent(x) {
  return hasKindEnvelope(x);
}

export function isGameEvent(x) {
  return hasKindEnvelope(x);
}


/** Validate the shape and internal invariants of a candidate intent log, without trusting
 *  its type. Collects every error found rather than failing fast, matching manifest.mjs's
 *  validation style. */
export function validateIntentLog(data) {
  const errors = [];

  if (!Array.isArray(data)) {
    return { valid: false, errors: ['intent log must be an array of log entries'] };
  }

  let previousSeq;
  data.forEach((raw, index) => {
    const where = `entry[${index}]`;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      errors.push(`${where}: must be an object`);
      return;
    }
    const entry = raw;

    if (typeof entry.seq !== 'number' || !Number.isInteger(entry.seq)) {
      errors.push(`${where}.seq: must be an integer`);
    } else {
      if (previousSeq !== undefined && entry.seq <= previousSeq) {
        errors.push(`${where}.seq: must be strictly greater than the previous entry's seq (got ${entry.seq} after ${previousSeq})`);
      }
      previousSeq = entry.seq;
    }

    if (!hasKindEnvelope(entry.intent)) {
      errors.push(`${where}.intent: must be an object with a non-empty string "kind"`);
    }

    if (entry.ts !== undefined && (typeof entry.ts !== 'number' || !Number.isFinite(entry.ts))) {
      errors.push(`${where}.ts: when present, must be a finite number`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/** Encode a log to its canonical JSON text form — stable, sorted-key, directly comparable
 *  or hashable across two independently-constructed logs with the same content. */
export function encodeIntentLog(log) {
  return canonicalJson(log);
}

/** Parse and validate a log previously produced by `encodeIntentLog` (or any JSON text with
 *  the same shape). Throws with every validation error joined, rather than returning a
 *  partially-trusted value — a caller that wants to distinguish "unparseable JSON" from
 *  "malformed log" should call `JSON.parse`/`validateIntentLog` directly instead. */
export function decodeIntentLog(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new SyntaxError(`decodeIntentLog: invalid JSON: ${err.message}`);
  }
  const result = validateIntentLog(parsed);
  if (!result.valid) {
    throw new TypeError(`decodeIntentLog: invalid intent log:\n  ${result.errors.join('\n  ')}`);
  }
  return parsed;
}

/** Pure append: returns a *new* log with `intent` added. `seq` defaults to one past the
 *  log's last entry (or 0 for an empty log); an explicitly supplied `seq` must still be
 *  strictly greater than the log's last entry or this throws — the append-only invariant is
 *  enforced here, not left to callers to remember. */
export function appendEntry(log, intent, options) {
  if (!Array.isArray(log)) {
    throw new TypeError('appendEntry: log must be an array');
  }
  if (!isIntent(intent)) {
    throw new TypeError('appendEntry: intent must be an object with a non-empty string "kind"');
  }
  const previousSeq = log.length > 0 ? log[log.length - 1].seq : undefined;
  if (previousSeq !== undefined && !Number.isSafeInteger(previousSeq)) {
    throw new TypeError('appendEntry: the log\'s last seq must be a safe integer');
  }
  const seq = options?.seq ?? (previousSeq === undefined ? 0 : previousSeq + 1);
  if (!Number.isSafeInteger(seq)) {
    throw new TypeError('appendEntry: seq must be a safe integer');
  }
  if (previousSeq !== undefined && seq <= previousSeq) {
    throw new RangeError(`appendEntry: seq ${seq} is not strictly greater than the log's last seq ${previousSeq}`);
  }
  if (options?.ts !== undefined && !Number.isFinite(options.ts)) {
    throw new TypeError('appendEntry: ts must be a finite number');
  }
  const entry = options?.ts === undefined ? { seq, intent } : { seq, intent, ts: options.ts };
  return [...log, entry];
}
