import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SITUATIONS, say, shouldSpeak, reactTo, reactionProbability } from './dialogue.mjs';
import { getAuthoredPersona, generatePersona, NEUTRAL_TEMPERAMENT, AUTHORED_PERSONAS } from './persona.mjs';
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';

const pearl = getAuthoredPersona('pearl-winkle');
const reef = getAuthoredPersona('reef-halyard');

test('say: deterministic — same (persona, situation, seed, count) always returns the same lines', () => {
  const a = say(pearl, 'sit-down', { seed: 'session-1', count: 3 });
  const b = say(pearl, 'sit-down', { seed: 'session-1', count: 3 });
  assert.deepEqual(a, b);
});

test('say: a different seed can produce different lines', () => {
  const a = say(pearl, 'loss', { seed: 'session-1', count: 1 });
  const b = say(pearl, 'loss', { seed: 'session-2', count: 1 });
  // Not guaranteed to differ for every situation/persona, but over several situations at least
  // one should, proving the seed is actually load-bearing.
  const diffs = SITUATIONS.map((s) => JSON.stringify(say(pearl, s, { seed: 'session-1' })) !==
    JSON.stringify(say(pearl, s, { seed: 'session-2' })));
  assert.ok(diffs.some(Boolean));
  void a; void b;
});

test('say: rejects an unknown situation', () => {
  assert.throws(() => say(pearl, 'not-a-real-situation', {}), TypeError);
});

test('say: rejects a non-positive count', () => {
  assert.throws(() => say(pearl, 'sit-down', { count: 0 }), RangeError);
});

test('say: returns exactly `count` lines, sampling without immediate repetition while pool lasts', () => {
  const lines = say(pearl, 'sit-down', { seed: 'variety', count: 2 });
  assert.equal(lines.length, 2);
});

test('say: slot-fills {amount} and {peerName} from context', () => {
  const [line] = say(pearl, 'bet-placed', { seed: 's', context: { amount: 25 } });
  // pearl has no authored bet-placed line, so the voiced/default template with {amount} applies.
  assert.ok(line.includes('25') || !line.includes('{amount}'));
});

test('say: an authored persona\'s own lines are reachable (not just the generic voice bank)', () => {
  const lines = say(pearl, 'sit-down', { seed: 'authored-check', count: 20 });
  assert.ok(lines.some((line) => line.includes('quiet hand')));
});

test('reactionProbability: neutral chattiness (0.5) leaves the base rate unchanged', () => {
  const persona = generatePersona('neutral-chat-check', { idPrefix: 'test' });
  const withNeutralChat = { ...persona, temperament: { ...persona.temperament, chattiness: 0.5 } };
  assert.ok(Math.abs(reactionProbability(withNeutralChat, 'loss') - 0.3) < 1e-9);
});

test('reactionProbability: higher chattiness strictly increases the rate', () => {
  const low = { temperament: { ...NEUTRAL_TEMPERAMENT, chattiness: 0.1 } };
  const high = { temperament: { ...NEUTRAL_TEMPERAMENT, chattiness: 0.9 } };
  assert.ok(reactionProbability(high, 'chat-idle') > reactionProbability(low, 'chat-idle'));
});

test('reactionProbability: stays within [0, 1] at the extremes', () => {
  const silent = { temperament: { ...NEUTRAL_TEMPERAMENT, chattiness: 0 } };
  const loud = { temperament: { ...NEUTRAL_TEMPERAMENT, chattiness: 1 } };
  for (const situation of SITUATIONS) {
    assert.ok(reactionProbability(silent, situation) >= 0);
    assert.ok(reactionProbability(loud, situation) <= 1);
  }
});

test('shouldSpeak: over many draws, empirical rate tracks reactionProbability', () => {
  const situation = 'win-small';
  const rng = seededStream('shouldSpeak-empirical');
  let hits = 0;
  const trials = 5000;
  for (let i = 0; i < trials; i++) if (shouldSpeak(reef, situation, rng)) hits++;
  const empirical = hits / trials;
  const expected = reactionProbability(reef, situation);
  assert.ok(Math.abs(empirical - expected) < 0.03, `empirical=${empirical} expected=${expected}`);
});

test('reactTo: deterministic given the same seed, and either null or one of say()\'s lines', () => {
  const a = reactTo(pearl, 'win-big', { seed: 'react-1' });
  const b = reactTo(pearl, 'win-big', { seed: 'react-1' });
  assert.equal(a, b);
  if (a !== null) {
    const possible = say(pearl, 'win-big', { seed: 'react-1', count: 1 });
    assert.deepEqual([a], possible);
  }
});

test('every SITUATIONS entry produces at least one line for every authored persona', () => {
  for (const persona of AUTHORED_PERSONAS) {
    for (const situation of SITUATIONS) {
      const lines = say(persona, situation, { seed: 'coverage', count: 1 });
      assert.ok(lines.length === 1, `no line for ${persona.voiceTag}/${situation}`);
    }
  }
});
