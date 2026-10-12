// prove-room — the legacy starting-room world, PORTED onto the agential substrate. The world
// is built by `doing` ambient intra-actions (no agency ⇒ world-authoritative, sensible by all);
// `look` (observing) renders name/description/exits/contents — name=naming, description=describing,
// exit=exit-to, contents=converse of located-in (object-anchor cache). Movement is `changing`
// (functional located-in supersedes). Parity with the legacy observable room — predications not
// has-x; the world is real files on disk.

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import doing from '#doing';
import changing from '#changing';
import { look } from '#observing';

const root = await mkdtemp(join(tmpdir(), 'tab-room-'));
const ambient = (subject, predicate, object, t) => doing({ root, subject, predicate, object, t }); // no agent = ambient

try {
  // Build the world as ambient predications.
  await ambient('the-starting-room', 'naming', 'the starting room', 't1');
  await ambient('the-starting-room', 'describing', 'A small, well-lit room.', 't1');
  await ambient('the-starting-room', 'exit-out', 'test-area-2', 't1');
  await ambient('test-area-2', 'naming', 'test area 2', 't1');
  await ambient('test-area-2', 'exit-back', 'the-starting-room', 't1');
  await ambient('a-pebble', 'naming', 'a pebble', 't1');
  await ambient('test-mobile', 'naming', 'a wanderer', 't1');
  // Place the pebble and the wanderer in the room (functional located-in).
  await changing({ root, subject: 'a-pebble', predicate: 'located-in', object: 'the-starting-room', t: 't2' });
  await changing({ root, subject: 'test-mobile', predicate: 'located-in', object: 'the-starting-room', t: 't2' });

  // === look at the room ===
  const v1 = await look({ root, observer: 'alice', subject: 'the-starting-room' });
  assert.equal(v1.name, 'the starting room');
  assert.equal(v1.description, 'A small, well-lit room.');
  assert.deepEqual(v1.exits, { out: 'test-area-2' });
  assert.deepEqual(v1.contents, ['a-pebble', 'test-mobile']);

  // === the pebble moves out; look reflects the change (functional supersession) ===
  await changing({ root, subject: 'a-pebble', predicate: 'located-in', object: 'test-area-2', t: 't3' });
  const v2 = await look({ root, observer: 'alice', subject: 'the-starting-room' });
  assert.deepEqual(v2.contents, ['test-mobile'], 'pebble left the room');
  const v3 = await look({ root, observer: 'alice', subject: 'test-area-2' });
  assert.deepEqual(v3.contents, ['a-pebble'], 'pebble is now in test-area-2');

  console.log('tab room witness: legacy starting-room ported onto doing/observing/changing. passed.');
  console.log('  look(the-starting-room):', JSON.stringify(v1));
  console.log('  after move:             ', JSON.stringify(v2.contents), '|', 'test-area-2:', JSON.stringify(v3.contents));
} finally {
  await rm(root, { recursive: true, force: true });
}
