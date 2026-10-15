/**
 * `dialogue` — seeded, data-driven utterance generation. No LLM call sits anywhere behind
 * this module: every line is picked from a persona-voice template table and slot-filled, which
 * is cheap enough to run on every table-side event for every cast member, always on, with a
 * cost profile of a `Map` lookup and an RNG draw rather than a network round trip. Determinism
 * is the whole point — `say(persona, situation, { seed, count })` with the same inputs always
 * returns the same lines, so a replayed session's chat log matches the live one exactly.
 *
 * Three layers of templates are consulted for a given `(persona.voiceTag, situation)`, most
 * specific first: the persona's own authored `lines[situation]` (if any — see
 * `./personas/roster.mjs`), then `VOICE_TEMPLATES[voiceTag][situation]`, then
 * `DEFAULT_TEMPLATES[situation]`. A generated persona (no `lines`) still gets a coherent voice
 * purely from its `voiceTag`; an authored persona layers its own extra flavor on top rather
 * than replacing the archetype bank, so it never runs dry of variety.
 */
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';

export const SITUATIONS = Object.freeze([
  'sit-down', 'bet-placed', 'win-small', 'win-big', 'loss', 'near-miss',
  'jackpot-witnessed', 'chat-idle', 'farewell',
]);

const clamp01 = (n) => Math.max(0, Math.min(1, n));

const DEFAULT_TEMPLATES = Object.freeze({
  'sit-down': Object.freeze(['{name} takes a seat at the table.', 'Mind if I join in?']),
  'bet-placed': Object.freeze(['Placing {amount} chips.', "Let's see where this goes."]),
  'win-small': Object.freeze(['A little something, at least.', "I'll take it."]),
  'win-big': Object.freeze(["Now that's a win!", "Didn't expect that — great hand!"]),
  loss: Object.freeze(['Ah, well.', "That one didn't go my way."]),
  'near-miss': Object.freeze(['So close!', 'Just barely missed that one.']),
  'jackpot-witnessed': Object.freeze(['Whoa, did you see that?!', "{peerName}'s having a night!"]),
  'chat-idle': Object.freeze(['Nice crowd tonight.', "How's everyone doing?"]),
  farewell: Object.freeze(['Thanks for the game, everyone.', "That's my cue to head out."]),
});

const VOICE_TEMPLATES = Object.freeze({
  cautious: Object.freeze({
    'sit-down': Object.freeze(["Just a quiet hand or two, if there's room."]),
    'win-small': Object.freeze(["That'll do nicely. Slow and steady."]),
    loss: Object.freeze(["No matter. There's always the next hand."]),
    'chat-idle': Object.freeze(['I do enjoy a calm table.']),
  }),
  'high-roller': Object.freeze({
    'sit-down': Object.freeze(['Deal me in — big stakes only.']),
    'bet-placed': Object.freeze(["Now THAT'S a bet. Let's see some fireworks."]),
    'win-big': Object.freeze(["THAT'S what I'm talking about! Drinks on me!"]),
    loss: Object.freeze(["Nothing I can't win back tenfold."]),
  }),
  counter: Object.freeze({
    'sit-down': Object.freeze(['Composition looks favorable tonight. Let\'s see.']),
    'win-small': Object.freeze(['Expected value paid off, right on schedule.']),
    loss: Object.freeze(['Correct play, wrong outcome — the variance was priced in.']),
  }),
  tourist: Object.freeze({
    'sit-down': Object.freeze(['Ooh, can I play too? This looks like so much fun!']),
    'win-small': Object.freeze(['Yay! I actually won something!']),
    loss: Object.freeze(['Oh well, still fun!']),
  }),
  superstitious: Object.freeze({
    'sit-down': Object.freeze(['Let me just... set things right here first.']),
    'near-miss': Object.freeze(["So close! It's warming up, I can feel it."]),
    loss: Object.freeze(["Just gotta switch seats. The luck's not here anymore."]),
  }),
  stoic: Object.freeze({
    'win-big': Object.freeze(['Huh. Alright.']),
    loss: Object.freeze(['Seen worse.']),
    'chat-idle': Object.freeze(['...']),
  }),
  chatty: Object.freeze({
    'sit-down': Object.freeze(['Hi everyone! Mind if I squeeze in?']),
    'jackpot-witnessed': Object.freeze(['DID YOU SEE THAT?! Someone just hit it big over there!']),
    'chat-idle': Object.freeze(["So how's everyone doing tonight? Good crowd!"]),
  }),
  'streak-chaser': Object.freeze({
    'bet-placed': Object.freeze(["Doubling down. I can feel it turning."]),
    loss: Object.freeze(["One more. It's gotta turn around."]),
    'win-big': Object.freeze(['See?! Told you it was about to turn!']),
  }),
});

/** How often a persona reacts to `situation` at all, before temperament modulation — tuned so
 *  a big or shared moment (a win, a jackpot witnessed) is near-certain to draw a line and idle
 *  chatter is the rare exception, matching a real floor's rhythm. */
const BASE_REACTION_RATE = Object.freeze({
  'sit-down': 0.9,
  'bet-placed': 0.35,
  'win-small': 0.5,
  'win-big': 0.95,
  loss: 0.3,
  'near-miss': 0.6,
  'jackpot-witnessed': 0.85,
  'chat-idle': 0.15,
  farewell: 0.8,
});

// Common casino situations retain their shared templates. A game may also
// author a non-casino situation in its Persona data, keyed by an event the
// game's authoritative source actually emits (e.g. Weiqi "capture"). Cast
// never invents that event or a default reaction to a nonexistent encounter.
function assertSituation(situation, persona) {
  if (SITUATIONS.includes(situation)) return;
  const lines = persona?.lines?.[situation];
  if (typeof situation !== 'string' || !Object.hasOwn(persona?.lines ?? {}, situation) ||
      !Array.isArray(lines) || lines.length === 0 ||
      !lines.every(line => typeof line === 'string' && line.trim().length > 0)) {
    throw new TypeError(`dialogue: unknown or unauthored situation "${String(situation)}"`);
  }
}

/**
 * The probability a persona reacts at all to `situation`, before rolling. Chattiness modulates
 * the base rate around 1.0x at `chattiness === 0.5` (the neutral value) — a chatty persona
 * (chattiness -> 1) reacts noticeably more, a near-silent one (chattiness -> 0) noticeably
 * less, but the base rate itself is never bypassed entirely.
 */
export function reactionProbability(persona, situation) {
  assertSituation(situation, persona);
  const base = Object.hasOwn(BASE_REACTION_RATE, situation) ? BASE_REACTION_RATE[situation] : 1;
  const chattiness = clamp01(persona.temperament?.chattiness ?? 0.5);
  return clamp01(base * (0.3 + 1.4 * chattiness));
}

/** Roll whether `persona` speaks up for `situation` right now, given an already-derived `rng`
 *  stream (callers own seeding — see `say`'s own seed derivation for the matching convention). */
export function shouldSpeak(persona, situation, rng) {
  return rng.chance(reactionProbability(persona, situation));
}

function templatesFor(persona, situation) {
  const authored = Object.hasOwn(persona.lines ?? {}, situation) ? persona.lines[situation] : [];
  const voice = VOICE_TEMPLATES[persona.voiceTag] ?? {};
  const voiced = Object.hasOwn(voice, situation) ? voice[situation] : [];
  const fallback = Object.hasOwn(DEFAULT_TEMPLATES, situation) ? DEFAULT_TEMPLATES[situation] : [];
  // Authored lines first (most specific), then voice-archetype flavor, then the universal
  // fallback — order matters only in that authored/voiced lines are preferred when sampling
  // without replacement runs out of room, not for any weighting beyond that.
  return [...authored, ...voiced, ...fallback];
}

function fillSlots(template, context) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (context[key] !== undefined) return String(context[key]);
    if (key === 'name') return context.name ?? '';
    if (key === 'peerName') return context.peerName ?? 'someone';
    if (key === 'amount') return context.amount !== undefined ? String(context.amount) : 'some';
    return match;
  });
}

/**
 * Generate `count` (default 1) deterministic utterances for `persona` reacting to `situation`.
 * Fully determined by `(persona, situation, options.seed, options.count)` — no ambient
 * randomness. `options.seed` defaults to `persona.seed ?? persona.id`; a caller driving many
 * utterances across a session should pass an explicit, advancing seed component (e.g. a turn
 * counter) to avoid replaying the same line twice for the same persona/situation pair.
 */
export function say(persona, situation, options = {}) {
  assertSituation(situation, persona);
  const count = options.count ?? 1;
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`say: count must be a positive integer (got ${count})`);
  }
  const seed = options.seed ?? persona.seed ?? persona.id;
  const context = { name: persona.name, ...options.context };
  const pool = templatesFor(persona, situation);
  if (pool.length === 0) return [];

  const rng = seededStream(seed, persona.id, situation);
  const remaining = rng.shuffle(pool);
  const chosen = [];
  for (let i = 0; i < count; i++) {
    // Sample without replacement while the shuffled pool lasts; once exhausted, reshuffle a
    // fresh (still-deterministic, since it continues the same rng stream) pass rather than
    // repeating the exact same order.
    if (remaining.length === 0) remaining.push(...rng.shuffle(pool));
    chosen.push(remaining.shift());
  }
  return chosen.map((template) => fillSlots(template, context));
}

/** Convenience: roll `shouldSpeak` and, if it hits, return one `say(...)` line; otherwise
 *  `null`. The one call most runner loops actually want — decide-and-generate in one step,
 *  still fully deterministic given `seed`. */
export function reactTo(persona, situation, options = {}) {
  const seed = options.seed ?? persona.seed ?? persona.id;
  const rollRng = seededStream(seed, persona.id, situation, 'roll');
  if (!shouldSpeak(persona, situation, rollRng)) return null;
  const [line] = say(persona, situation, { ...options, seed, count: 1 });
  return line ?? null;
}
