// prove-teraum — the legacy Teraum encoding, ported onto the agential substrate (parity at
// scale). Areas, mobiles, an object, regional/cultural markers and creator attribution are all
// predications; exits + containment relational; look renders via observing. Predications, not has-x.

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import doing from '#doing';
import changing from '#changing';
import { look } from '#observing';

const root = await mkdtemp(join(tmpdir(), 'tab-teraum-'));
const say = (subject, predicate, object, t = 't1') => doing({ root, subject, predicate, object, t }); // ambient
const place = (subject, object, t = 't2') => changing({ root, subject, predicate: 'located-in', object, t });

try {
  // Areas of the Farsteppes, with markers + exits.
  for (const [id, name] of [['helmets-dent', "Helmet's Dent"], ['castle-oru', 'Castle Oru'], ['kingsroad', 'the Kingsroad']]) {
    await say(id, 'naming', name);
    await say(id, 'in-world', 'teraum');
    await say(id, 'in-continent', 'eastlands');
    await say(id, 'in-region', 'farsteppes');
  }
  await say('helmets-dent', 'exit-west', 'kingsroad');
  await say('kingsroad', 'exit-east', 'castle-oru');

  // Mobiles with cultural/regional markers + creator attribution; placed in areas.
  await say('renkah-oru', 'naming', 'Renkah Oru');
  await say('renkah-oru', 'cultural-marker', 'teraumi');
  await say('renkah-oru', 'created-by', 'Stirling Little (Brave Old World TRPG, rw2016)');
  await place('renkah-oru', 'castle-oru');
  await say('nash-celson', 'naming', 'Nash Celson');
  await say('nash-celson', 'regional-marker', 'stepper');
  await place('nash-celson', 'helmets-dent');

  // An object with attribution.
  await say('ragar', 'naming', 'ragar');
  await say('ragar', 'describing', "fermented mare's milk");
  await say('ragar', 'created-by', 'David Vallner (the Lazy Mare Tribe, 2016rw)');
  await place('ragar', 'helmets-dent');

  const dent = await look({ root, observer: 'wanderer', subject: 'helmets-dent' });
  assert.equal(dent.name, "Helmet's Dent");
  assert.deepEqual(dent.exits, { west: 'kingsroad' });
  assert.deepEqual(dent.contents, ['nash-celson', 'ragar']);
  const oru = await look({ root, observer: 'wanderer', subject: 'castle-oru' });
  assert.deepEqual(oru.contents, ['renkah-oru']);

  console.log('tab teraum witness: Teraum subset ported onto the agential substrate. passed.');
  console.log("  look(Helmet's Dent):", JSON.stringify(dent));
} finally {
  await rm(root, { recursive: true, force: true });
}
