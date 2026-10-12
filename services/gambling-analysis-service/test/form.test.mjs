import test from 'node:test';
import assert from 'node:assert/strict';
import { erf, normalCdf, motionEstimate, firstPassageProbability, formProfile } from '../src/form.mjs';

test('erf and normal cdf sanity', () => {
  assert.ok(Math.abs(erf(0)) < 1e-9);
  assert.ok(Math.abs(erf(1) - 0.8427) < 1e-3);
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-9);
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-3);
});

test('motion estimate normalizes increments by root time-gap', () => {
  // constant +0.01 per hour sampled hourly: drift 0.01/h, diffusion 0
  const series = Array.from({ length: 10 }, (_, i) => ({ t: i * 3600000, value: 0.01 * i }));
  const m = motionEstimate(series);
  assert.ok(Math.abs(m.driftPerHour - 0.01) < 1e-12);
  assert.ok(m.diffusionPerRootHour < 1e-9);
  assert.equal(motionEstimate(series.slice(0, 2)), null);
});

test('first passage: distance and diffusion pull opposite ways', () => {
  const base = { driftPerHour: 0, diffusionPerRootHour: 0.005, horizonHours: 168 };
  const near = firstPassageProbability({ ...base, distance: 0.002 });
  const mid = firstPassageProbability({ ...base, distance: 0.05 });
  const far = firstPassageProbability({ ...base, distance: 0.05, diffusionPerRootHour: 0.001 });
  assert.ok(near > 0.5 && near <= 1);
  assert.ok(mid > far && near > mid);
  assert.ok(far < 0.05);
  // closing drift raises the probability
  const closing = firstPassageProbability({ ...base, distance: 0.02, driftPerHour: -0.001 });
  const still = firstPassageProbability({ ...base, distance: 0.02 });
  assert.ok(closing > still);
  // zero-diffusion or zero-horizon is unanswerable, not zero
  assert.equal(firstPassageProbability({ distance: 0.01, diffusionPerRootHour: 0, horizonHours: 1 }), null);
});

test('form profile compresses a series into distance + motion + probability', () => {
  const series = Array.from({ length: 16 }, (_, i) => ({ t: i * 1800000, value: -0.01 + (i % 2 ? 0.002 : -0.002) }));
  const f = formProfile(series, { horizonHours: 72, now: 15 * 1800000 + 60000 });
  assert.ok(f.distance > 0);
  assert.ok(f.diffusionPerRootHour > 0);
  assert.ok(f.crossingProbability > 0 && f.crossingProbability <= 1);
  assert.equal(f.samples, 16);
});

test('white-army regression: strong away-drift deep tail is ~0, not 1', () => {
  const p = firstPassageProbability({ distance: 0.5, driftPerHour: -2e-4, diffusionPerRootHour: 5e-4, horizonHours: 168 });
  assert.ok(p < 1e-6);
});

test('blue-army regressions: stale and short-span series refuse a probability', () => {
  const mkSeries = (n, step) => Array.from({ length: n }, (_, i) => ({ t: i * step, value: -0.01 + (i % 2 ? 0.003 : -0.003) }));
  const stale = formProfile(mkSeries(16, 1800000), { now: 15 * 1800000 + 500 * 3600000 });
  assert.equal(stale.crossingProbability, null);
  const jitter = formProfile(mkSeries(4, 220000), { now: 4 * 220000 });
  assert.equal(jitter.crossingProbability, null);
});
