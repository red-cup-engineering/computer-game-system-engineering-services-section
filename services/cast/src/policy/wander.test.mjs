import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAuthoredPersona } from '../persona.mjs';
import { seededStream } from '@red-cup-engineering/computer-data-engineering-services-section/randomization/stream';
import { wanderPolicy } from './wander.mjs';

function rngFor(seed) {
  return seededStream(seed, 'test');
}

test('wanderPolicy: replies with a non-empty dialogue line when addressed', () => {
  const persona = getAuthoredPersona('reef-halyard');
  const state = {
    room: { name: 'The Garden Gate', description: '', occupants: [], exits: ['north'] },
    addressedLines: [{ kind: 'say', from: 'Gull Corbin', text: 'Ahoy reef-halyard!' }],
    rawLines: [],
    ended: false,
  };
  const decision = wanderPolicy(state, persona, rngFor('wander-reply-1'));
  assert.equal(decision.action, 'say');
  assert.equal(typeof decision.message, 'string');
  assert.ok(decision.message.length > 0);
  assert.deepEqual(decision.respondingTo, state.addressedLines[0]);
});

test('wanderPolicy: same (seed, state) reproduces the same reply line', () => {
  const persona = getAuthoredPersona('marina-quill');
  const state = {
    room: { name: 'Room', description: '', occupants: [], exits: [] },
    addressedLines: [{ kind: 'tell', from: 'Otter Vance', text: 'hello' }],
    rawLines: [],
    ended: false,
  };
  const first = wanderPolicy(state, persona, rngFor('same-seed'));
  const second = wanderPolicy(state, persona, rngFor('same-seed'));
  assert.deepEqual(first, second);
});

test('wanderPolicy: picks one of the room exits via the injected rng when not addressed', () => {
  const persona = getAuthoredPersona('gull-corbin');
  const state = {
    room: { name: 'Room', description: '', occupants: [], exits: ['north', 'south'] },
    addressedLines: [],
    rawLines: [],
    ended: false,
  };
  const decision = wanderPolicy(state, persona, rngFor('wander-move'));
  assert.equal(decision.action, 'go');
  assert.ok(['north', 'south'].includes(decision.direction));
});

test('wanderPolicy: looks when the room has no known exits yet', () => {
  const persona = getAuthoredPersona('otter-vance');
  const state = { room: null, addressedLines: [], rawLines: [], ended: false };
  assert.deepEqual(wanderPolicy(state, persona, rngFor('no-room')), { action: 'look' });

  const emptyExits = { room: { name: 'Room', description: '', occupants: [], exits: [] }, addressedLines: [], rawLines: [], ended: false };
  assert.deepEqual(wanderPolicy(emptyExits, persona, rngFor('empty-exits')), { action: 'look' });
});
