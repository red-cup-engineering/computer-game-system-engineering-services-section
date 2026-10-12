// federate — cross-instance federation. `federating/` nests under `doing/` because a row
// crossing a boundary is itself an intra-action: a predication received from elsewhere.
//
// The world-sim: "two FARS instances sharing content-addressed entities. A player walks from one
// server to another by their entity file being sent as a message. Same SHA-256 hash, same
// identity. No 'server transfer' — just a predication crossing a boundary." tab gets this almost
// for free: rows are content-addressed (`rowId`), logs are append-only, so federation is a G-Set
// union of the logs — concatenate each `<entity>.jsonl`, dedup by content-address, conflict-free.
//
// THE ALGEBRA IS NOT TAB'S. The G-Set union of two append-only worlds — the tensor ∥, deduped by
// content-id, idempotent/commutative/associative — lives once in @561-group/computer/distribution
// (the L9 federation layer). It works over a world as PLAIN DATA: a Map<subject, rows[]>. tab no
// longer hand-rolls the on-disk merge. Here tab keeps ONLY the disk membrane around that algebra:
//   load(root)      : read every <subject>.jsonl off disk into an in-memory Map<subject, rows[]>.
//   <merge in memory via distribution's federate / mergeWorlds / migrate>.
//   writeBack(...)  : append the rows the merge added, through tab's append-only byte-touch.
// The merge decides WHAT crosses (union by content-id); tab decides only HOW it lands on disk.
//
// Federation unions PER LOG, not per row: a row's physical home log is not always its `e` field
// (a `has-converse` declaration is filed at the declaring subject; a reified `enacted-by` row at
// the base row's subject). Unioning whole logs preserves placement — including the dual-filed
// copies of relational rows, which already live in both anchor logs of the source, so no re-dual-
// filing is needed (and would double them). So a whole-world merge writes each new row RAW (no
// dual filing). The exception is `migrate` (one entity's own log crossing): the place anchors
// aren't in that batch, so dual filing IS restored on receipt (TRC §4) — the new rows go through
// tab's dual-filing `append`, which re-files relational rows at their object anchor.
//
// mergeWorlds(from, into) -> { added, skipped }          (union every log of one instance)
// federate({ from, into, entity? }) -> { added, skipped } (one entity = a player walking across)
// admit(into, subject, rows, opts?) -> { added, skipped } (low-level: union a batch into one log)

import { rowsFor, subjects, append } from "#substrate";
import { rowId } from "#eavt-row";
import eavtAppend from "@561-group/computer/posix-holography/eavt-append";
import {
  admitLog,
  federate as federateWorlds,
  migrate as migrateEntity,
} from "@561-group/computer/distribution";
import { join } from "node:path";

// rawAppend — append a line to <subject>.jsonl WITHOUT dual-filing. Per-log union must not
// re-dual-file: the source's other anchor logs are unioned separately, so re-filing would double
// relational rows. The byte-touch (mkdir + append a JSON line) is computer's canonical append-only
// flatfile primitive (posix-holography/eavt-append) — tab does not hand-roll the OS write.
async function rawAppend(root, subject, row) {
  eavtAppend(join(root, `${subject}.jsonl`), row);
}

// load(root) — the disk membrane: read every subject's log off disk into a plain in-memory world
// (Map<subject, rows[]>) the distribution algebra operates on. This is the ONLY place tab reads the
// logs for a merge; the union itself never touches disk.
async function load(root) {
  const world = new Map();
  for (const s of await subjects(root)) world.set(s, await rowsFor(root, s));
  return world;
}

// writeBack(root, subject, rows, base, opts) — land the rows a per-log merge admitted. `rows` is the
// merged log distribution produced for `subject`; `base` is the set of content-ids already on disk
// for that subject. We append exactly the genuinely-new rows (those not in `base`), through tab's
// byte-touch — `dualFile` routes them through `append` (restores the relational object-anchor copy,
// for migrate) or `rawAppend` (a verbatim log union, where dual copies already cross separately).
async function writeBack(root, subject, rows, base, { dualFile = false } = {}) {
  let added = 0;
  let skipped = 0;
  for (const row of rows) {
    if (base.has(rowId(row))) { skipped += 1; continue; }
    if (dualFile) await append(root, subject, row);
    else await rawAppend(root, subject, row);
    base.add(rowId(row));
    added += 1;
  }
  return { added, skipped };
}

export async function admit(into, subject, rows, { dualFile = false } = {}) {
  // The algebra (G-Set union of `rows` into the on-disk log, deduped by content-id, with the row
  // contract asserted at the boundary) is computer/distribution's admitLog over the in-memory log.
  const have = new Set((await rowsFor(into, subject)).map(rowId));
  const { world } = admitLog(new Map(), subject, rows); // assertRow + dedup-within-batch, off disk
  // Land only the rows admitLog accepted that aren't already on disk; dualFile restores the
  // object-anchor copy (migrate), raw preserves a verbatim log union.
  return writeBack(into, subject, world.get(subject) ?? [], have, { dualFile });
}

export async function mergeWorlds(from, into) {
  // Load both worlds, federate them in memory (the tensor ∥ — union every log by content-id), then
  // write back what crossed. Per-log union: dual copies already live in both source anchor logs, so
  // each new row lands raw (no re-dual-filing).
  const fromWorld = await load(from);
  const intoWorld = await load(into);
  const merged = federateWorlds(intoWorld, fromWorld);
  let added = 0;
  let skipped = 0;
  for (const s of await subjects(from)) {
    const have = new Set((intoWorld.get(s) ?? []).map(rowId));
    const r = await writeBack(into, s, merged.get(s) ?? [], have, { dualFile: false });
    added += r.added;
    skipped += r.skipped;
  }
  return { added, skipped };
}

export default async function federate({ from, into, entity } = {}) {
  if (!from || !into) throw new TypeError("federate: { from, into } are required");
  // One entity crossing: migrate its own log in memory (distribution.migrate), then write back with
  // dual filing RESTORED so the place anchors rebuild on receipt.
  if (entity) {
    const fromWorld = await load(from);
    const intoWorld = await load(into);
    const merged = migrateEntity(fromWorld, intoWorld, entity);
    const have = new Set((intoWorld.get(entity) ?? []).map(rowId));
    return writeBack(into, entity, merged.get(entity) ?? [], have, { dualFile: true });
  }
  return mergeWorlds(from, into);
}

// CLI: node federate.mjs <from-world> <into-world> [entity]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [from, into, entity] = process.argv.slice(2);
  if (!from || !into) {
    console.error("usage: node federate.mjs <from-world> <into-world> [entity]");
    process.exit(2);
  }
  console.log(JSON.stringify(await federate({ from, into, entity }), null, 2));
}
