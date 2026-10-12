import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseBet, classifySpinOutcome, slotsPolicy, toIntent } from './slots.mjs';
import { getAuthoredPersona } from '../persona.mjs';
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';

const pearl = getAuthoredPersona('pearl-winkle'); // cautious
const reef = getAuthoredPersona('reef-halyard'); // high-roller

test('chooseBet: a cautious persona picks a lower denomination than a high-roller, on average', () => {
  const state = { chips: 10000, betOptions: [1, 5, 25, 100] };
  const avg = (persona, seed) => {
    const rng = seededStream(seed);
    let total = 0;
    for (let i = 0; i < 100; i++) total += chooseBet(state, persona, rng);
    return total / 100;
  };
  assert.ok(avg(pearl, 'slots-cautious') < avg(reef, 'slots-high-roller'));
});

test('chooseBet: only ever returns an option from betOptions', () => {
  const state = { chips: 10000, betOptions: [1, 5, 25, 100] };
  const rng = seededStream('bet-options-only');
  for (let i = 0; i < 100; i++) {
    assert.ok(state.betOptions.includes(chooseBet(state, reef, rng)));
  }
});

test('chooseBet: filters to affordable options when chips are limited', () => {
  const state = { chips: 6, betOptions: [1, 5, 25, 100] };
  const rng = seededStream('affordable');
  for (let i = 0; i < 50; i++) {
    assert.ok(chooseBet(state, reef, rng) <= 6);
  }
});

test('chooseBet: falls back to continuous betSize when betOptions is absent', () => {
  const state = { chips: 1000 };
  const rng = seededStream('no-options');
  const bet = chooseBet(state, reef, rng);
  assert.ok(Number.isFinite(bet) && bet > 0 && bet <= 1000);
});

test('classifySpinOutcome: jackpot always classifies as win-big', () => {
  assert.equal(classifySpinOutcome({ payout: 0, bet: 5, jackpot: true }), 'win-big');
});

test('classifySpinOutcome: a large multiple of the bet is win-big, a modest one is win-small', () => {
  assert.equal(classifySpinOutcome({ payout: 500, bet: 5 }), 'win-big'); // 100x
  assert.equal(classifySpinOutcome({ payout: 10, bet: 5 }), 'win-small'); // 2x
});

test('classifySpinOutcome: a zero-payout near-miss classifies as near-miss, an ordinary loss as null', () => {
  assert.equal(classifySpinOutcome({ payout: 0, bet: 5, nearMiss: true }), 'near-miss');
  assert.equal(classifySpinOutcome({ payout: 0, bet: 5 }), null);
});

test('slotsPolicy: always spins, with a bet from chooseBet', () => {
  const state = { chips: 1000, betOptions: [1, 5, 25] };
  const decision = slotsPolicy(state, pearl, seededStream('policy-spin'));
  assert.equal(decision.action, 'spin');
  assert.ok(state.betOptions.includes(decision.bet));
});

test('toIntent: wraps the bet in the slot-spin wire shape', () => {
  assert.deepEqual(toIntent({ action: 'spin', bet: 5 }), { kind: 'slot-spin', bet: 5 });
});
