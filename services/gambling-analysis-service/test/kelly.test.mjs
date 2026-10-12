import test from 'node:test';
import assert from 'node:assert/strict';
import { kellyFraction, kellyForContract, fractionalKelly, expectedLogGrowth, simultaneousStakes } from '../src/kelly.mjs';
import { overround, fairProbabilities, midpoint, evPerContract, priceToDecimalOdds, decimalOddsToPrice } from '../src/odds.mjs';

test('kelly fraction: classic values', () => {
  // p=0.6 at even odds (c=0.5): f* = (0.6-0.5)/0.5 = 0.2
  assert.ok(Math.abs(kellyFraction({ probability: 0.6, cost: 0.5 }) - 0.2) < 1e-12);
  // no edge -> 0, negative edge -> 0
  assert.equal(kellyFraction({ probability: 0.5, cost: 0.5 }), 0);
  assert.equal(kellyFraction({ probability: 0.4, cost: 0.5 }), 0);
});

test('fees can delete the edge entirely', () => {
  assert.ok(kellyForContract({ probability: 0.52, price: 0.5, feePerContract: 0.0175 }) > 0);
  assert.equal(kellyForContract({ probability: 0.51, price: 0.5, feePerContract: 0.0175 }), 0);
});

test('kelly maximizes expected log growth', () => {
  const p = 0.6, c = 0.5;
  const f = kellyFraction({ probability: p, cost: c });
  const atKelly = expectedLogGrowth({ probability: p, cost: c, fraction: f });
  for (const df of [-0.05, 0.05]) {
    assert.ok(atKelly > expectedLogGrowth({ probability: p, cost: c, fraction: f + df }));
  }
  assert.ok(atKelly > 0);
});

test('fractional kelly halves the stake and respects the drawdown cap', () => {
  assert.ok(Math.abs(fractionalKelly({ probability: 0.6, cost: 0.5, lambda: 0.5 }) - 0.1) < 1e-12);
  assert.equal(fractionalKelly({ probability: 0.9, cost: 0.2, lambda: 1, maxLossFraction: 0.3 }), 0.3);
});

test('simultaneous stakes rescale to the total cap', () => {
  const edges = Array.from({ length: 5 }, (_, i) => ({ id: i, probability: 0.6, cost: 0.5 }));
  const stakes = simultaneousStakes(edges, { lambda: 1, maxTotalFraction: 0.25 });
  const total = stakes.reduce((s, e) => s + e.fraction, 0);
  assert.ok(Math.abs(total - 0.25) < 1e-12);
  assert.ok(stakes.every((e) => e.scaled));
});

test('odds arithmetic', () => {
  assert.ok(Math.abs(overround([0.55, 0.55]) - 0.1) < 1e-12);
  const fair = fairProbabilities([0.55, 0.55]);
  assert.ok(Math.abs(fair[0] - 0.5) < 1e-12);
  assert.equal(midpoint({ bid: 0.4, ask: 0.5 }), 0.45);
  assert.ok(Math.abs(evPerContract({ probability: 0.6, cost: 0.5 }) - 0.1) < 1e-12);
  assert.equal(priceToDecimalOdds(0.5), 2);
  assert.equal(decimalOddsToPrice(4), 0.25);
  assert.throws(() => midpoint({ bid: 0.6, ask: 0.5 }));
});
