/**
 * seed.mjs — deterministic seed derivation for the `daily-utc` and `client-supplied`
 * `SeedPolicy` kinds (manifest.mjs's `SeedPolicy`).
 *
 * Names solitaire-service's `dailySeed(date, variantId)` pattern directly (see
 * `src/daily.mts` in solitaire-service): a pure function of the UTC *calendar date* and a
 * game/config identifier, so every player worldwide resolves the same seed on the same day
 * regardless of their own clock's timezone offset. Only `Date.prototype.getUTC*` accessors
 * are read here, never local-timezone accessors.
 *
 * Per house convention, nothing in this module reads the ambient clock — every function
 * that needs "now" takes a `Date` (or a pre-formatted date string) as a parameter. The
 * caller injects the clock; this module only ever transforms what it is given.
 *
 * `on-demand` seeds are deliberately out of scope: the spec (§1.1) is explicit that
 * cartridge does not mandate how an on-demand seed is chosen, only that whatever string
 * results is handed to `createEngine` like any other seed. A helper here would either bake
 * in a randomness source (forbidden in domain code) or add nothing beyond identity, so none
 * is provided.
 *
 * Plain JavaScript, no TypeScript syntax — see manifest.mjs's header comment for why. Types
 * are declared in the co-located seed.d.ts.
 */

const UTC_DATE_STRING = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD` for `date`'s UTC calendar day — timezone-independent by construction. */
export function utcDateString(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new TypeError('utcDateString: date must be a valid Date');
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Validates and passes through an already-formatted `YYYY-MM-DD` string, so a caller that
 *  received a date via URL query param can share `dailySeed`'s date-resolution path with a
 *  caller holding a live `Date`. */
function resolveDay(date) {
  if (typeof date === 'string') {
    if (!UTC_DATE_STRING.test(date)) {
      throw new TypeError(`resolveDay: "${date}" is not a YYYY-MM-DD date string`);
    }
    return date;
  }
  return utcDateString(date);
}

/** `dailySeed(gameId, date, configId?)` — the seed for the `daily-utc` SeedPolicy. Pure
 *  function of its three arguments: identical inputs always produce the identical seed
 *  string, and the same (gameId, calendar day, configId) resolves to the same seed for
 *  every player regardless of when in the day or where they are. `date` may be a `Date`
 *  (its UTC calendar day is used) or an already-formatted `YYYY-MM-DD` string. */
export function dailySeed(gameId, date, configId) {
  if (typeof gameId !== 'string' || gameId.length === 0) {
    throw new TypeError('dailySeed: gameId must be a non-empty string');
  }
  const day = resolveDay(date);
  const suffix = configId !== undefined && configId.length > 0 ? `${configId}:` : '';
  return `${gameId}-daily:${suffix}${day}`;
}

/** Validates a `client-supplied` seed (the `SeedPolicy` kind naming solitaire's
 *  `?seed=…&variant=…` URL-param shape): must be a non-empty string. Cartridge does not
 *  constrain what the string contains beyond that — it is opaque, per-game input to
 *  `createEngine`. Returns the seed unchanged; the function exists to give the
 *  client-supplied path one documented validation point rather than leaving every game to
 *  hand-roll its own "is this a legal seed" check. */
export function clientSuppliedSeed(raw) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new TypeError('clientSuppliedSeed: seed must be a non-empty string');
  }
  return raw;
}
