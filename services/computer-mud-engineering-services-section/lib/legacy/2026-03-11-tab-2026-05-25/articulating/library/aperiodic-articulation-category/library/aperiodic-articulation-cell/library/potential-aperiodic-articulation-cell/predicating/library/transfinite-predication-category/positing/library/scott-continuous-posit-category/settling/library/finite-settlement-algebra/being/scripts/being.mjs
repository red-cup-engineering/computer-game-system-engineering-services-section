// being — the generator of `thing`. An entity's settled state IS its being; being is
// enacted by doing. Settles over a CONFORMANT EAVT/SPOT trace: a multiset of {e,a,v,t}
// rows (and nothing else). Agential-realist reading (docs/dev/agential-realism.md): each
// base row (e=subject) is an INTRA-ACTION — `a` the apparatus/predication, `v` the
// determinable/object. Richness comes from the standard, never extra columns:
//   - opposing/negative evidence is the CONVERSE predication (declared by `(p has-converse q)`
//     rows or opts.converse), folded as neg(α,β)=(β,α) — never a polarity field;
//   - the graded MARK and the OBSERVER are REIFIED rows about a base row
//     (e=rowId(base), a='degree'|'enacted-by', v=…);
//   - the settled value is the mark (α,β) ∈ L×L over a residuated lattice L (twist-value).
//
// being(subject, rows, opts?) → { entity, fiber:[{ predicate, object, value:{lattice,positive,negative}, observers }] }

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

import { BOOLEAN, value, bottom, knowledgeJoin, neg, determined } from '#bilattice/scripts/twist-value.mjs';
import { rowId } from '#eavt-row/scripts/row-id.mjs';

const load = (s) => JSON.parse(readFileSync(fileURLToPath(import.meta.resolve(s)), 'utf8'));
const EAVT_SCHEMA = load('#eavt-row/eavt-row.schema.json');
const BEING_SCHEMA = load('#finite-settlement-algebra/being/being.schema.json');
const THING_SCHEMA = load('#finite-settlement-algebra/being/library/thing/thing.schema.json');

const ajv = new Ajv2020({ strict: false });
ajv.addSchema(EAVT_SCHEMA);
ajv.addSchema(THING_SCHEMA);
ajv.addSchema(BEING_SCHEMA);
const validateRow = ajv.compile(EAVT_SCHEMA);
const validateOutput = ajv.compile(THING_SCHEMA);

export default function being(subject, rows, opts = {}) {
  const L = opts.lattice ?? BOOLEAN;
  if (typeof subject !== 'string' || !subject) throw new TypeError('being: subject must be a non-empty string');
  if (!Array.isArray(rows)) throw new TypeError('being: rows must be an EAVT/SPOT array');
  for (const r of rows) {
    if (!validateRow(r)) throw new TypeError(`being: non-conformant trace row: ${ajv.errorsText(validateRow.errors)}`);
  }

  // Converse declarations: (p has-converse q) ⇒ q is the converse of p ⇒ rows on q are
  // negative evidence for the cell oriented at p. opts.converse {q: p} merges in.
  const converse = { ...(opts.converse ?? {}) };
  for (const r of rows) if (r.a === 'has-converse') converse[r.v] = r.e;

  // Reified marks: rowId(base) → {degree}. (enacted-by handled below for observers.)
  const metaDegree = new Map();
  const metaObserver = new Map();
  for (const r of rows) {
    if (r.a === 'degree' && typeof r.e === 'string' && r.e.startsWith('row:')) metaDegree.set(r.e, r.v);
    if (r.a === 'enacted-by' && typeof r.e === 'string' && r.e.startsWith('row:')) {
      (metaObserver.get(r.e) ?? metaObserver.set(r.e, new Set()).get(r.e)).add(r.v);
    }
  }

  // Base rows about this subject (skip meta and converse-declaration rows).
  const cells = new Map();
  for (const r of rows) {
    if (r.e !== subject || r.a === 'has-converse') continue;
    const id = rowId(r);
    const degree = metaDegree.has(id) ? metaDegree.get(id) : L.top; // ungraded = full mark
    const base = converse[r.a]; // defined ⇒ r.a is a converse (negative) predication
    const predicate = base ?? r.a; // orient the cell at the positive predicate
    const contribution = base ? neg(L, value(L, degree, L.bot)) : value(L, degree, L.bot);
    const key = JSON.stringify([predicate, r.v]);
    const cell = cells.get(key) ?? { predicate, object: r.v, value: bottom(L), observers: new Set() };
    cell.value = knowledgeJoin(L, cell.value, contribution);
    for (const o of metaObserver.get(id) ?? []) cell.observers.add(o);
    cells.set(key, cell);
  }

  const fiber = [...cells.values()]
    .sort((a, b) => (a.predicate + ' ' + a.object).localeCompare(b.predicate + ' ' + b.object))
    .map(({ predicate, object, value: v, observers }) => ({ predicate, object, value: v, observers: [...observers].sort() }));

  const thing = { entity: subject, fiber };
  if (!validateOutput(thing)) {
    throw new TypeError(`being: output violates thing schema: ${ajv.errorsText(validateOutput.errors)}`);
  }
  return deepFreeze(thing);
}

// The value is the rich (positive,negative) mark on fiberEntry.value. `degreeOf` reads
// the degrees; `isDetermined` tells a settled mark from an untouched one (⊥,⊥).
export function degreeOf(fiberEntry) {
  return { positive: fiberEntry.value.positive, negative: fiberEntry.value.negative };
}
export function isDetermined(fiberEntry, L = BOOLEAN) {
  return determined(L, fiberEntry.value);
}

function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    for (const c of Object.values(v)) deepFreeze(c);
    Object.freeze(v);
  }
  return v;
}
