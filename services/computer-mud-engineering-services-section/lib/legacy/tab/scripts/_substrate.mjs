// _substrate — the on-disk world access. Engine plumbing, not a $morphism (hence the `_`).
//
// The world IS the stuff on disk: under a world root, each subject's conformant EAVT/SPOT trace is
// its own `<subject>.jsonl`. We never hold a world object in memory — every read hits disk, every
// write appends a line. This module is the boundary the operations algebra (being / doing /
// changing / observing / ticking) sits on:
//   - append    : write one {e,a,v,t} row to a subject's log (DUAL-FILES relational rows).
//   - rowsFor   : read a subject's rows from disk.
//   - allRows   : read every row in a world (used by replay and the tick).
//   - supersede : functional-predicate latest-t wins (mutable state without mutating history).
//   - frontier  : an observer's sensible subset (their cuts + ambient + converse declarations).
//   - containedBy / locationOf : the relational reads dual-filing makes local.
//   - settle    : rowsFor -> (frontier) -> (supersede) -> being.
//
// The GENERAL substrate algebra is no longer hand-rolled here. It lives once in
// @561-group/computer/substrate — the read->fold->settle spine, the per-predicate FUNCTIONAL
// read-lens (supersede), the general relational graph reads (relate / relateFrom), and the
// reified-row identity. tab keeps only its GAME specializations: WHICH predicates are functional
// and relational, the located-in/contains reads, the (root,…,t,dirty) mutation contract, ticking
// and world-event projection. Every byte-touch goes through @561-group/computer's posix-holography
// (read-text / eavt-append) — tab does not reach past computer to hand-roll the OS.

import { existsSync } from "node:fs";
import { join } from "node:path";

import readText from "@561-group/computer/posix-holography/read-text";
import eavtAppend from "@561-group/computer/posix-holography/eavt-append";
import {
  jcs,
  assertRow,
  isReified,
  supersede as supersedeRows,
  relate,
} from "@561-group/computer/posix-holography/eavt-substrate";

import being from "#being";
import { rowId, contentRowId } from "#eavt-row";

const logPath = (root, subject) => join(root, `${subject}.jsonl`);

// --- optional in-memory acceleration --------------------------------------------------------
// A world MAY register an in-memory materialized view (`scripts/_runtime.mjs`) to accelerate the
// hot reads. The view is DERIVED — the on-disk logs stay the single source of truth — so this is
// purely opt-in: with no view registered (the default, and every test), every read hits disk
// exactly as before. When a view IS registered, `append` keeps it live (via `apply`) and the
// reads below delegate to it. The simulation/server register a view around their tick loop.
const _views = new Map(); // root -> runtime view
export function useRuntime(root, view) { _views.set(root, view); return view; }
export function dropRuntime(root) { _views.delete(root); }

// --- optional append listeners (a read-only side-channel, NOT world state) ------------------
// A caller MAY observe every row appended to a world — the web firehose uses this to collect a
// cycle's rows (tick + player commands) and project them to structured events. Listeners are a pure
// side-effect: they never touch the log, so determinism and replay are unaffected (a replay simply
// doesn't register them). `onAppend` returns an unsubscribe function.
const _listeners = new Map(); // root -> Set<fn(row)>
export function onAppend(root, fn) {
  let set = _listeners.get(root);
  if (!set) { set = new Set(); _listeners.set(root, set); }
  set.add(fn);
  return () => { const s = _listeners.get(root); if (s) { s.delete(fn); if (s.size === 0) _listeners.delete(root); } };
}

// RELATIONAL predications hold between two entities (the object is itself a subject), so their
// base rows are ALSO filed at the object anchor — a value-position cache, so "what is
// located-in this place?" / "what exits lead here?" is a LOCAL read of the place's own log.
// This is the dual filing: subject anchor (always) + object anchor (relational). One extra
// append; it is what makes `look` / `containedBy` work without a global index.
export const RELATIONAL = new Set(["located-in", "exit-to", "contains"]);

// FUNCTIONAL predications are single-valued over time (a thing is in ONE place; a clock has
// ONE tick; a need has ONE current level). At settle, only the latest-t row survives. Some
// functional predications are FAMILIES with a dynamic tail (need:hunger, injury:leg,
// opinion-of:takeshi-aoki) — those are matched by prefix, so the whole family supersedes without
// enumerating every member. (Skill cells are deliberately NOT functional: they accrue, so
// contradictory practice settles to ⊤ rather than silently latest-wins.)
export const FUNCTIONAL = new Set([
  "located-in", "tick", "phase", "status", "weather", "ringing", "overdue", "age-days",
  "amount", "quality", "home", "office", "mood", "day", "hour", "season", "read",
  // The deep-systems spine: a thing wields ONE weapon, holds ONE coin-purse total — single-valued
  // over time, latest-t wins. (Worn armour, attributes, tactics and conditions are FAMILIES — see
  // the prefixes below.) Skills are deliberately NOT here: they ACCRUE, so contradictory practice
  // settles to ⊤ rather than the latest face silently winning.
  "coin", "wielding",
  // The second wave: spell-fuel (mana) and devotion (piety) are single pools; an actor worships ONE
  // deity at a time; is hidden/sneaking or not; is dead or not; a corpse has one decay reading; a
  // lock has one difficulty. All single-valued, latest-t wins.
  "mana", "piety", "worships", "hidden", "sneaking", "dead", "decay", "locked",
]);
export const FUNCTIONAL_PREFIXES = [
  "need:", "injury:", "opinion-of:", "capacity:",
  // attr:<stat> (one value per stat), wearing:<part> (one armour per part), tactics:<phase>
  // (one stance per phase), condition:<name> (one intensity per affliction). Each is a dynamic
  // single-valued family the latest-t row supersedes — without enumerating every member.
  "attr:", "wearing:", "tactics:", "condition:",
  // knows-spell:<name> (known or not), guild-member:<guild> (in or out), quest:<id> (one status),
  // routine:<hour> (one destination per scheduled hour). Single-valued families, latest-t wins.
  "knows-spell:", "guild-member:", "quest:", "routine:",
];
export const isFunctional = (a, extra) =>
  (extra ? extra.has(a) : FUNCTIONAL.has(a)) || FUNCTIONAL_PREFIXES.some((p) => a.startsWith(p));

// functionalTest — adapt tab's game FUNCTIONAL domain (a Set plus the prefix families) into the
// single `(a) => boolean` predicate computer's supersede/settle read-lens takes. The Set the caller
// hands in (or the default FUNCTIONAL) supplies the exact names; the prefix families always apply.
const functionalTest = (functional = FUNCTIONAL) => (a) => isFunctional(a, functional);

export async function append(root, subject, row) {
  assertRow(row);
  const f = logPath(root, subject);
  // canonical bytes: jcs (RFC-8785) is the OS's single canonical-JSON — the fix for tab's old
  // non-canonical JSON.stringify. We hand eavt-append (computer's append-only flatfile primitive:
  // mkdir + append a JSON line) the jcs-canonical object, so for tab's flat {e,a,v,t} rows the line
  // it writes is byte-canonical (sorted keys; JSON.stringify of the jcs-parsed object IS the jcs).
  const canonical = JSON.parse(jcs(row));
  eavtAppend(f, canonical);
  // Dual file: a relational base row is cached at the object anchor too (unchanged row).
  if (RELATIONAL.has(row.a) && typeof row.v === "string" && row.v !== subject) {
    eavtAppend(logPath(root, row.v), canonical);
  }
  // Keep a registered in-memory view live. A reified row (e = row:<hash>) is filed under the base
  // subject's log, so pass it as the anchor; a base row dual-files itself (the view mirrors it).
  const view = _views.get(root);
  if (view) view.apply(row, isReified(row.e) ? subject : undefined);
  const ls = _listeners.get(root);
  if (ls) for (const fn of ls) { try { fn(row); } catch { /* a listener must never break a write */ } }
}

export async function rowsFor(root, subject) {
  const view = _views.get(root);
  if (view) return view.rowsFor(subject);
  const f = logPath(root, subject);
  if (!existsSync(f)) return [];
  // read-text is computer's lowest byte-touch (VPH owns every filesystem read); tab parses the JSONL
  // lines into its raw {e,a,v,t} rows and asserts the contract at the boundary.
  return readText(f)
    .split("\n")
    .filter(Boolean)
    .map((l, i) => {
      try {
        return assertRow(JSON.parse(l));
      } catch (e) {
        e.message = `${subject}.jsonl:${i + 1}: ${e.message}`;
        throw e;
      }
    });
}

// subjects — every entity that owns a log in the world (basename of each *.jsonl).
export async function subjects(root) {
  const view = _views.get(root);
  if (view) return view.subjects();
  if (!existsSync(root)) return [];
  const { readdir } = await import("node:fs/promises");
  return (await readdir(root))
    .filter((n) => n.endsWith(".jsonl"))
    .map((n) => n.slice(0, -".jsonl".length))
    .sort();
}

// allRows — every base row in the world, deduped by content-address. Because relational rows are
// dual-filed, the same row appears in two logs; dedup collapses them so the tick and replay see
// each intra-action once. (Dedup keyed by computer's content rowId — the canonical address.)
export async function allRows(root) {
  const out = [];
  const seen = new Set();
  for (const s of await subjects(root)) {
    for (const r of await rowsFor(root, s)) {
      const id = contentRowId(r);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }
  }
  return out;
}

// supersede — the per-predicate FUNCTIONAL latest-t read-lens. tab's game FUNCTIONAL domain (the
// Set plus prefix families) is handed to computer's general supersede as the functional test; the
// projection (keep max-t per functional predicate; reified rows dropped; non-functional all survive)
// is computer's. A read-time lens, never a destructive write — the trace stays whole.
export function supersede(rows, functional = FUNCTIONAL) {
  return supersedeRows(rows, functionalTest(functional));
}

// frontier — an observer's sensory cut: rows they enacted, plus ambient (un-attributed) rows, plus
// public converse declarations; reified rows only for surviving base rows of theirs. This is a tab
// observation specialization (the reified `enacted-by` attribution layer is tab's), so it stays
// here — built over computer's reified-row identity (isReified) and content address (rowId).
export function frontier(rows, observer) {
  const mine = new Set(rows.filter((r) => r.a === "enacted-by" && r.v === observer).map((r) => r.e));
  const attributed = new Set(rows.filter((r) => r.a === "enacted-by").map((r) => r.e));
  // reified `enacted-by` rows carry the base row's `row:`-prefixed reified id in `e`; the base rows
  // they attribute are addressed by that same reified presentation (computer's reify == tab rowId).
  return rows.filter((r) => {
    if (r.a === "has-converse") return true;
    if (isReified(r.e)) return mine.has(r.e);
    const id = rowId(r); // tab's reified presentation: row:<16hex> == reify(r)
    return mine.has(id) || !attributed.has(id);
  });
}

// containedBy — the subjects currently located-in a place. The GENERAL relational read (computer's
// relate: who stands in located-in to this place?) gathers candidates from the place's own dual-filed
// log; tab specializes it by confirming each candidate against its OWN latest located-in.
export async function containedBy(root, place) {
  const view = _views.get(root);
  if (view) return view.containedBy(place);
  const candidates = relate(await rowsFor(root, place), "located-in", place);
  const here = [];
  for (const s of candidates) {
    if (s === place) continue;
    if ((await locationOf(root, s)) === place) here.push(s);
  }
  return here.sort();
}

// locationOf — a subject's current place: its latest functional located-in destination, or null. The
// inverse GENERAL relational read (computer's relateFrom: what does this subject stand in located-in
// to?) gives every asserted destination in trace order; tab specializes it with the functional
// latest-t pick (located-in is functional, so the latest assertion is the current place).
export async function locationOf(root, subject) {
  const view = _views.get(root);
  if (view) return view.locationOf(subject);
  const rows = await rowsFor(root, subject);
  const locs = rows.filter((r) => r.e === subject && r.a === "located-in");
  let latest = null;
  for (const r of locs) if (latest === null || r.t > latest.t) latest = r;
  return latest ? latest.v : null;
}

// settle — read a subject's trace, optionally localize to an observer, supersede functionals, and
// fold to its settled `being`. The supersede + fold is computer's read->settle spine (settleRows);
// tab keeps the disk read (rowsFor), the observer localization (frontier), and the being projection
// (its reified-attribution/observer/glyph presentation over computer's lossless evidence carrier).
export async function settle(root, subject, opts = {}) {
  const view = _views.get(root);
  if (view) return view.settle(subject, opts);
  let rows = await rowsFor(root, subject);
  if (opts.observer) rows = frontier(rows, opts.observer);
  rows = supersede(rows, opts.functional ?? FUNCTIONAL);
  return being(subject, rows, { converse: opts.converse, witness: opts.witness });
}
