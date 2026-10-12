// prove-being — witness TAB's agential-realist ontology over a CONFORMANT EAVT/SPOT trace.
// A predication is a phenomenon/intra-action; the predicate is the apparatus, the observer
// the agency, the settled value the rich mark (positive,negative) over a residuated lattice L.
// The trace is exactly {e,a,v,t} rows: opposing evidence is the CONVERSE predication (not a
// polarity field), and the graded mark + observer are REIFIED rows about a base row. Relata
// and determinacy are enacted, local to the cut. (No coarse value labels; no has-property.)

import assert from 'node:assert/strict';
import being, { degreeOf } from '#being';
import { chain } from '#bilattice/scripts/twist-value.mjs';
import { rowId } from '#eavt-row/scripts/row-id.mjs';

const Press = chain('press', ['none', 'slight', 'full']); // ⊥=none … ⊤=full

// One intra-action = a base SPO row + reified (degree, enacted-by) rows about it.
function enact(rows, { e, a, v, t, degree, by }) {
  const base = { e, a, v, t };
  rows.push(base);
  const id = rowId(base);
  if (degree !== undefined) rows.push({ e: id, a: 'degree', v: degree, t });
  if (by !== undefined) rows.push({ e: id, a: 'enacted-by', v: by, t });
  return rows;
}
// An observer's cut: the base rows they enacted (+ their reified rows + converse declarations).
function byObserver(rows, who) {
  const mine = new Set(rows.filter((r) => r.a === 'enacted-by' && r.v === who).map((r) => r.e));
  return rows.filter((r) =>
    r.a === 'has-converse' ||
    mine.has(rowId(r)) ||
    (typeof r.e === 'string' && r.e.startsWith('row:') && mine.has(r.e)));
}
const cut = (thing, p, o) => thing.fiber.find((c) => c.predicate === p && c.object === o);

const rows = [];
rows.push({ e: 'gives-way', a: 'has-converse', v: 'resists', t: 't0' }); // resists is the converse of gives-way
enact(rows, { e: 'the-door', a: 'gives-way', v: 'threshold', t: 't1', degree: 'full', by: 'alice' });
enact(rows, { e: 'the-door', a: 'resists', v: 'threshold', t: 't2', degree: 'full', by: 'bob' });
enact(rows, { e: 'the-door', a: 'gives-way', v: 'threshold', t: 't3', degree: 'slight', by: 'carol' });

// === determinacy is local to the cut: each agency enacts a different door ===
const aliceDoor = being('the-door', byObserver(rows, 'alice'), { lattice: Press });
const bobDoor = being('the-door', byObserver(rows, 'bob'), { lattice: Press });
assert.deepEqual(degreeOf(cut(aliceDoor, 'gives-way', 'threshold')), { positive: 'full', negative: 'none' });
assert.deepEqual(degreeOf(cut(bobDoor, 'gives-way', 'threshold')), { positive: 'none', negative: 'full' });

// === the shared phenomenon carries every cut; converse folds to negative; degrees retained ===
const shared = being('the-door', rows, { lattice: Press });
const giveWay = cut(shared, 'gives-way', 'threshold');
assert.deepEqual(degreeOf(giveWay), { positive: 'full', negative: 'full' }); // alice⊔carol positive, bob negative
assert.deepEqual(giveWay.observers, ['alice', 'bob', 'carol']); // attribution from reified rows, local to cuts

// === being is enacted by doing: no intra-action ⇒ no determinate being ===
assert.deepEqual(being('the-sealed-chamber', rows, { lattice: Press }).fiber, []);

console.log('tab being witness: conformant {e,a,v,t} trace; converse=negation; reified marks+observers; determinacy local to the cut. passed.');
console.log(`  alice's door gives-way: ${JSON.stringify(degreeOf(cut(aliceDoor, 'gives-way', 'threshold')))}`);
console.log(`  shared door gives-way:  ${JSON.stringify(degreeOf(giveWay))}  observers=${giveWay.observers.join(',')}`);
