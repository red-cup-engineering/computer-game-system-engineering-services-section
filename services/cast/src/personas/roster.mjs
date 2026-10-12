/**
 * personas/roster.mjs — the starter cast: eight named, authored personas, hand-tuned rather
 * than seed-generated, in the Cowrie register (coastal/shell/tide surnames) established by
 * the founding note (`2026-08-19-note-on-the-suite-and-the-studio.md`, "The cast is real...
 * named recurring agent players who actually play"). Each is a casino regular archetype —
 * warm and specific, not a demographic stereotype: what varies is *how they play and talk*,
 * not who they are.
 *
 * Every persona's `avatar` is qwzspace-drawables-compatible DATA (`{ drawable, params, tint }`
 * — `drawable` names one of `@red-cup-engineering/qwzspace/drawables`'s shipped proof set:
 * `disc`, `chip`, `card-back`, `star`, `coin`, `gem`, `tile`, `ring`), never an image asset —
 * this package does not depend on qwzspace at all (see `../adapters/qwzspace.mjs`'s header);
 * a consumer that does resolves the sprite itself via `resolveSprite(drawable, params, tint)`.
 *
 * `voiceTag` is the key `../dialogue.mjs`'s generic template bank uses to pick a line style;
 * an authored persona may additionally carry `lines` (situation -> extra template variants)
 * layered on top of the generic bank for its `voiceTag`, giving it genuinely distinctive
 * flavor beyond the archetype default.
 */

export const AUTHORED_PERSONAS = Object.freeze([
  Object.freeze({
    id: 'pearl-winkle',
    name: 'Pearl Winkle',
    tagline: 'Plays it safe, wins it slow.',
    pronouns: 'she/her',
    voiceTag: 'cautious',
    temperament: Object.freeze({
      riskTolerance: 0.15,
      chattiness: 0.45,
      tiltProneness: 0.1,
      exuberance: 0.35,
      patience: 0.9,
    }),
    avatar: Object.freeze({ drawable: 'ring', params: { r: 18 }, tint: '#c9a86a' }),
    lines: Object.freeze({
      'sit-down': Object.freeze(['Just a quiet hand or two, if there\'s room.']),
      'win-small': Object.freeze(['That\'ll do nicely. Slow and steady.']),
      loss: Object.freeze(['No matter. There\'s always the next hand.']),
    }),
  }),
  Object.freeze({
    id: 'reef-halyard',
    name: 'Reef Halyard',
    tagline: 'Bets big, talks bigger.',
    pronouns: 'he/him',
    voiceTag: 'high-roller',
    temperament: Object.freeze({
      riskTolerance: 0.9,
      chattiness: 0.75,
      tiltProneness: 0.5,
      exuberance: 0.95,
      patience: 0.2,
    }),
    avatar: Object.freeze({ drawable: 'gem', params: { size: 22 }, tint: '#e0b23c' }),
    lines: Object.freeze({
      'bet-placed': Object.freeze(['Now THAT\'S a bet. Let\'s see some fireworks.']),
      'win-big': Object.freeze(['THAT\'S what I\'m talking about! Drinks on me!']),
    }),
  }),
  Object.freeze({
    id: 'sable-ledger',
    name: 'Sable Ledger',
    tagline: 'Quotes the odds before the dealer finishes shuffling.',
    pronouns: 'they/them',
    voiceTag: 'counter',
    temperament: Object.freeze({
      riskTolerance: 0.4,
      chattiness: 0.55,
      tiltProneness: 0.05,
      exuberance: 0.3,
      patience: 0.85,
    }),
    avatar: Object.freeze({ drawable: 'tile', params: { w: 20, h: 20 }, tint: '#4c6b73' }),
    lines: Object.freeze({
      'sit-down': Object.freeze(['Composition looks favorable tonight. Let\'s see.']),
      loss: Object.freeze(['Correct play, wrong outcome — the variance was priced in.']),
    }),
  }),
  Object.freeze({
    id: 'bonny-driftwood',
    name: 'Bonny Driftwood',
    tagline: 'Here for the fun of it, honestly.',
    pronouns: 'she/her',
    voiceTag: 'tourist',
    temperament: Object.freeze({
      riskTolerance: 0.6,
      chattiness: 0.85,
      tiltProneness: 0.3,
      exuberance: 0.8,
      patience: 0.25,
    }),
    avatar: Object.freeze({ drawable: 'star', params: { points: 5, r: 16 }, tint: '#ff8fa3' }),
    lines: Object.freeze({
      'sit-down': Object.freeze(['Ooh, can I play too? This looks like so much fun!']),
      'win-small': Object.freeze(['Yay! I actually won something!']),
    }),
  }),
  Object.freeze({
    id: 'gull-corbin',
    name: 'Gull Corbin',
    tagline: 'Never sits with an unlucky coin on the rail.',
    pronouns: 'he/him',
    voiceTag: 'superstitious',
    temperament: Object.freeze({
      riskTolerance: 0.55,
      chattiness: 0.6,
      tiltProneness: 0.7,
      exuberance: 0.55,
      patience: 0.4,
    }),
    avatar: Object.freeze({ drawable: 'coin', params: { r: 15 }, tint: '#9b7bd1' }),
    lines: Object.freeze({
      'near-miss': Object.freeze(['So close! It\'s warming up, I can feel it.']),
      loss: Object.freeze(['Just gotta switch seats. The luck\'s not here anymore.']),
    }),
  }),
  Object.freeze({
    id: 'otter-vance',
    name: 'Otter Vance',
    tagline: 'Has seen every hand there is to see.',
    pronouns: 'they/them',
    voiceTag: 'stoic',
    temperament: Object.freeze({
      riskTolerance: 0.35,
      chattiness: 0.15,
      tiltProneness: 0.05,
      exuberance: 0.15,
      patience: 0.95,
    }),
    avatar: Object.freeze({ drawable: 'disc', params: { r: 17 }, tint: '#5a6b5d' }),
    lines: Object.freeze({
      'win-big': Object.freeze(['Huh. Alright.']),
      loss: Object.freeze(['Seen worse.']),
    }),
  }),
  Object.freeze({
    id: 'marina-quill',
    name: 'Marina Quill',
    tagline: 'Knows everyone\'s name at the table by the second hand.',
    pronouns: 'she/her',
    voiceTag: 'chatty',
    temperament: Object.freeze({
      riskTolerance: 0.5,
      chattiness: 0.95,
      tiltProneness: 0.25,
      exuberance: 0.7,
      patience: 0.5,
    }),
    avatar: Object.freeze({ drawable: 'card-back', params: {}, tint: '#3d8fb0' }),
    lines: Object.freeze({
      'jackpot-witnessed': Object.freeze(['DID YOU SEE THAT?! Someone just hit it big over there!']),
      'chat-idle': Object.freeze(['So how\'s everyone doing tonight? Good crowd!']),
    }),
  }),
  Object.freeze({
    id: 'cove-brackish',
    name: 'Cove Brackish',
    tagline: 'Convinced the next hand is always the one.',
    pronouns: 'he/him',
    voiceTag: 'streak-chaser',
    temperament: Object.freeze({
      riskTolerance: 0.7,
      chattiness: 0.5,
      tiltProneness: 0.85,
      exuberance: 0.6,
      patience: 0.3,
    }),
    avatar: Object.freeze({ drawable: 'chip', params: { r: 16 }, tint: '#c14f4f' }),
    lines: Object.freeze({
      loss: Object.freeze(['One more. It\'s gotta turn around.']),
      'win-big': Object.freeze(['See?! Told you it was about to turn!']),
    }),
  }),
]);

const BY_ID = new Map(AUTHORED_PERSONAS.map((persona) => [persona.id, persona]));

export function getAuthoredPersona(id) {
  return BY_ID.get(id) ?? null;
}

export function listAuthoredPersonaIds() {
  return AUTHORED_PERSONAS.map((persona) => persona.id);
}
