// _substrate — the on-disk world access (engine plumbing, like _engine.mjs; not a $morphism).
//
// The world IS the stuff on disk: under a world root, each subject's conformant EAVT/SPOT
// trace is its own `<subject>.jsonl`. We never hold a world object in memory — every read
// hits disk. This module only appends rows and gathers them for `being` to settle.
//   - append: write one {e,a,v,t} row to a subject's log.
//   - rowsFor: read a subject's rows from disk.
//   - supersede: functional-predicate latest-t wins (spacetimemattering of mutable state).
//   - frontier: an observer's sensible subset (their cuts + ambient + converse declarations).
//   - settle: rowsFor → (frontier) → (supersede) → being.

import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

import being from '#being';
import { rowId } from '#eavt-row/scripts/row-id.mjs';

const logPath = (root, subject) => join(root, `${subject}.jsonl`);

// RELATIONAL predications hold between two entities (object is itself a subject), so their
// base rows are ALSO filed at the object anchor (a value-position cache, per spotcomp TRC:
// "value-position indexes are caches only") — so "what is located-in this place?" is a local
// read of the place's own log. located-in is also functional (changing); exit-to is not.
export const RELATIONAL = new Set(['located-in', 'exit-to', 'contains']);

export async function append(root, subject, row) {
  const f = logPath(root, subject);
  await mkdir(dirname(f), { recursive: true });
  await appendFile(f, JSON.stringify(row) + '\n');
}

export async function rowsFor(root, subject) {
  const f = logPath(root, subject);
  if (!existsSync(f)) return [];
  return (await readFile(f, 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

// Functional predicates are single-valued over time: a later intra-action supersedes the
// earlier (an object is in ONE place). Keep only the max-t base rows for each functional `a`.
export function supersede(rows, functional) {
  if (!functional || functional.size === 0) return rows;
  const latest = new Map();
  for (const r of rows) {
    if (functional.has(r.a)) {
      const cur = latest.get(r.a);
      if (cur === undefined || r.t > cur) latest.set(r.a, r.t);
    }
  }
  return rows.filter((r) => !functional.has(r.a) || r.t === latest.get(r.a));
}

// An observer's sensory frontier: the base rows they enacted, plus ambient rows (no agency),
// plus public converse declarations; reified rows only for surviving base rows of theirs.
// Determinacy will be local to these cuts (agential realism).
export function frontier(rows, observer) {
  const mine = new Set(rows.filter((r) => r.a === 'enacted-by' && r.v === observer).map((r) => r.e));
  const attributed = new Set(rows.filter((r) => r.a === 'enacted-by').map((r) => r.e));
  return rows.filter((r) => {
    if (r.a === 'has-converse') return true;
    if (typeof r.e === 'string' && r.e.startsWith('row:')) return mine.has(r.e);
    const id = rowId(r);
    return mine.has(id) || !attributed.has(id); // mine, or ambient (un-attributed)
  });
}

// The subjects currently `located-in` a place. Candidates come from the place's object-anchor
// cache; each is confirmed against its OWN log's LATEST located-in (functional supersession is
// global), so a thing that has moved away is not reported here.
export async function containedBy(root, place) {
  const candidates = [...new Set((await rowsFor(root, place)).filter((r) => r.a === 'located-in' && r.v === place).map((r) => r.e))];
  const here = [];
  for (const s of candidates) {
    // only s's OWN located-in rows (e===s), not object-anchor cache rows where s is the object
    const locs = (await rowsFor(root, s)).filter((r) => r.a === 'located-in' && r.e === s);
    let latest = null;
    for (const r of locs) if (latest === null || r.t > latest.t) latest = { t: r.t, place: r.v };
    if (latest && latest.place === place) here.push(s);
  }
  return here.sort();
}

// A subject's current place — its latest (functional) located-in destination, or null.
export async function locationOf(root, subject) {
  const locs = (await rowsFor(root, subject)).filter((r) => r.a === 'located-in' && r.e === subject);
  let latest = null;
  for (const r of locs) if (latest === null || r.t > latest.t) latest = r;
  return latest ? latest.v : null;
}

export async function settle(root, subject, opts = {}) {
  let rows = await rowsFor(root, subject);
  if (opts.observer) rows = frontier(rows, opts.observer);
  rows = supersede(rows, opts.functional);
  return being(subject, rows, { lattice: opts.lattice, converse: opts.converse });
}
