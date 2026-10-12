// prove-persistence — the system must not "run in memory and quit." State lives on disk; a fresh
// process (new commanding, empty in-memory maps/counters) reads it back, and the wall-clock keeps
// `t` moving forward so a post-restart move SUPERSEDES rather than silently reverting (the bug an
// in-memory counter would cause). This is the basic durability requirement.

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { makeCommanding } from '#commanding';
import doing from '#doing';
import changing from '#changing';
import { locationOf } from '#substrate';
import { now } from '#clock';

const root = await mkdtemp(join(tmpdir(), 'tab-persist-'));
try {
  // World on disk.
  await doing({ root, subject: 'tavern', predicate: 'naming', object: 'The Tavern', t: now() });
  await doing({ root, subject: 'tavern', predicate: 'exit-north', object: 'street', t: now() });
  await doing({ root, subject: 'street', predicate: 'naming', object: 'Cobbled Street', t: now() });
  await doing({ root, subject: 'street', predicate: 'exit-south', object: 'tavern', t: now() });

  // --- session 1: a player logs in (name + location persisted to disk) and moves ---
  const C1 = makeCommanding(root);
  C1.registerPlayer('alice', 'Alice');
  await doing({ root, agent: 'alice', subject: 'alice', predicate: 'naming', object: 'Alice', t: now() });
  await changing({ root, agent: 'alice', subject: 'alice', predicate: 'located-in', object: 'tavern', t: now() });
  await C1.command('alice', 'north'); // alice → street, persisted on disk
  assert.equal(await locationOf(root, 'alice'), 'street');

  // --- "restart": a brand-new commanding with EMPTY in-memory state, same disk ---
  const C2 = makeCommanding(root);
  // C2 was never told about alice; everything must come off disk:
  assert.equal(await locationOf(root, 'alice'), 'street', 'location persisted across restart');
  assert.equal(await C2.nameOf('alice'), 'Alice', 'name read from disk, not an in-memory registry');

  // a post-restart move must SUPERSEDE (wall-clock t keeps rising) — not revert to an older location
  await C2.command('alice', 'south'); // street → tavern
  assert.equal(await locationOf(root, 'alice'), 'tavern', 'post-restart move superseded; no revert');

  console.log('tab persistence witness: state lives on disk; a fresh process resumes it; the clock survives restart. passed.');
} finally {
  await rm(root, { recursive: true, force: true });
}
