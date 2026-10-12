// bucket-store -- GCS-backed implementation of a daily tournament's persistence contract, same
// method set as store.mjs's synchronous file-store, Promise-returning. Extracted verbatim from
// apps/ruinfold/src/server/bucket-store.mts. See store-factory.mjs for the file/bucket selection
// point. The GCS JSON API transport (createGoogleApiRequest, createGcsClient) now lives in
// gcs-client.mjs and is re-exported here for existing callers of this subpath -- see that
// module's header for the append-retry/create-only correctness core writeScoredLock and the
// JSONL appends below both rest on.

import { createGoogleApiRequest, createGcsClient, parseJsonl } from "./gcs-client.mjs";

export { createGoogleApiRequest, createGcsClient };

function normalizeRoot(root) {
  if (root === "") return "";
  return root.endsWith("/") ? root : `${root}/`;
}

// openBucketDailyStore -- the GCS-backed DailyStore. `root` is an object-name prefix ("" default
// means no prefix, matching store.mjs's directory-root default).
export function openBucketDailyStore(opts) {
  const root = normalizeRoot(opts.root ?? "");
  const client = createGcsClient(opts);

  const runFile = (date) => `${root}runs/${date}.jsonl`;
  const scoreFile = (date) => `${root}scores/${date}.jsonl`;
  const lockFile = (date, actor) => `${root}scored-attempts/${date}/${actor}.json`;
  const runsPrefix = `${root}runs/`;
  const scoresPrefix = `${root}scores/`;

  async function readRunsForDate(date) {
    const obj = await client.getObject(runFile(date));
    return obj ? parseJsonl(obj.text) : [];
  }
  async function readScoresForDate(date) {
    const obj = await client.getObject(scoreFile(date));
    return obj ? parseJsonl(obj.text) : [];
  }
  function datesFromNames(names, prefix) {
    return names
      .filter((n) => n.startsWith(prefix) && n.endsWith(".jsonl"))
      .map((n) => n.slice(prefix.length, -".jsonl".length))
      .sort();
  }

  return {
    root,
    async appendRun(rec) {
      await client.appendJsonlLine(runFile(rec.date), JSON.stringify(rec) + "\n");
    },
    readRunsForDate,
    async readRunById(date, runId) {
      const runs = await readRunsForDate(date);
      return runs.find((r) => r.runId === runId) ?? null;
    },
    async appendScore(rec) {
      await client.appendJsonlLine(scoreFile(rec.date), JSON.stringify(rec) + "\n");
    },
    readScoresForDate,
    async listRunDates() {
      return datesFromNames(await client.listObjectNames(runsPrefix), runsPrefix);
    },
    async listScoreDates() {
      return datesFromNames(await client.listObjectNames(scoresPrefix), scoresPrefix);
    },
    async hasScoredLock(date, actor) {
      return client.objectExists(lockFile(date, actor));
    },
    // Atomic create-only (ifGenerationMatch=0) -- see module header. Throws if another instance
    // already holds this (date, actor) lock, which is how "exactly one winner" surfaces through a
    // void-returning method.
    async writeScoredLock(date, actor, runId) {
      const body = JSON.stringify({ actor, date, runId, lockedAt: new Date().toISOString() });
      const won = await client.createOnly(lockFile(date, actor), body);
      if (!won) throw new Error(`scored-lock-already-held: ${date}/${actor} (another instance won the race)`);
    },
  };
}
