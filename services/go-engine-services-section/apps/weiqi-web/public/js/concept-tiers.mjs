// Pure tier-filtering logic for LIVE CONCEPT RECOGNITION (task item 4):
// which semantic events surface as an on-board toast, at which of the
// three settings tiers. Split out from concept-toast.mjs (which does the
// actual DOM rendering) so the filtering rule itself -- the part with
// real judgment calls in it -- is unit-testable without a document (see
// test/concept-tiers.test.mts).
//
// Judgment calls, made explicit here rather than buried in a DOM module:
//
//   - "pass" and "game-ended" fire every time a player passes; a toast on
//     literally every pass would be the definition of naggy, so they are
//     never toasted regardless of tier (the event log and board badges
//     already carry them for anyone who wants that detail).
//   - "group-killed" always accompanies a "capture" event on the same
//     move (see the kernel's events.mts doc comment) -- toasting both
//     would say the same thing twice in the same breath, so
//     "group-killed" is folded into the "capture" toast rather than
//     getting one of its own.
//   - COMMON events (atari-given/-escaped, capture) happen most moves in
//     a 7x7 capture-go game; they are exactly what a beginner most needs
//     named in the moment, but exactly what an intermediate player
//     already knows on sight -- so "intermediate" drops them and keeps
//     only the RARE, structurally-interesting events (ko, connection,
//     eye formation), which is where an intermediate player's actual
//     learning edge sits per the market teardown's SRS/concept-recognition
//     finding.
//   - "off" means off: the toast strip renders nothing, full stop. Board
//     badges and the event log are unaffected by this setting -- it only
//     controls the floating toast layer's naggy-or-not-naggy dial.

export const TIER_BEGINNER = "beginner";
export const TIER_INTERMEDIATE = "intermediate";
export const TIER_OFF = "off";

export const TIERS = Object.freeze([TIER_BEGINNER, TIER_INTERMEDIATE, TIER_OFF]);

export const COMMON_EVENT_TYPES = Object.freeze(new Set(["atari-given", "atari-escaped", "capture"]));

export const RARE_EVENT_TYPES = Object.freeze(new Set(["ko-started", "ko-resolved", "connection", "eye-formed"]));

/** The full set of event types the toast strip ever renders, at any tier
 * -- "pass"/"game-ended" (too frequent/definitional to be a "concept
 * moment") and "group-killed" (redundant with "capture", see above) are
 * deliberately excluded here, not merely filtered out by tier. */
export const TOASTABLE_EVENT_TYPES = Object.freeze(new Set([...COMMON_EVENT_TYPES, ...RARE_EVENT_TYPES]));

/** Is `tier` a recognized tier name? Guards settings storage/UI input. */
export function isValidTier(tier) {
  return TIERS.includes(tier);
}

/** Should a semantic event of `eventType`, at the given `tier`, produce a
 * toast? Pure function, no DOM, no state -- the one rule this whole
 * feature actually hinges on. */
export function shouldToast(eventType, tier) {
  if (!isValidTier(tier) || tier === TIER_OFF) return false;
  if (!TOASTABLE_EVENT_TYPES.has(eventType)) return false;
  if (tier === TIER_INTERMEDIATE) return RARE_EVENT_TYPES.has(eventType);
  return true; // beginner: every toastable type
}
