// world — the engine's WORLD substrate: a "place" is a subject whose state is the FOLD of every
// predication filed about it. This is the engine-level lift of the Okaga/Tsander design note's
// §4–§6: a star system (or any unit) is `e`; its facts are the rows `(e, a, v)`; the section you
// experience is the fold of the trace that reaches `e`.
//
// FEDERATION PORT (2026-08-27, closing the port scope cut this file carried): this world IS now
// `@561-group/computer/distribution/federate`'s federated world — a Map from subject to that subject's
// append-only log, unioned by content id. The cut said "a future port can add it once `computer` ships
// `distribution/federate`"; computer ships it as of 0.0.4, so multi-writer federation (`federate`,
// `mergeWorlds`, `migrate`, per-observer `frontier`) is live and re-exported below.
//
// Two consequences worth naming, because they are behaviour and not plumbing:
//
//   - The read-lens folds a subject's OWN admitted log (`frontier`), not the whole flat trace. That is
//     what makes a per-observer read meaningful once more than one writer exists.
//   - A world can now hold QUARANTINED rows (L10a): rows from an unrecognized source are present and
//     never deleted, but the read-lens does not fold them, so a hostile peer cannot force ⊤ everywhere.
//     `allRows` includes them (append-only honesty); `admittedRows` is the folded set.
//
// THE LAW, restated for this file: state is an append-only trace of {e,a,v,t} rows; identity is
// content; ⊤ is HELD (never collapsed), evidence is linear (no witness dropped). Pure over the
// substrate — bytes on disk are the caller's concern (bin/ reads/writes the .jsonl seed).

// fold/section/settle now move to the canonical eavt seat too (2026-08-31): eavt 0.4.0 ships the
// legacy converse compatibility lane (opts.converse) this file's own CONVERSE map (below, consumed
// via settleOpts) relies on to fold a denial to its predicate's negative face — the prior scope cut
// that kept these three on @561-group/computer/posix-holography/eavt-substrate no longer applies.
// relate/relateFrom/rowId/assertRow were pure, converse-independent reads with no reified-row
// traffic in this package (verified: tsander never reifies a row) and had already moved. The
// `@561-group/computer` dependency itself stays for `distribution` below (federate/frontier/etc.
// — a disk-format migration this pass does not attempt).
import {
  fold, section, settle, relate, relateFrom, rowId, assertRow,
} from "@red-cup-engineering/eavt";
import {
  emptyWorld as federatedEmptyWorld,
  admitLog as federatedAdmitLog,
  allRows as federatedAllRows,
  subjects as federatedSubjects,
  disagreements as federatedDisagreements,
  federate, mergeWorlds, migrate, frontier, sectionOf, sectionConeOf,
  logFor, inertFor, contentKey, asWorld,
} from "@561-group/computer/distribution";

// re-export the substrate surface the engine builds on, so a consumer imports one module.
export { fold, section, settle, relate, relateFrom, rowId, assertRow };

// re-export the federation surface the port restores. `federate` is the tensor: two worlds union by
// content id, and a cell two peers disagree about settles to ⊤ carrying BOTH witnesses.
export { federate, mergeWorlds, migrate, frontier, sectionOf, sectionConeOf, logFor, inertFor, contentKey };

// ── building a world ──────────────────────────────────────────────────────────────────────────
// A row is exactly {e,a,v,t}. `predicate(s,p,o,t)` builds one positive predication; `deny(s,p,o,t)`
// builds the CONVERSE predication that charges the negative face (the design note: "negative evidence
// is the converse predication, never a polarity field"). The default converse map (`CONVERSE`) names
// `not-<p>` as the converse of `<p>`, so two traces that disagree — A asserts `controlled-by federation`,
// B asserts the converse — fold to ⊤ on the same cell.
export const CONVERSE = Object.freeze({
  "not-controlled-by": "controlled-by",
  "not-has-station": "has-station",
  "not-at-position": "at-position",
  "not-hull": "hull",
  "not-hazard": "hazard",
});

export const predicate = (s, p, o, t = 0) => ({ e: s, a: p, v: o, t });
export const deny = (s, p, o, t = 0) => ({ e: s, a: `not-${p}`, v: o, t });

// ── a world is a federated Map<subject, log> — each log append-only, unioned by content id ─────
export function emptyWorld() {
  return federatedEmptyWorld();
}

// admitRows(world, rows) — file each row under its own subject `e` and admit it. Append-only union:
// a row already present (by content id) is not duplicated, and nothing is ever removed or overwritten.
// Returns a NEW world; the input is untouched.
export function admitRows(world, rows, opts = {}) {
  const bySubject = new Map();
  for (const r of rows ?? []) {
    assertRow(r);
    const key = String(r.e);
    const bucket = bySubject.get(key);
    if (bucket) bucket.push(r); else bySubject.set(key, [r]);
  }
  let out = asWorld(world);
  for (const [subject, subjectRows] of bySubject) out = federatedAdmitLog(out, subject, subjectRows, opts).world;
  return out;
}

// admitLog(world, subject, rows, opts) — federate's own admission, filing `rows` under `subject`.
// Returns { world, added, skipped }; call sites that destructure `.world` are unchanged. Pass
// `opts.recognize` to gate admission by the row's source (L10a) — unrecognized rows go inert.
export function admitLog(world, subject, rows, opts = {}) {
  return federatedAdmitLog(world, subject, rows, opts);
}

// worldFromRows(rows) — a world from a seed of {e,a,v,t} rows (the shipped seed `.jsonl`).
export function worldFromRows(rows) {
  return admitRows(emptyWorld(), rows ?? []);
}

// allRows(world) — every row the world holds, admitted AND quarantined, deduped. Append-only honesty:
// a quarantined row is still present. Use `admittedRows` for the set the read-lens actually folds.
export function allRows(world) {
  return federatedAllRows(world);
}

// admittedRows(world) — the flat trace of admitted (foldable) rows only, excluding the L10a quarantine.
export function admittedRows(world) {
  const out = [];
  for (const subject of federatedSubjects(world)) out.push(...logFor(world, subject));
  return out;
}

// subjects(world) — every distinct entity `e` the world holds a log for, sorted. Reified rows (e
// starting with "row:") are attributions about rows, not subjects, and are excluded.
export function subjects(world) {
  return federatedSubjects(world).filter((e) => !String(e).startsWith("row:"));
}

// ── the engine's per-observer place read ────────────────────────────────────────────────────
// settleOpts() — the domain knowledge the fold needs: the converse map, plus the functional predicates
// (single-valued over time; the latest-t row wins the read). `at-position` is functional — a unit has
// one current position — but `controlled-by`/`hazard` are NOT (a contested star is owned by BOTH, held).
export function settleOpts(opts = {}) {
  return {
    converse: { ...CONVERSE, ...(opts.converse ?? {}) },
    functional: opts.functional ?? new Set(["at-position"]),
    ...(opts.retract !== undefined ? { retract: opts.retract } : {}),
  };
}

// FOUR — the four engine charges a place's cell can carry, named for the renderer and the tick loop.
export const FOUR = Object.freeze({ T: "t", F: "f", BOT: "bot", TOP: "top" });

// chargeOf(value) — read a fold cell's {pos,neg} into one of the four engine charges. ⊥ is the unvisited
// reading (no evidence at all); ⊤ is the contested reading (both faces witnessed, HELD).
export function chargeOf(value) {
  const pos = value?.pos, neg = value?.neg;
  if (pos && neg) return FOUR.TOP;
  if (pos) return FOUR.T;
  if (neg) return FOUR.F;
  return FOUR.BOT;
}

// place(world, subject, opts) — the engine's central read: settle `subject`'s trace (supersede the
// functional predicates, then fold) and return its settled state — the fiber of charged cells, the
// finite section, whether it has been VISITED at all (any evidence => not ⊥), and its contested
// cells (⊤). This is what one tick of the cockpit settles and what the projector renders.
export function place(world, subject, opts = {}) {
  const o = settleOpts(opts);
  const folded = frontier(world, subject, o); // settle over this subject's ADMITTED log only
  const sec = section(folded);
  const contested = folded.fiber
    .filter((c) => c.value.pos && c.value.neg)
    .map((c) => ({ predicate: c.predicate, object: c.object, evidence: c.value.evidence }));
  const visited = folded.fiber.length > 0;
  return {
    subject,
    folded,
    section: sec,       // { affirmed, denied, contradicted }
    contested,           // the ⊤ cells, both witnesses kept
    visited,              // false => the place is ⊥ fog (unvisited, pure potential)
    charge: visited ? (contested.length ? FOUR.TOP : FOUR.T) : FOUR.BOT,
  };
}

// positionOf(world, subject, opts) — the unit's current position as a vec3, read from its functional
// `at-position` cell (latest-t wins, via settle's supersede). Returns null if the place has no
// position evidence (⊥). The value is stored as an [x,y,z] array in the row's `v`.
export function positionOf(world, subject, opts = {}) {
  const p = place(world, subject, opts);
  const cell = p.folded.fiber.find((c) => c.predicate === "at-position" && c.value.pos);
  const v = cell ? cell.object : null;
  return Array.isArray(v) && v.length === 3 ? v.map(Number) : null;
}

// renderables(world, opts) — every subject that has an `at-position`, projected to a renderable record
// the wireframe projector consumes: { subject, position:[x,y,z], charge, shape, contested }. A subject
// with no position is not drawable (it is lore, not geometry). `shape` is the unit's `hull` cells, or a
// default unit cube if none is stated. This is the bridge from the WORLD to the RENDERER.
export function renderables(world, opts = {}) {
  const out = [];
  for (const subject of subjects(world)) {
    const pos = positionOf(world, subject, opts);
    if (!pos) continue;
    const p = place(world, subject, opts);
    const hull = relateFrom(admittedRows(world), subject, "hull");
    out.push({
      subject,
      position: pos,
      charge: p.charge,
      contested: p.contested,
      shape: hull.length ? hull[hull.length - 1] : null, // a shape name or vertex list; projector defaults
    });
  }
  return out.sort((a, b) => a.subject.localeCompare(b.subject));
}

// disagreements(world, opts) — every ⊤ cell across the world, read with the ENGINE's domain
// knowledge (the converse map + functional set), so `controlled-by` vs `not-controlled-by` is seen as
// one contested cell. A "void-trader" career (the design note) is mining this list: each entry carries
// both witnesses, so disagreement is an enumerable VALUE, never an error.
//
// Now delegated to federate's own cross-world reader, which is what the descope deferred: it reads
// contested cells across every federated log, and each entry carries both witnesses plus who
// recognized and who disputed the cell.
export function disagreements(world, opts = {}) {
  return federatedDisagreements(world, settleOpts(opts));
}

