import test from 'node:test';
import assert from 'node:assert/strict';
import { lensVotes, heat, stakeMultiplier } from '../src/confluence.mjs';

test('proximity group takes the max of edge and form, never both', () => {
  const both = lensVotes({ edgePerContract: 0.01, crossingProbability: 0.9 });
  const formOnly = lensVotes({ edgePerContract: -0.01, crossingProbability: 0.9 });
  assert.equal(both.proximity, 1);
  assert.equal(formOnly.proximity, 0.9);
});

test('more agreeing lenses means hotter', () => {
  const one = heat({ crossingProbability: 0.9, volumeUsd: 5000 });
  const two = heat({ crossingProbability: 0.9, makerMarginIfFilled: 0.04, volumeUsd: 5000 });
  const three = heat({ crossingProbability: 0.9, makerMarginIfFilled: 0.04, timesPositive: 3, timesSeen: 10, volumeUsd: 5000 });
  const four = heat({ crossingProbability: 0.9, makerMarginIfFilled: 0.04, timesPositive: 3, timesSeen: 10, privateVisibility: true, volumeUsd: 5000 });
  assert.ok(one.score < two.score && two.score < three.score && three.score < four.score);
  assert.equal(four.grade, 'burning');
});

test('persistence lens needs enough observations to vote', () => {
  assert.equal(lensVotes({ timesPositive: 2, timesSeen: 2 }).persistence, 0);
  assert.ok(lensVotes({ timesPositive: 2, timesSeen: 5 }).persistence > 0);
});

test('illiquidity gates the score down, not to zero', () => {
  const liquid = heat({ crossingProbability: 1, makerMarginIfFilled: 0.04, volumeUsd: 5000 });
  const dead = heat({ crossingProbability: 1, makerMarginIfFilled: 0.04, volumeUsd: 5 });
  assert.ok(dead.score < liquid.score * 0.3);
});

test('stake multiplier maps grades and defaults to zero', () => {
  assert.equal(stakeMultiplier('burning'), 1);
  assert.equal(stakeMultiplier('cold'), 0);
  assert.equal(stakeMultiplier('unknown'), 0);
});

test('blue-army regressions: dust never burns, unknown liquidity halves', () => {
  const dust = heat({ edgePerContract: 0.0001, timesPositive: 3, timesSeen: 3, privateVisibility: true });
  assert.equal(dust.grade, 'cold');
  const unknown = heat({ crossingProbability: 1, makerMarginIfFilled: 0.04 });
  const known = heat({ crossingProbability: 1, makerMarginIfFilled: 0.04, volumeUsd: 5000 });
  assert.ok(Math.abs(unknown.score - known.score * 0.5) < 1e-9);
});
