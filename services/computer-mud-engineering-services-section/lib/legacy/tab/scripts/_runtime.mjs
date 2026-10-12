// _runtime — the in-memory MATERIALIZED VIEW of a world. Engine plumbing, not a $morphism
// (hence the `_`), and DERIVED, never authoritative: the on-disk per-entity EAVT logs
// (`<subject>.jsonl`) are the single source of truth. The runtime is a cache of those logs,
// folded the same way `#substrate` folds them on every call — so the engine stops re-reading
// and re-parsing the whole world on every `settle` / `containedBy` / `locationOf`.
//
// REPLAY-EQUIVALENCE is the contract. For every subject e and every opts,
//   runtime.settle(e, opts)  deepEquals  await substrate.settle(root, e, opts)
//   runtime.locationOf(e)     ===         await substrate.locationOf(root, e)
//   runtime.containedBy(p)   deepEquals  await substrate.containedBy(root, p)
// The runtime reaches that equivalence by holding, PER SUBJECT, exactly the raw rows that are
// on disk in that subject's log (INCLUDING the dual-filed relational rows the substrate writes
// to the object anchor), and reducing them with the SAME pipeline the substrate uses:
//   rows -> (frontier observer) -> supersede(functional) -> being(subject, rows, {converse,witness}).
// `settle` with no observer/witness and the default functional set is cached per subject and
// invalidated whenever a new row for that subject arrives.
//
// loadRuntime(root) -> runtime. Build cost is ONE read of the world.

import being from "#being";
import {
  rowsFor, subjects, frontier, supersede, FUNCTIONAL,
} from "#substrate";
import { rowId } from "#eavt-row";

// Dual-filing rule, mirrored from the substrate's `append`: a RELATIONAL base row whose value
// is another subject is ALSO filed at the object anchor's log. We must mirror it in memory so a
// subject's in-memory rows == its on-disk log byte-for-byte (by content).
const RELATIONAL = new Set(["located-in", "exit-to", "contains"]);
const isDualFiled = (row) =>
  RELATIONAL.has(row.a) && typeof row.v === "string" && row.v !== row.e;

// A cache key for a settle is the subject's log content. The DEFAULT settle (no observer, no
// witness, default functional set) is the hot path and the only one we memoize; any settle with
// non-default opts is computed fresh (still from in-memory rows, so still no disk read).
const isDefaultOpts = (opts) =>
  !opts.observer && !opts.witness && !opts.converse &&
  (opts.functional === undefined || opts.functional === FUNCTIONAL);

export async function loadRuntime(root) {
  // rows: subject -> array of that subject's raw rows, in log order (dual-filed rows included,
  // exactly as the substrate's rowsFor would return them). settled: subject -> cached default
  // being. We dedupe per-subject against the subject's own log identity set so a re-applied row
  // (idempotent replay) never double-counts — matching rowsFor, which returns the file as-is but
  // whose downstream folds are content-addressed.
  const rows = new Map();      // subject -> [row, ...]
  const ids = new Map();       // subject -> Set<rowId>  (per-subject identity, mirrors the file)
  const settled = new Map();   // subject -> frozen being  (default-opts cache)

  const ensure = (s) => {
    if (!rows.has(s)) { rows.set(s, []); ids.set(s, new Set()); }
  };

  // Add a row to ONE subject's in-memory log iff that exact row is not already present in that
  // log. Returns true if it was newly added (so the caller knows to invalidate the cache).
  const addToLog = (subject, row) => {
    ensure(subject);
    const id = rowId(row);
    const seen = ids.get(subject);
    if (seen.has(id)) return false;
    seen.add(id);
    rows.get(subject).push(row);
    settled.delete(subject);
    return true;
  };

  // --- build: read the world ONCE -----------------------------------------------------------
  for (const s of await subjects(root)) {
    ensure(s);
    for (const r of await rowsFor(root, s)) addToLog(s, r);
  }

  const rowsOf = (subject) => rows.get(subject) ?? [];

  // settle(entity, opts?) — the in-memory equivalent of substrate.settle. Pipeline identical:
  // frontier (if observer) -> supersede -> being. Default opts are cached per entity.
  const settle = (entity, opts = {}) => {
    if (typeof entity !== "string" || !entity) {
      throw new TypeError("runtime.settle: entity must be a non-empty string");
    }
    if (isDefaultOpts(opts)) {
      const hit = settled.get(entity);
      if (hit !== undefined) return hit;
      let rs = rowsOf(entity);
      rs = supersede(rs, FUNCTIONAL);
      const out = being(entity, rs);
      settled.set(entity, out);
      return out;
    }
    let rs = rowsOf(entity);
    if (opts.observer) rs = frontier(rs, opts.observer);
    rs = supersede(rs, opts.functional ?? FUNCTIONAL);
    return being(entity, rs, { converse: opts.converse, witness: opts.witness });
  };

  // locationOf — a subject's latest functional located-in destination, from in-memory rows.
  // Same logic as substrate.locationOf (only the subject's OWN located-in rows count).
  const locationOf = (subject) => {
    let latest = null;
    for (const r of rowsOf(subject)) {
      if (r.a === "located-in" && r.e === subject) {
        if (latest === null || r.t > latest.t) latest = r;
      }
    }
    return latest ? latest.v : null;
  };

  // containedBy — subjects currently located-in a place. Candidates come from the place's own
  // (dual-filed) log; each is confirmed against its OWN latest located-in. Same as substrate.
  const containedBy = (place) => {
    const candidates = [
      ...new Set(rowsOf(place).filter((r) => r.a === "located-in" && r.v === place).map((r) => r.e)),
    ];
    const here = [];
    for (const s of candidates) {
      if (s === place) continue;
      if (locationOf(s) === place) here.push(s);
    }
    return here.sort();
  };

  const subjectsList = () => [...rows.keys()].sort();

  // apply(row, anchor?) — keep the view live after a `doing`/`changing` APPEND. CONTRACT,
  // mirroring the substrate's `append(root, subject, row)`:
  //   - BASE row {e:subject,a,v,t}: call apply(baseRow). It files under row.e and, if the row is
  //     a relational dual-file (located-in/exit-to/contains with a string value != e), ALSO under
  //     the object anchor row.v — exactly the two logs the substrate writes.
  //   - REIFIED row {e:rowId,a:'enacted-by',v:agent,t}: the substrate files this under the BASE
  //     subject's log, not under a `row:` log. So pass the base subject as the second arg:
  //     apply(reifiedRow, baseSubject). (After `doing({agent,subject,...})` returns {row,id}:
  //     apply(row); apply({e:id,a:'enacted-by',v:agent,t}, subject).)
  // Idempotent: re-applying a row already in a log is a no-op. O(1) amortized.
  const apply = (row, anchor) => {
    if (!row || typeof row !== "object") throw new TypeError("runtime.apply: row required");
    addToLog(anchor ?? row.e, row);                       // subject anchor (or caller-named log)
    if (anchor === undefined && isDualFiled(row)) addToLog(row.v, row); // relational dual-file
    return row;
  };

  // refresh — re-read disk and merge any rows not yet seen in memory (e.g. another writer
  // appended out-of-band). Idempotent per row; only re-reads logs, never mutates them. Returns
  // the count of rows newly absorbed. The log stays authoritative; this just resyncs the cache.
  const refresh = async () => {
    let absorbed = 0;
    for (const s of await subjects(root)) {
      for (const r of await rowsFor(root, s)) if (addToLog(s, r)) absorbed += 1;
    }
    return absorbed;
  };

  return {
    root,
    settle,
    locationOf,
    containedBy,
    subjects: subjectsList,
    rowsFor: (s) => rowsOf(s).slice(), // a fresh array, matching substrate.rowsFor
    apply,
    refresh,
    // snapshot/restore — serialize the in-memory logs for a fast restart (no world re-read).
    // The snapshot is DERIVED state; restoring it is equivalent to replaying the same logs.
    snapshot: () => ({ root, rows: [...rows.entries()].map(([s, rs]) => [s, rs.slice()]) }),
  };
}

// restore — rebuild a runtime from a snapshot() WITHOUT touching disk. Equivalent to a runtime
// loaded from the same world (the snapshot holds the same per-subject logs). Settled caches are
// recomputed lazily on first settle.
export function restore(snap) {
  const rows = new Map();
  const ids = new Map();
  const settled = new Map();
  for (const [s, rs] of snap.rows) {
    rows.set(s, rs.slice());
    ids.set(s, new Set(rs.map(rowId)));
  }
  const rowsOf = (s) => rows.get(s) ?? [];
  const ensure = (s) => { if (!rows.has(s)) { rows.set(s, []); ids.set(s, new Set()); } };
  const addToLog = (subject, row) => {
    ensure(subject);
    const id = rowId(row);
    if (ids.get(subject).has(id)) return false;
    ids.get(subject).add(id);
    rows.get(subject).push(row);
    settled.delete(subject);
    return true;
  };
  const settle = (entity, opts = {}) => {
    if (isDefaultOpts(opts)) {
      const hit = settled.get(entity);
      if (hit !== undefined) return hit;
      const out = being(entity, supersede(rowsOf(entity), FUNCTIONAL));
      settled.set(entity, out);
      return out;
    }
    let rs = rowsOf(entity);
    if (opts.observer) rs = frontier(rs, opts.observer);
    rs = supersede(rs, opts.functional ?? FUNCTIONAL);
    return being(entity, rs, { converse: opts.converse, witness: opts.witness });
  };
  const locationOf = (subject) => {
    let latest = null;
    for (const r of rowsOf(subject)) {
      if (r.a === "located-in" && r.e === subject && (latest === null || r.t > latest.t)) latest = r;
    }
    return latest ? latest.v : null;
  };
  const containedBy = (place) => {
    const cands = [...new Set(rowsOf(place).filter((r) => r.a === "located-in" && r.v === place).map((r) => r.e))];
    const here = [];
    for (const s of cands) { if (s !== place && locationOf(s) === place) here.push(s); }
    return here.sort();
  };
  const apply = (row, anchor) => {
    addToLog(anchor ?? row.e, row);
    if (anchor === undefined && isDualFiled(row)) addToLog(row.v, row);
    return row;
  };
  return {
    root: snap.root, settle, locationOf, containedBy,
    subjects: () => [...rows.keys()].sort(),
    rowsFor: (s) => rowsOf(s).slice(),
    apply,
    refresh: async () => 0,
    snapshot: () => ({ root: snap.root, rows: [...rows.entries()].map(([s, rs]) => [s, rs.slice()]) }),
  };
}

export default loadRuntime;
