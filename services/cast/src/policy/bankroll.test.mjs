import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buyInAmount, betSize, sessionLengthTarget, walkAwayReason, bankrollPolicy,
} from './bankroll.mjs';
import { NEUTRAL_TEMPERAMENT, getAuthoredPersona } from '../persona.mjs';
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';

const pearl = getAuthoredPersona('pearl-winkle'); // cautious, low riskTolerance
const reef = getAuthoredPersona('reef-halyard'); // high-roller, high riskTolerance

const baseTable = { tableMinBet: 5, tableMaxBet: 500 };

test('buyInAmount: a cautious persona buys in for less than a high-roller at the same table', () => {
  const pearlBuyIn = buyInAmount(baseTable, pearl);
  const reefBuyIn = buyInAmount(baseTable, reef);
  assert.ok(pearlBuyIn < reefBuyIn, `${pearlBuyIn} should be < ${reefBuyIn}`);
});

test('buyInAmount: always at least the table minimum, scaled sensibly', () => {
  const amount = buyInAmount(baseTable, pearl);
  assert.ok(amount >= baseTable.tableMinBet);
});

test('betSize: deterministic given the same rng stream position', () => {
  const state = { chips: 1000, tableMinBet: 5, tableMaxBet: 500, recentOutcomes: [] };
  const a = betSize(state, reef, seededStream('bet-size-1'));
  const b = betSize(state, reef, seededStream('bet-size-1'));
  assert.equal(a, b);
});

test('betSize: always within [tableMinBet, min(tableMaxBet, chips)]', () => {
  const state = { chips: 40, tableMinBet: 5, tableMaxBet: 500, recentOutcomes: [] };
  const rng = seededStream('bet-size-bounds');
  for (let i = 0; i < 200; i++) {
    const amount = betSize(state, reef, rng);
    assert.ok(amount >= state.tableMinBet && amount <= state.chips, `${amount}`);
  }
});

test('betSize: a high-roller bets more, on average, than a cautious persona at the same table', () => {
  const state = { chips: 100000, tableMinBet: 5, tableMaxBet: 500, recentOutcomes: [] };
  const rngA = seededStream('avg-bet-cautious');
  const rngB = seededStream('avg-bet-high-roller');
  const avg = (persona, rng) => {
    let total = 0;
    const n = 100;
    for (let i = 0; i < n; i++) total += betSize(state, persona, rng);
    return total / n;
  };
  assert.ok(avg(pearl, rngA) < avg(reef, rngB));
});

test('betSize: a tilt-prone persona bets more after a trailing loss streak', () => {
  const state = (recentOutcomes) => ({ chips: 100000, tableMinBet: 5, tableMaxBet: 500, recentOutcomes });
  const cove = getAuthoredPersona('cove-brackish'); // high tiltProneness
  const noStreak = betSize(state([]), cove, seededStream('tilt-a'));
  const streak = betSize(state(['loss', 'loss', 'loss']), cove, seededStream('tilt-a'));
  assert.ok(streak >= noStreak, `streak=${streak} noStreak=${noStreak}`);
});

test('sessionLengthTarget: higher patience yields a longer target, on average', () => {
  const impatient = { temperament: { ...NEUTRAL_TEMPERAMENT, patience: 0.1 } };
  const patient = { temperament: { ...NEUTRAL_TEMPERAMENT, patience: 0.9 } };
  const avg = (persona, seed) => {
    const rng = seededStream(seed);
    let total = 0;
    for (let i = 0; i < 50; i++) total += sessionLengthTarget(persona, rng);
    return total / 50;
  };
  assert.ok(avg(impatient, 'session-a') < avg(patient, 'session-b'));
});

test('walkAwayReason: bankroll-low fires when chips drop below the table minimum', () => {
  const state = { chips: 3, startingChips: 100, tableMinBet: 5, handsPlayed: 1 };
  assert.equal(walkAwayReason(state, pearl, seededStream('walk-1')), 'bankroll-low');
});

test('walkAwayReason: bankroll-target fires once chips clear the profit multiple', () => {
  const state = { chips: 1000, startingChips: 100, tableMinBet: 5, handsPlayed: 1 };
  assert.equal(walkAwayReason(state, pearl, seededStream('walk-2')), 'bankroll-target');
});

test('walkAwayReason: a cautious persona locks in profit at a lower multiple than a high-roller', () => {
  const chipsAt2x = { chips: 200, startingChips: 100, tableMinBet: 5, handsPlayed: 1 };
  const pearlReason = walkAwayReason(chipsAt2x, pearl, seededStream('lockin'));
  const reefReason = walkAwayReason(chipsAt2x, reef, seededStream('lockin'));
  assert.equal(pearlReason, 'bankroll-target');
  assert.notEqual(reefReason, 'bankroll-target');
});

test('walkAwayReason: session-length fires once handsPlayed exceeds the persona\'s own target', () => {
  // chips == startingChips (ratio 1.0) stays below any temperament's profit-target multiple
  // (the smallest is 1.3x), so this isolates the session-length branch from bankroll-target.
  const state = { chips: 100, startingChips: 100, tableMinBet: 5, handsPlayed: 500 };
  assert.equal(walkAwayReason(state, pearl, seededStream('walk-3')), 'session-length');
});

test('walkAwayReason: null (keep playing) for an ordinary mid-session state', () => {
  const state = { chips: 105, startingChips: 100, tableMinBet: 5, handsPlayed: 2 };
  assert.equal(walkAwayReason(state, pearl, seededStream('walk-4')), null);
});

test('bankrollPolicy: sits (buys in) when not yet seated', () => {
  const decision = bankrollPolicy({ seated: false, tableMinBet: 5, tableMaxBet: 500 }, pearl, seededStream('sit'));
  assert.equal(decision.action, 'sit');
  assert.ok(decision.buyIn > 0);
});

test('bankrollPolicy: bets when seated and no walk-away condition applies', () => {
  const state = {
    seated: true, chips: 105, startingChips: 100, tableMinBet: 5, tableMaxBet: 500,
    handsPlayed: 2, recentOutcomes: [],
  };
  const decision = bankrollPolicy(state, pearl, seededStream('bet'));
  assert.equal(decision.action, 'bet');
  assert.ok(decision.amount >= 5);
});

test('bankrollPolicy: walks away when a walk-away condition fires', () => {
  const state = {
    seated: true, chips: 2, startingChips: 100, tableMinBet: 5, tableMaxBet: 500,
    handsPlayed: 2, recentOutcomes: [],
  };
  const decision = bankrollPolicy(state, pearl, seededStream('walk-away'));
  assert.equal(decision.action, 'walk-away');
  assert.equal(decision.reason, 'bankroll-low');
});
