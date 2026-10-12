import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createShoeComposition, removeRanksFromComposition, handEV } from '@red-cup-engineering/card-table/blackjack';
import {
  blackjackPolicy, deviationProbability, trailingLossStreak, toIntent,
} from './blackjack.mjs';
import { NEUTRAL_TEMPERAMENT, generatePersona } from '../persona.mjs';
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';

const HARD_16_VS_10 = () => ({
  playerRanks: [10, 6],
  upcardRank: 10,
  composition: removeRanksFromComposition(createShoeComposition(6), [10, 6, 10]),
  options: { hitSoft17: false },
});

const HARD_20_VS_7 = () => ({
  playerRanks: [10, 10],
  upcardRank: 7,
  composition: removeRanksFromComposition(createShoeComposition(6), [10, 10, 7]),
  options: { hitSoft17: false },
});

const ACE_PAIR_VS_6 = () => ({
  playerRanks: [1, 1],
  upcardRank: 6,
  composition: removeRanksFromComposition(createShoeComposition(6), [1, 1, 6]),
  options: { hitSoft17: false },
});

test('trailingLossStreak: counts only the trailing run of losses', () => {
  assert.equal(trailingLossStreak([]), 0);
  assert.equal(trailingLossStreak(['win', 'loss', 'loss']), 2);
  assert.equal(trailingLossStreak(['loss', 'loss', 'win']), 0);
  assert.equal(trailingLossStreak(['loss', 'loss', 'loss', 'loss']), 4);
});

test('deviationProbability: exactly 0 at NEUTRAL_TEMPERAMENT regardless of loss streak', () => {
  assert.equal(deviationProbability({ temperament: NEUTRAL_TEMPERAMENT }, []), 0);
  assert.equal(deviationProbability({ temperament: NEUTRAL_TEMPERAMENT }, ['loss', 'loss', 'loss', 'loss']), 0);
});

test('deviationProbability: 0 at or below riskTolerance 0.5 with no tiltProneness, any loss streak', () => {
  const persona = { temperament: { ...NEUTRAL_TEMPERAMENT, riskTolerance: 0.2, tiltProneness: 0 } };
  assert.equal(deviationProbability(persona, ['loss', 'loss', 'loss']), 0);
});

test('deviationProbability: stays within [0, 0.85] at the most extreme temperament', () => {
  const persona = { temperament: { ...NEUTRAL_TEMPERAMENT, riskTolerance: 1, tiltProneness: 1 } };
  const p = deviationProbability(persona, ['loss', 'loss', 'loss', 'loss', 'loss']);
  assert.ok(p > 0 && p <= 0.85, `${p}`);
});

test('deviationProbability: a trailing loss streak raises the rate for a tilt-prone persona', () => {
  const persona = { temperament: { ...NEUTRAL_TEMPERAMENT, tiltProneness: 0.8 } };
  const noStreak = deviationProbability(persona, []);
  const streak = deviationProbability(persona, ['loss', 'loss', 'loss']);
  assert.ok(streak > noStreak);
});

// ── The core correctness guarantee ──────────────────────────────────────────────────────────

test('NEUTRAL_TEMPERAMENT always plays the exact-EV action, across hands and rng draws', () => {
  const persona = { id: 'neutral-test', temperament: NEUTRAL_TEMPERAMENT };
  const rng = seededStream('neutral-exact-ev');
  // NEUTRAL_TEMPERAMENT makes deviationProbability exactly 0, so rng.chance is never even
  // reached (see blackjackPolicy's short-circuit) — the result is identical for any rng state
  // given a fixed game state. A handful of iterations against distinct rng draws is enough to
  // demonstrate that rng-invariance; it isn't a statistical test, so it stays cheap. (The
  // recursive EV enumeration itself is real work — see the standalone `ace pair vs 6` test
  // below for why a *split*-eligible scenario is deliberately exercised only once per test,
  // not looped: card-table's own handEV.test.mts documents this shape of computation as
  // exact-but-not-free.)
  const scenarios = [HARD_16_VS_10, HARD_20_VS_7];
  for (let i = 0; i < 3; i++) {
    for (const scenario of scenarios) {
      const state = scenario();
      const decision = blackjackPolicy(state, persona, rng);
      const expectedEv = handEV(state.playerRanks, state.upcardRank, state.composition, state.options);
      const best = Object.entries({ stand: expectedEv.stand, hit: expectedEv.hit, double: expectedEv.double, split: expectedEv.split })
        .filter(([, v]) => v !== null && Number.isFinite(v))
        .sort((a, b) => b[1] - a[1])[0][0];
      assert.equal(decision.action, best, `scenario=${scenario.name}`);
      assert.equal(decision.deviated, false);
      assert.equal(decision.deviationCost, 0);
    }
  }
});

test('hard 20 vs 7: neutral temperament stands (the textbook always-stand case)', () => {
  const persona = { id: 'neutral', temperament: NEUTRAL_TEMPERAMENT };
  const rng = seededStream('hard20');
  const decision = blackjackPolicy(HARD_20_VS_7(), persona, rng);
  assert.equal(decision.action, 'stand');
});

test('ace pair vs 6: neutral temperament splits (splitting aces beats playing the pair)', () => {
  const persona = { id: 'neutral', temperament: NEUTRAL_TEMPERAMENT };
  const rng = seededStream('acepair');
  const decision = blackjackPolicy(ACE_PAIR_VS_6(), persona, rng);
  assert.equal(decision.action, 'split');
  assert.equal(decision.canSplit, true);
});

// ── Deviation is bounded and always costed ──────────────────────────────────────────────────

test('deviation is bounded to the single next-best legal action by EV, never worse', () => {
  const highRoller = { id: 'risky', temperament: { ...NEUTRAL_TEMPERAMENT, riskTolerance: 1, tiltProneness: 1 } };
  const state = HARD_16_VS_10();
  const ev = handEV(state.playerRanks, state.upcardRank, state.composition, state.options);
  const ranked = Object.entries({ stand: ev.stand, hit: ev.hit, double: ev.double, split: ev.split })
    .filter(([, v]) => v !== null && Number.isFinite(v))
    .sort((a, b) => b[1] - a[1]);
  const secondBestEV = ranked[1][1];

  // Each blackjackPolicy call here re-runs a real recursive EV enumeration (not a table
  // lookup), so the trial count is kept modest — 300 draws is already overwhelming odds of
  // seeing a deviation at this temperament's ~0.85 probability, without making the suite slow.
  let sawDeviation = false;
  const rng = seededStream('bounded-deviation');
  for (let i = 0; i < 300; i++) {
    const decision = blackjackPolicy({ ...state, recentOutcomes: ['loss', 'loss', 'loss'] }, highRoller, rng);
    assert.ok(decision.deviationCost >= -1e-9, `deviationCost=${decision.deviationCost}`);
    assert.ok(decision.chosenEV >= secondBestEV - 1e-9, `chosenEV=${decision.chosenEV} < secondBestEV=${secondBestEV}`);
    if (decision.deviated) sawDeviation = true;
  }
  assert.ok(sawDeviation, 'expected at least one deviation over 300 draws for an extreme temperament');
});

test('deviationCost is always bestEV - chosenEV, exactly, and >= 0', () => {
  const persona = { id: 'mid', temperament: { ...NEUTRAL_TEMPERAMENT, riskTolerance: 0.9, tiltProneness: 0.6 } };
  const rng = seededStream('cost-check');
  for (let i = 0; i < 100; i++) {
    const decision = blackjackPolicy({ ...HARD_16_VS_10(), recentOutcomes: ['loss', 'loss'] }, persona, rng);
    assert.ok(Math.abs(decision.deviationCost - (decision.bestEV - decision.chosenEV)) < 1e-9);
    assert.ok(decision.deviationCost >= -1e-9);
  }
});

test('empirical deviation rate over many draws tracks deviationProbability within tolerance', () => {
  const persona = { id: 'stat-check', temperament: { ...NEUTRAL_TEMPERAMENT, riskTolerance: 0.9, tiltProneness: 0.3 } };
  const state = HARD_16_VS_10();
  const expected = deviationProbability(persona, []);
  const rng = seededStream('empirical-deviation-rate', 'trial');
  let deviations = 0;
  // 600 trials of a real recursive EV computation each (not a lookup) keeps this well under a
  // few seconds; the tolerance below is widened accordingly to keep the expected sampling
  // noise (std error ~= sqrt(0.25/600) =~ 0.02) comfortably inside it.
  const trials = 600;
  for (let i = 0; i < trials; i++) {
    if (blackjackPolicy(state, persona, rng).deviated) deviations++;
  }
  const empirical = deviations / trials;
  assert.ok(Math.abs(empirical - expected) < 0.06, `empirical=${empirical} expected=${expected}`);
});

test('generated personas also satisfy the neutral-exact-EV property when forced to neutral temperament', () => {
  const generated = generatePersona('policy-generated-check');
  const neutralized = { ...generated, temperament: NEUTRAL_TEMPERAMENT };
  const rng = seededStream('generated-neutral');
  const decision = blackjackPolicy(HARD_20_VS_7(), neutralized, rng);
  assert.equal(decision.action, 'stand');
  assert.equal(decision.deviated, false);
});

test('toIntent: wraps the chosen action in the blackjack-action wire shape', () => {
  const decision = { action: 'hit' };
  assert.deepEqual(toIntent(decision), { kind: 'blackjack-action', action: 'hit' });
});
