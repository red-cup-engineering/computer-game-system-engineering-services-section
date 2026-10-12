// timeline — fork / diff / replay over a content-addressed, append-only world. Engine plumbing
// (hence the `scripts/` home and the `_`-free public ops): a world IS its on-disk EAVT logs, so
// the three timeline operations are SET operations over content-addressed rows, not new stores.
//
//   - fork(srcRoot, dstRoot)  : copy a world's logs to a NEW root — a cheap branch. Cheap because
//     a fork is just files (every row keeps its SHA-256 content-address), so the branch shares the
//     same identities as its source; only divergent later appends differ. "what-if" branches,
//     time-travel debugging, save-scum-as-a-feature.
//   - diff(rootA, rootB)      : set-difference over content-addressed rows. Two timelines differ
//     EXACTLY in the symmetric difference of their `rowId` sets (the addresses dedupe/federate
//     already compute). -> { onlyA:[rowId], onlyB:[rowId], shared:n }.
//   - replayInto(rootA, rootB): G-Set union of A's logs INTO B (re-export of mergeWorlds). Because
//     rows are append-only and content-addressed, the union is conflict-free (idempotent, order-
//     independent) — replaying a branch back is just a merge.
//
// All three are READS + log copies; nothing mutates history. DETERMINISTIC.
//
// CLI: node scripts/timeline.mjs fork <src> <dst>
//      node scripts/timeline.mjs diff <a> <b>

import { cp } from "node:fs/promises";
import { existsSync } from "node:fs";

import { allRows } from "#substrate";
import { rowId } from "#eavt-row";
import { mergeWorlds } from "#federate";

// fork — copy every file under srcRoot to dstRoot. A world is just files, so a branch is a copy;
// content-addressing makes it cheap in identity terms (shared rows keep the same `rowId`). Returns
// the destination root. Append-only: this writes a fresh tree, it never rewrites the source.
export async function fork(srcRoot, dstRoot) {
  if (!srcRoot || !dstRoot) throw new TypeError("fork: srcRoot and dstRoot are required");
  if (!existsSync(srcRoot)) throw new Error(`fork: source world does not exist: ${srcRoot}`);
  await cp(srcRoot, dstRoot, { recursive: true });
  return dstRoot;
}

// diff — the symmetric difference of two worlds by content-address. Reads every (deduped) row of
// each world, hashes to `rowId`, and reports which addresses are only in A, only in B, and how
// many are shared. The result is deterministic: ids are sorted. This is the same set algebra
// federation uses, pointed at "how do these two timelines differ".
export async function diff(rootA, rootB) {
  if (!rootA || !rootB) throw new TypeError("diff: rootA and rootB are required");
  const a = new Set((await allRows(rootA)).map(rowId));
  const b = new Set((await allRows(rootB)).map(rowId));
  const onlyA = [...a].filter((id) => !b.has(id)).sort();
  const onlyB = [...b].filter((id) => !a.has(id)).sort();
  let shared = 0;
  for (const id of a) if (b.has(id)) shared += 1;
  return { onlyA, onlyB, shared };
}

// replayInto — union A's logs into B (a G-Set merge; conflict-free because rows are content-
// addressed and append-only). This is mergeWorlds with timeline-op naming: "replay this branch
// back onto that one". -> { added, skipped }.
export async function replayInto(rootA, rootB) {
  if (!rootA || !rootB) throw new TypeError("replayInto: rootA and rootB are required");
  return mergeWorlds(rootA, rootB);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === "fork") {
    if (!a || !b) { console.error("usage: node timeline.mjs fork <src> <dst>"); process.exit(2); }
    await fork(a, b);
    console.log(`✓ forked ${a} → ${b}`);
  } else if (cmd === "diff") {
    if (!a || !b) { console.error("usage: node timeline.mjs diff <a> <b>"); process.exit(2); }
    const d = await diff(a, b);
    console.log(JSON.stringify(d, null, 2));
  } else if (cmd === "replay") {
    if (!a || !b) { console.error("usage: node timeline.mjs replay <from> <into>"); process.exit(2); }
    console.log(JSON.stringify(await replayInto(a, b), null, 2));
  } else {
    console.error("usage: node timeline.mjs fork|diff|replay <a> <b>");
    process.exit(2);
  }
}
