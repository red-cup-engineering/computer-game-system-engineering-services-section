import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORED_PERSONAS, getAuthoredPersona, listAuthoredPersonaIds } from './roster.mjs';
import { assertValidTemperament } from '../persona.mjs';

test('roster ships between six and eight authored personas', () => {
  assert.ok(AUTHORED_PERSONAS.length >= 6 && AUTHORED_PERSONAS.length <= 8, `${AUTHORED_PERSONAS.length}`);
});

test('every authored persona has a valid, distinct temperament vector', () => {
  const seen = new Set();
  for (const persona of AUTHORED_PERSONAS) {
    assertValidTemperament(persona.temperament);
    const key = JSON.stringify(persona.temperament);
    assert.ok(!seen.has(key), `duplicate temperament vector for ${persona.id}`);
    seen.add(key);
  }
});

test('every authored persona has a unique id, name, and voiceTag', () => {
  const ids = new Set();
  const names = new Set();
  const voiceTags = new Set();
  for (const persona of AUTHORED_PERSONAS) {
    assert.ok(!ids.has(persona.id), `duplicate id ${persona.id}`);
    assert.ok(!names.has(persona.name), `duplicate name ${persona.name}`);
    assert.ok(!voiceTags.has(persona.voiceTag), `duplicate voiceTag ${persona.voiceTag}`);
    ids.add(persona.id);
    names.add(persona.name);
    voiceTags.add(persona.voiceTag);
  }
});

test('every authored persona has a coherent avatar spec', () => {
  for (const persona of AUTHORED_PERSONAS) {
    assert.equal(typeof persona.avatar.drawable, 'string');
    assert.ok(persona.avatar.drawable.length > 0);
    assert.equal(typeof persona.avatar.tint, 'string');
    assert.match(persona.avatar.tint, /^#[0-9a-f]{6}$/i);
  }
});

test('getAuthoredPersona: known id resolves, unknown id returns null', () => {
  assert.equal(getAuthoredPersona('pearl-winkle')?.name, 'Pearl Winkle');
  assert.equal(getAuthoredPersona('nobody-here'), null);
});

test('listAuthoredPersonaIds: matches the roster, no id contains ":" (reserved for generated ids)', () => {
  const ids = listAuthoredPersonaIds();
  assert.equal(ids.length, AUTHORED_PERSONAS.length);
  for (const id of ids) assert.ok(!id.includes(':'), `authored id "${id}" must not contain ":"`);
});
