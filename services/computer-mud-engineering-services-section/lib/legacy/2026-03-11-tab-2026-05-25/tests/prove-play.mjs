// prove-play — the concurrent-game MUD, on disk. Two modeled-players intra-act (doing) on
// one phenomenon via a predication and its converse; each observes (observing) a DIFFERENT
// finite knowable SHP — determinacy local to the cut; the shared trace carries both. A player
// moves (changing) and the functional located-in supersedes. The world is real files on disk.

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import doing, { declareConverse } from '#doing';
import changing, { FUNCTIONAL } from '#changing';
import observing from '#observing';
import { settle } from '#substrate';
import { degreeOf } from '#being';
import { chain } from '#bilattice/scripts/twist-value.mjs';

const Press = chain('press', ['none', 'slight', 'full']);
const root = await mkdtemp(join(tmpdir(), 'tab-world-'));
const cut = (thing, p, o) => thing.fiber.find((c) => c.predicate === p && c.object === o);

try {
  // The world: a door phenomenon. gives-way's opposing predication is resists.
  await declareConverse(root, 'the-door', 'gives-way', 'resists', 't0');
  // alice's pressing enacts a door that gives way; bob's enacts one that resists.
  await doing({ root, agent: 'alice', subject: 'the-door', predicate: 'gives-way', object: 'threshold', degree: 'full', t: 't1' });
  await doing({ root, agent: 'bob', subject: 'the-door', predicate: 'resists', object: 'threshold', degree: 'full', t: 't2' });

  // === each player observes a different finite knowable view of the SAME phenomenon ===
  const aliceView = await observing({ root, observer: 'alice', subject: 'the-door', lattice: Press });
  const bobView = await observing({ root, observer: 'bob', subject: 'the-door', lattice: Press });
  assert.deepEqual(degreeOf(cut(aliceView.thing, 'gives-way', 'threshold')), { positive: 'full', negative: 'none' });
  assert.deepEqual(degreeOf(cut(bobView.thing, 'gives-way', 'threshold')), { positive: 'none', negative: 'full' });
  assert.notEqual(aliceView.shp, bobView.shp, 'the players know different worlds (their SHPs differ)');
  assert.match(aliceView.shp, /data-observer="alice"/);
  assert.match(aliceView.shp, /data-positive="full" data-negative="none"/);

  // === the shared phenomenon carries both cuts (consensus settling, no observer) ===
  const shared = await settle(root, 'the-door', { lattice: Press });
  assert.deepEqual(degreeOf(cut(shared, 'gives-way', 'threshold')), { positive: 'full', negative: 'full' });

  // === changing: a functional move supersedes (spacetimemattering) on a monotone trace ===
  await changing({ root, agent: 'alice', subject: 'alice', predicate: 'located-in', object: 'the-hall', t: 't1' });
  await changing({ root, agent: 'alice', subject: 'alice', predicate: 'located-in', object: 'the-garden', t: 't2' });
  const aliceLoc = await settle(root, 'alice', { functional: FUNCTIONAL });
  assert.ok(cut(aliceLoc, 'located-in', 'the-garden'), 'alice is now in the garden');
  assert.ok(!cut(aliceLoc, 'located-in', 'the-hall'), 'the earlier location is superseded');

  console.log('tab play witness: two players enacted & knew divergent worlds of one phenomenon; movement superseded. passed.');
  console.log('  alice knows the-door gives-way:', JSON.stringify(degreeOf(cut(aliceView.thing, 'gives-way', 'threshold'))));
  console.log('  bob   knows the-door gives-way:', JSON.stringify(degreeOf(cut(bobView.thing, 'gives-way', 'threshold'))));
  console.log('  shared world carries both:     ', JSON.stringify(degreeOf(cut(shared, 'gives-way', 'threshold'))));
  console.log('  alice SHP:\n' + aliceView.shp.split('\n').map((l) => '    ' + l).join('\n'));
} finally {
  await rm(root, { recursive: true, force: true });
}
