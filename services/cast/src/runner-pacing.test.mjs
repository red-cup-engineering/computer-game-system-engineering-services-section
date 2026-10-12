import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thinkDelayMs, actDelayMs, chatDelayMs } from './runner-pacing.mjs';
import { NEUTRAL_TEMPERAMENT } from './persona.mjs';
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';

test('thinkDelayMs: deterministic given the same rng stream position', () => {
  const persona = { temperament: NEUTRAL_TEMPERAMENT };
  const a = thinkDelayMs(persona, seededStream('pace-1'));
  const b = thinkDelayMs(persona, seededStream('pace-1'));
  assert.equal(a, b);
});

test('thinkDelayMs: always a positive number of milliseconds', () => {
  const persona = { temperament: NEUTRAL_TEMPERAMENT };
  const rng = seededStream('positive-check');
  for (let i = 0; i < 200; i++) assert.ok(thinkDelayMs(persona, rng) > 0);
});

test('thinkDelayMs: a patient persona takes longer, on average, than an impatient one', () => {
  const impatient = { temperament: { ...NEUTRAL_TEMPERAMENT, patience: 0.05 } };
  const patient = { temperament: { ...NEUTRAL_TEMPERAMENT, patience: 0.95 } };
  const avg = (persona, seed) => {
    const rng = seededStream(seed);
    let total = 0;
    const n = 300;
    for (let i = 0; i < n; i++) total += thinkDelayMs(persona, rng);
    return total / n;
  };
  assert.ok(avg(impatient, 'think-impatient') < avg(patient, 'think-patient'));
});

test('actDelayMs: shorter on average than thinkDelayMs for the same temperament', () => {
  const persona = { temperament: NEUTRAL_TEMPERAMENT };
  const avg = (fn, seed) => {
    const rng = seededStream(seed);
    let total = 0;
    const n = 300;
    for (let i = 0; i < n; i++) total += fn(persona, rng);
    return total / n;
  };
  assert.ok(avg(actDelayMs, 'act-avg') < avg(thinkDelayMs, 'think-avg'));
});

test('chatDelayMs: always positive and deterministic', () => {
  const persona = { temperament: NEUTRAL_TEMPERAMENT };
  const a = chatDelayMs(persona, seededStream('chat-1'));
  const b = chatDelayMs(persona, seededStream('chat-1'));
  assert.equal(a, b);
  assert.ok(a > 0);
});
