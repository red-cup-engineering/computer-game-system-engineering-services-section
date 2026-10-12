// prove-descent — TAB's witness that its self-contained voidmath descent spine
// round-trips: an utterance [token, claim] flows articulating → predicating →
// positing → settling, each stage validating against its codomain schema with
// no AJV errors. Ported from voidmath's prove-utterance-settles-finitely.mjs;
// confirms TAB reconstructs the foundation from first principles inside tab/.

import assert from 'node:assert/strict';

import articulate from '#articulating/scripts/articulate.mjs';
import predicate from '#predicating/scripts/predicate.mjs';
import posit, { twoElementResiduatedLattice } from '#positing/scripts/posit.mjs';
import settle from '#settling/scripts/settle.mjs';

const token = deepFreeze({ properties: {}, additionalProperties: true });
const claim = deepFreeze({ const: { left: {}, right: {} } });

const aperiodic = articulate([token, claim]);
const potential = aperiodic['potential-aperiodic-articulation-cell'];
const transfinite = predicate({ 'potential-aperiodic-articulation-cell': potential });
const scottContinuous = posit(transfinite);
const finite = settle(scottContinuous);

assert.deepEqual(aperiodic, {
  'potential-aperiodic-articulation-cell': [[token, claim], [[], []]],
});
assert.deepEqual(scottContinuous['entity-set'].entities, [token]);
assert.deepEqual(scottContinuous['predicate-category'].objects.predicates, [claim]);
assert.equal(typeof twoElementResiduatedLattice(), 'object');
assert.deepEqual(finite, {
  'settlement-trace-families': [],
  'settlement-cell-traces': [],
});

console.log('tab descent witness: utterance settles finitely passed');
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
