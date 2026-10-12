// streaming/events — the WORLD-EVENT PROJECTION for tab's SSE firehose. `streaming/` nests under
// `observing/` beside `storylog`/`perceiving`: it READS being's residue (the rows a tick appended)
// into a derived view and changes nothing — it adds no column and appends no row.
//
// THE PROJECTION ITSELF IS NO LONGER HAND-ROLLED HERE. The general EAVT-delta -> topic-tagged event
// stream lives once in @561-group/computer/event-projection (projectEvents / topicOf /
// createEventSchema / EVENT_TOPICS), lifted FROM this very file. tab consumes it by name. The default
// computer schema reproduces tab's world taxonomy (world | chat | combat | market) exactly — tick,
// say, emote, combat, death, price/amount, coin, move, and the ⊤ event — so the wire format is
// unchanged. EVENT_TOPICS and topicOf are RE-EXPORTED from computer (one source of the taxonomy).
//
// What tab keeps is its DISK COUPLING — the thin specialization the pure projector deliberately drops:
//   - the web server hands worldEvents one daemon cycle's rows AND a disk `root`;
//   - ACTOR-NESS for move: with a root, a located-in subject is a mover only if it carries a `mover`
//     cell — read from DISK (the delta holds only the located-in row). tab resolves each located-in
//     subject's mover fact off disk and folds it into the delta as a `mover` row (which the projector
//     reads into its actor signal but never emits), so computer's in-delta move rule reproduces tab's
//     disk semantics: a `mover`-less subject (an item set down in a room) is NOT a move.
//   - ⊤ (contradiction): with a root, tab settles each delta subject over its FULL disk log (the
//     converse + both faces may live on disk, not in the cycle), so a cell held both ways surfaces as
//     a `top` event. The pure projector settles over the delta only; tab supplies the disk settle and
//     passes the projector `{top:false}`, then merges its own disk ⊤ events in.
//
// Without a root, worldEvents is exactly computer's pure projectEvents over the delta (prefix-only
// actor-ness, no ⊤ pass). With a root it is that, plus the two disk specializations above.
//
// worldEvents(rows, { root } = {}) -> [ { type, topic, ...fields, t } ]   (async)
//
// CLI: node events.mjs <world.jsonl>   — read a JSONL row file, project, print events as JSON.

import { projectEvents, createEventSchema } from "@561-group/computer/event-projection";
import { settle, rowsFor } from "#substrate";
import { isTop } from "#value";

// Re-export the taxonomy from computer — the single source of the wire vocabulary and the fine ->
// coarse channel map. tab adds nothing to it; its world taxonomy IS computer's default schema.
export { EVENT_TOPICS, topicOf } from "@561-group/computer/event-projection";

// The no-⊤ schema tab hands the pure projector when it owns the ⊤ pass itself (the disk settle). The
// rules, groups, topics and type->topic map are all computer's defaults (tab's taxonomy unchanged).
const NO_TOP_SCHEMA = createEventSchema({ top: false });

// NON_ACTOR_PREFIXES — id prefixes whose located-in is filing, not a move (an utterance/emote/letter/
// mailbox/corpse/crafted item). Mirrors the projector's own list; tab uses it to skip reading disk
// mover facts for rows the projector already filters out cheaply.
const NON_ACTOR_PREFIXES = ["utt:", "emote:", "letter:", "mbox:", "corpse:", "made:"];
const isReified = (id) => typeof id === "string" && id.startsWith("row:");
const hasNonActorPrefix = (id) =>
  typeof id === "string" && NON_ACTOR_PREFIXES.some((p) => id.startsWith(p));

export default async function worldEvents(rows, { root } = {}) {
  if (!Array.isArray(rows)) throw new TypeError("worldEvents: rows must be an array");

  // No root: the projection is exactly computer's pure projectEvents over the delta (the default
  // schema = tab's taxonomy, with the in-delta actor-ness and the delta-only ⊤ pass).
  if (!root) return projectEvents(rows);

  // With a root, resolve tab's DISK specializations and delegate the pure projection to computer.
  //
  // (1) actor-ness off disk: for each non-reified, non-filing located-in subject in the delta, read
  //     its disk mover fact and fold it into the delta as a `mover` row. The projector reads `mover`
  //     rows into its actor signal but never emits them, so its in-delta move rule then reproduces
  //     tab's "with a root, a subject is a mover only if it carries a mover cell" — default-deny.
  const enriched = rows.slice();
  const seenMover = new Set();
  for (const r of rows) {
    if (r == null || r.a !== "located-in" || r.v == null) continue;
    const e = r.e;
    if (!(typeof e === "string") || isReified(e) || hasNonActorPrefix(e) || seenMover.has(e)) continue;
    seenMover.add(e);
    let mover = false;
    try {
      for (const rr of await rowsFor(root, e)) {
        if (rr.e === e && rr.a === "mover" && rr.v != null && rr.v !== false) { mover = true; break; }
      }
    } catch { mover = true; } // a read failure falls back to actor-by-default (the prefix verdict)
    // A synthetic mover row carrying the disk verdict. It emits nothing; it only seeds the projector's
    // mentionsMover/isMover signal so a mover-less subject is filtered out of move.
    enriched.push({ e, a: "mover", v: mover, t: r.t });
  }

  // Project the pure kinds (tick/say/emote/combat/death/market/move) over the enriched delta, ⊤ off.
  const events = projectEvents(enriched, NO_TOP_SCHEMA);

  // (2) ⊤ off disk: settle each distinct non-reified delta subject over its FULL disk log; any cell
  //     held both ways is a contradiction-as-a-value — a `top` event on topic world. This is tab's
  //     disk settle (the converse/both-faces may live on disk, outside the cycle), the one piece the
  //     pure projector cannot do. Best-effort per subject; ⊤ events sort after the others (no carrier).
  const seen = new Set();
  for (const r of rows) {
    if (r == null || typeof r.e !== "string" || isReified(r.e) || seen.has(r.e)) continue;
    seen.add(r.e);
    let settled = null;
    try { settled = await settle(root, r.e); } catch { settled = null; }
    if (!settled || !Array.isArray(settled.fiber)) continue;
    for (const cell of settled.fiber) {
      if (!isTop(cell.value)) continue;
      events.push({
        type: "top", topic: "world", entity: r.e, predicate: cell.predicate, object: cell.object,
        t: lastT(rows, r.e),
      });
    }
  }
  return events;
}

// lastT — the latest t over the cycle's rows for a given subject (a stable ⊤ timestamp).
function lastT(rows, entity) {
  let best = null;
  for (const r of rows) {
    if (r == null || r.e !== entity || r.t == null) continue;
    if (best === null || r.t > best) best = r.t;
  }
  return best;
}

// CLI: node events.mjs <world.jsonl> — read a JSONL row file, project, print the events as JSON.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [file] = process.argv.slice(2);
  if (!file) {
    console.error("usage: node events.mjs <world.jsonl>");
    process.exit(2);
  }
  const { readFileSync } = await import("node:fs");
  const rows = readFileSync(file, "utf8")
    .split("\n").filter((l) => l.trim())
    .map((l) => JSON.parse(l));
  const evs = await worldEvents(rows);
  console.log(JSON.stringify(evs, null, 2));
}
