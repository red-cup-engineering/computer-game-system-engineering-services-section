// prove-commands — MUD Phase 1 playthrough. A tiny world built via doing/changing on disk;
// then a player issues commands through `commanding` (parser + verbs over the substrate).
// Asserts observable results: room view, taking/inventory, movement + leave broadcast, speech
// broadcast to co-located others, who, examine. Conformant rows only; no has-x, no labels.

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { makeCommanding } from '#commanding';
import doing from '#doing';
import changing from '#changing';

const root = await mkdtemp(join(tmpdir(), 'tab-cmd-'));
const C = makeCommanding(root);
const t = C.now;
const text = (r) => r.lines.join('\n');

try {
  // Build a two-room world (ambient = no agency).
  await doing({ root, subject: 'tavern', predicate: 'naming', object: 'The Tavern', t: t() });
  await doing({ root, subject: 'tavern', predicate: 'describing', object: 'A cozy room with a low fire.', t: t() });
  await doing({ root, subject: 'tavern', predicate: 'exit-north', object: 'street', t: t() });
  await doing({ root, subject: 'street', predicate: 'naming', object: 'Cobbled Street', t: t() });
  await doing({ root, subject: 'street', predicate: 'describing', object: 'A narrow street under grey sky.', t: t() });
  await doing({ root, subject: 'street', predicate: 'exit-south', object: 'tavern', t: t() });
  await doing({ root, subject: 'a-mug', predicate: 'naming', object: 'a clay mug', t: t() });
  await changing({ root, subject: 'a-mug', predicate: 'located-in', object: 'tavern', t: t() });
  C.registerPlayer('alice', 'Alice');
  C.registerPlayer('bob', 'Bob');
  await changing({ root, subject: 'alice', predicate: 'located-in', object: 'tavern', t: t() });
  await changing({ root, subject: 'bob', predicate: 'located-in', object: 'tavern', t: t() });

  // look
  const look = await C.command('alice', 'look');
  assert.match(text(look), /The Tavern/);
  assert.match(text(look), /cozy room/);
  assert.match(text(look), /You see: a clay mug\./);
  assert.match(text(look), /Also here: Bob\./);
  assert.match(text(look), /Exits: north\./);

  // take the mug (resolved by the noun "mug")
  const take = await C.command('alice', 'take mug');
  assert.match(text(take), /You take a clay mug\./);
  assert.deepEqual(take.broadcasts, [{ to: 'bob', text: 'Alice takes a clay mug.' }]);
  const inv = await C.command('alice', 'i');
  assert.match(text(inv), /a clay mug/);

  // say — broadcast to co-located Bob
  const say = await C.command('alice', 'say hello there');
  assert.match(text(say), /You say, "hello there"/);
  assert.deepEqual(say.broadcasts, [{ to: 'bob', text: 'Alice says, "hello there"' }]);

  // go north (alias too) — leave broadcast to Bob, arrive in the street
  const go = await C.command('alice', 'n');
  assert.match(text(go), /Cobbled Street/);
  assert.deepEqual(go.broadcasts, [{ to: 'bob', text: 'Alice leaves north.' }]);

  // who + examine the carried mug
  const who = await C.command('alice', 'who');
  assert.match(text(who), /Alice/);
  assert.match(text(who), /Bob/);
  const ex = await C.command('alice', 'examine mug');
  assert.match(text(ex), /a clay mug/);

  // a bad exit diverges with an error line (no state change)
  const bad = await C.command('alice', 'go west');
  assert.match(text(bad), /can't go west/);

  console.log('tab commands witness: a player looked, took, spoke, and moved through an on-disk world. passed.');
  console.log('  look →\n' + look.lines.map((l) => '    ' + l).join('\n'));
  console.log('  take → ' + JSON.stringify(take));
  console.log('  go n →\n' + go.lines.map((l) => '    ' + l).join('\n'));
} finally {
  await rm(root, { recursive: true, force: true });
}
