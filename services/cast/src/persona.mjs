/**
 * `persona` — the cast's identity model: who an agent player IS, independent of any game it
 * plays. A `Persona` is plain, JSON-serializable data (per house replay/determinism
 * discipline — nothing here is a class instance or carries a live stream), built one of two
 * ways:
 *
 *  - **authored** (`./personas/roster.mjs`): eight hand-tuned casino regulars shipped with
 *    this package, each a distinct temperament + voice, in the Cowrie register the founding
 *    note called for ("named recurring agent players... meeting the same opponent... is
 *    continuity no other studio can offer honestly").
 *  - **generated** (`generatePersona(seed)`): a coherent, fully deterministic persona derived
 *    from any seed string — for a casino floor that wants more than eight regulars without
 *    hand-authoring a ninth, or for load/soak testing a table with many distinct agents.
 *
 * Both shapes satisfy the same `Persona` interface (see `persona.d.ts`) and are consumed
 * identically by `./dialogue.mjs`, `./policy/*.mjs`, and `./runner.mjs` — nothing downstream
 * ever branches on "is this authored or generated."
 */
import { slugify } from '@red-cup-engineering/computer-text-content-engineering-services-section/slugify-text';
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';
import { AUTHORED_PERSONAS, getAuthoredPersona, listAuthoredPersonaIds } from './personas/roster.mjs';

export { AUTHORED_PERSONAS, getAuthoredPersona, listAuthoredPersonaIds };

/** The temperament at which every policy in this package is defined to play exact-EV /
 *  baseline-rational with zero deviation — see `./policy/blackjack.mjs`'s own header for the
 *  guarantee this anchors ("neutral temperament always plays the exact-EV action"). */
export const NEUTRAL_TEMPERAMENT = Object.freeze({
  riskTolerance: 0.5,
  chattiness: 0.5,
  tiltProneness: 0,
  exuberance: 0.5,
  patience: 0.5,
});

const TEMPERAMENT_KEYS = Object.freeze(['riskTolerance', 'chattiness', 'tiltProneness', 'exuberance', 'patience']);

const clamp01 = (n) => Math.max(0, Math.min(1, n));

/** Validate that `temperament` has all five dimensions, each a finite number in [0, 1].
 *  Throws with a specific message identifying the bad key; used by both the generator and
 *  anyone constructing an authored persona by hand. */
export function assertValidTemperament(temperament) {
  if (temperament === null || typeof temperament !== 'object') {
    throw new TypeError('assertValidTemperament: temperament must be an object');
  }
  for (const key of TEMPERAMENT_KEYS) {
    const value = temperament[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`assertValidTemperament: "${key}" must be a finite number in [0, 1] (got ${value})`);
    }
  }
  return true;
}

const AVATAR_DRAWABLES = Object.freeze(['disc', 'chip', 'card-back', 'star', 'coin', 'gem', 'tile', 'ring']);
const AVATAR_TINTS = Object.freeze([
  '#c9a86a', '#e0b23c', '#4c6b73', '#ff8fa3', '#9b7bd1', '#5a6b5d', '#3d8fb0', '#c14f4f',
  '#7fb069', '#d68c45', '#5f6caf', '#b0413e',
]);
const PRONOUN_OPTIONS = Object.freeze(['she/her', 'he/him', 'they/them']);
const VOICE_TAGS = Object.freeze([
  'cautious', 'high-roller', 'counter', 'tourist', 'superstitious', 'stoic', 'chatty', 'streak-chaser',
]);

const FIRST_NAMES = Object.freeze([
  'Coral', 'Marlow', 'Wren', 'Tansy', 'Briar', 'Sable', 'Fenn', 'Isla', 'Rook', 'Nerys',
  'Cato', 'Merrow', 'Sable', 'Dune', 'Fable', 'Skye', 'Percy', 'Larkin', 'Odessa', 'Gale',
]);
const SURNAMES = Object.freeze([
  'Tidewell', 'Barnacle', 'Shellbourne', 'Kelpwood', 'Brackwater', 'Nerite', 'Saltmere', 'Cowrie',
  'Driftmoor', 'Halcove', 'Wickford', 'Abalone', 'Winnow', 'Farland', 'Reeflock', 'Spindrift',
]);
const TAGLINE_TEMPLATES = Object.freeze({
  cautious: 'Never bets more than the night can spare.',
  'high-roller': 'Came to make noise, not to whisper.',
  counter: 'Has already done the math on your hand.',
  tourist: 'Just happy to be at the table.',
  superstitious: 'Trusts the rail more than the odds.',
  stoic: 'Says little, remembers everything.',
  chatty: 'Knows the whole table\'s names by the second round.',
  'streak-chaser': 'Certain the next one turns it all around.',
});

/**
 * Deterministically generate a coherent `Persona` from `seed` — same seed, byte-identical
 * persona, forever. `options.idPrefix` (default `'generated'`) namespaces the id so a
 * generated persona can never collide with an authored one (`listAuthoredPersonaIds()` never
 * returns an id with a `:` in it).
 */
export function generatePersona(seed, options = {}) {
  if (typeof seed !== 'string' || seed.length === 0) {
    throw new TypeError('generatePersona: seed must be a non-empty string');
  }
  const idPrefix = options.idPrefix ?? 'generated';

  const nameRng = seededStream(seed, 'name');
  const firstName = nameRng.pick(FIRST_NAMES);
  const surname = nameRng.pick(SURNAMES);
  const name = `${firstName} ${surname}`;

  const voiceTag = seededStream(seed, 'voice-tag').pick(VOICE_TAGS);
  const pronouns = seededStream(seed, 'pronouns').pick(PRONOUN_OPTIONS);

  const temperamentRng = seededStream(seed, 'temperament');
  const temperament = Object.freeze(
    Object.fromEntries(TEMPERAMENT_KEYS.map((key) => [key, Math.round(temperamentRng.next() * 100) / 100])),
  );

  const avatarRng = seededStream(seed, 'avatar');
  const avatar = Object.freeze({
    drawable: avatarRng.pick(AVATAR_DRAWABLES),
    params: {},
    tint: avatarRng.pick(AVATAR_TINTS),
  });

  const id = `${idPrefix}:${slugify(name)}-${Math.abs(seededStream(seed, 'id').int(0, 99999))}`;

  return Object.freeze({
    id,
    name,
    tagline: TAGLINE_TEMPLATES[voiceTag],
    pronouns,
    voiceTag,
    temperament,
    avatar,
    seed,
  });
}

/** Look up a persona by id across both the authored roster and, if `options.seedForGenerated`
 *  is supplied, the generator (an id of the shape `${idPrefix}:...` with no authored match
 *  falls through to `generatePersona` only when the caller already knows the seed that
 *  produced it — this package never tries to invert an id back into a seed). Returns the
 *  authored persona when `id` matches one, otherwise `null`. */
export function getPersona(id) {
  return getAuthoredPersona(id);
}

/** Whether `temperament` is exactly the neutral baseline every policy plays exact-EV at. */
export function isNeutralTemperament(temperament) {
  return TEMPERAMENT_KEYS.every((key) => temperament[key] === NEUTRAL_TEMPERAMENT[key]);
}

export function clampTemperamentValue(value) {
  return clamp01(value);
}
