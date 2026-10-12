import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePersona, getPersona, getAuthoredPersona, listAuthoredPersonaIds,
  assertValidTemperament, isNeutralTemperament, NEUTRAL_TEMPERAMENT,
} from './persona.mjs';

test('generatePersona: deterministic — same seed, byte-identical persona', () => {
  const a = generatePersona('table-42:seat-3');
  const b = generatePersona('table-42:seat-3');
  assert.deepEqual(a, b);
});

test('generatePersona: different seeds produce different personas', () => {
  const a = generatePersona('seat-1');
  const b = generatePersona('seat-2');
  assert.notEqual(a.id, b.id);
});

test('generatePersona: id is namespaced and never collides with an authored id', () => {
  const persona = generatePersona('any-seed');
  assert.ok(persona.id.startsWith('generated:'));
  assert.ok(!listAuthoredPersonaIds().includes(persona.id));
});

test('generatePersona: custom idPrefix is honored', () => {
  const persona = generatePersona('any-seed', { idPrefix: 'floor-7' });
  assert.ok(persona.id.startsWith('floor-7:'));
});

test('generatePersona: produces a valid temperament and a coherent avatar', () => {
  const persona = generatePersona('coherence-check');
  assertValidTemperament(persona.temperament);
  assert.equal(typeof persona.avatar.drawable, 'string');
  assert.match(persona.avatar.tint, /^#[0-9a-f]{6}$/i);
});

test('generatePersona: rejects an empty seed', () => {
  assert.throws(() => generatePersona(''), TypeError);
});

test('generatePersona: over many seeds, produces varied (not constant) temperament dimensions', () => {
  const riskValues = new Set();
  for (let i = 0; i < 50; i++) riskValues.add(generatePersona(`variety-${i}`).temperament.riskTolerance);
  assert.ok(riskValues.size > 10, `expected variety, got ${riskValues.size} distinct values`);
});

test('assertValidTemperament: rejects an out-of-range or missing dimension', () => {
  assert.throws(() => assertValidTemperament({ ...NEUTRAL_TEMPERAMENT, riskTolerance: 1.5 }), RangeError);
  const { patience: _patience, ...missingPatience } = NEUTRAL_TEMPERAMENT;
  assert.throws(() => assertValidTemperament(missingPatience), RangeError);
});

test('isNeutralTemperament: true only for the exact neutral baseline', () => {
  assert.equal(isNeutralTemperament(NEUTRAL_TEMPERAMENT), true);
  assert.equal(isNeutralTemperament({ ...NEUTRAL_TEMPERAMENT, riskTolerance: 0.51 }), false);
});

test('getPersona / getAuthoredPersona: authored lookups agree; unknown returns null', () => {
  assert.equal(getPersona('pearl-winkle')?.name, getAuthoredPersona('pearl-winkle')?.name);
  assert.equal(getPersona('does-not-exist'), null);
});
