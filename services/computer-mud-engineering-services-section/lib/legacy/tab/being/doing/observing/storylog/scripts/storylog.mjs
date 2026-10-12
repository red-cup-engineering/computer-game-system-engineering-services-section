// storylog — the "anecdote factory" READ. `storylog/` nests under `observing/` because it READS
// being's residue (settled fibers + the raw trace) into a derived view; it adds no new column and
// generates no events. The tick generates incidents; the append-only log records them; storylog
// merely SURFACES the tellable ones, RANKED. A formatter, not a generator: every line is the
// rendering of a predicate/composition result the world already settled.
//
// From the emergent-narrative note, an emergent event is TELLABLE when it has causal legibility +
// durable consequence. storylog reads four kinds straight off the algebra:
//   - top      : a cell that settled to ⊤ — a contradiction-as-a-value (a crisis / dispute / a
//                contested fact held both ways). The bilattice apex. Highest weight.
//   - death    : an entity gone `alive:false` via injuries (read through #health). High weight.
//   - entangled: an entangled pair (voidmath F8 via #history) — the geometric residue of a past.
//                weight scales with the gap (a wider gap is a deeper past).
//   - change   : a big functional change — a need crashing low, or a location change. Lowest.
//
// storylog(root, opts?) -> [{ t, kind, entity, line, weight }]
//   opts.minWeight : drop events below this weight (default 0 — keep all).
//   opts.kinds     : restrict to these kinds (default all four).
//   opts.limit     : keep only the top-N after ranking.
// Ranked by weight DESC, then t ASC, then entity/line — fully DETERMINISTIC (same world → same
// list, byte-for-byte). Pure: settle + healthOf + historyOf reads, no appends.
//
// CLI: node storylog.mjs <world>

import { settle, subjects, rowsFor, FUNCTIONAL } from "#substrate";
import { isTop } from "#value";
import { historyOf } from "#history";
import { healthOf } from "#health";

// WEIGHTS — the tellability ranking. A ⊤ flip (a contested outcome) and a death are the most
// tellable; an entangled pair's depth (gap) adds to its base; a functional change is the floor.
const WEIGHT = Object.freeze({ top: 100, death: 90, entangled: 40, change: 10 });
const KINDS = Object.freeze(["top", "death", "entangled", "change"]);

// A need that has crashed: a need:<x> functional cell whose object (level) is at or below this.
const NEED_FLOOR = 20;

export default async function storylog(root, opts = {}) {
  const wantKinds = new Set(opts.kinds ?? KINDS);
  const events = [];
  const subs = await subjects(root);

  for (const entity of subs) {
    const rows = await rowsFor(root, entity);
    if (rows.length === 0) continue;
    const settled = await settle(root, entity);

    // --- ⊤ flips: any settled cell held both ways. The flip's `t` is the LATEST contributing row
    //     for that predicate (the row that completed the contradiction). ---------------------------
    if (wantKinds.has("top")) {
      for (const cell of settled.fiber) {
        if (!isTop(cell.value)) continue;
        const t = latestTForPredicate(rows, entity, cell.predicate);
        events.push({
          t, kind: "top", entity, weight: WEIGHT.top,
          line: `⊤  ${entity}: ${cell.predicate} ${cell.object} is held BOTH ways — a contested situation.`,
        });
      }
    }

    // --- death: an entity driven to alive:false by its injuries. -------------------------------
    if (wantKinds.has("death")) {
      let h = null;
      try { h = await healthOf(root, entity); } catch { h = null; }
      if (h && h.alive === false) {
        const worst = h.injuries.reduce((m, i) => (i.severity > m.severity ? i : m), { part: "?", severity: 0 });
        const t = latestTForPredicate(rows, entity, `injury:${worst.part}`) ?? lastT(rows);
        events.push({
          t, kind: "death", entity, weight: WEIGHT.death,
          line: `†  ${entity} died — a mortal ${worst.part} wound (severity ${worst.severity}).`,
        });
      }
    }

    // --- entangled-pair formation: the geometric residue of a past (F8). ------------------------
    if (wantKinds.has("entangled")) {
      const hist = await historyOf(root, entity);
      for (const p of hist.entangled) {
        events.push({
          t: lastT(rows), kind: "entangled", entity, weight: WEIGHT.entangled + p.gap,
          line: `⋈  ${entity}: ${p.a.predicate} ${p.a.object} entangled with ${p.b.predicate} ${p.b.object} (gap ${p.gap}).`,
        });
      }
    }

    // --- big functional changes: a need crashing, or a location change. -------------------------
    if (wantKinds.has("change")) {
      for (const cell of settled.fiber) {
        if (typeof cell.predicate === "string" && cell.predicate.startsWith("need:")) {
          const level = Number(cell.object);
          if (Number.isFinite(level) && level <= NEED_FLOOR) {
            events.push({
              t: latestTForPredicate(rows, entity, cell.predicate), kind: "change", entity, weight: WEIGHT.change,
              line: `↓  ${entity}: ${cell.predicate.slice("need:".length)} crashed to ${level}.`,
            });
          }
        }
      }
      // location changes: more than one distinct located-in destination over the trace ⇒ moved.
      const locs = rows.filter((r) => r.e === entity && r.a === "located-in" && r.v !== null);
      const distinct = [...new Set(locs.map((r) => r.v))];
      if (distinct.length >= 2) {
        const last = locs.reduce((m, r) => (r.t > m.t ? r : m), locs[0]);
        events.push({
          t: last.t, kind: "change", entity, weight: WEIGHT.change,
          line: `→  ${entity} moved to ${last.v}.`,
        });
      }
    }
  }

  let out = events;
  if (opts.minWeight != null) out = out.filter((e) => e.weight >= opts.minWeight);
  out = out.sort((a, b) =>
    b.weight - a.weight ||
    (a.t < b.t ? -1 : a.t > b.t ? 1 : 0) ||
    a.entity.localeCompare(b.entity) ||
    a.line.localeCompare(b.line));
  if (opts.limit != null) out = out.slice(0, opts.limit);
  return out;
}

// latestTForPredicate — the t of the latest base row asserting predicate `a` on `entity`. This is
// the moment the cell reached its current reading; for a ⊤ cell it's the row that completed the
// contradiction. Deterministic (string max over the append-only log).
function latestTForPredicate(rows, entity, a) {
  let best = null;
  for (const r of rows) {
    if (r.e !== entity || r.a !== a || r.v === null) continue;
    if (best === null || r.t > best) best = r.t;
  }
  return best;
}

// lastT — the latest t over a subject's whole trace (a stable fallback timestamp).
function lastT(rows) {
  let best = "";
  for (const r of rows) if (r.t > best) best = r.t;
  return best || null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world] = process.argv.slice(2);
  if (!world) {
    console.error("usage: node storylog.mjs <world>");
    process.exit(2);
  }
  const log = await storylog(world);
  if (log.length === 0) {
    console.log("(no tellable events — a quiet world.)");
  } else {
    for (const e of log) console.log(`[${e.weight}] ${e.line}`);
  }
}
