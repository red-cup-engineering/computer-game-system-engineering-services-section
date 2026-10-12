// VENDORED — verbatim copy from @561-group/ruinfold-daily (apps/ruinfold/src/engine/daily.mts),
// commit tree as of 2026-08-19, for @red-cup-engineering/replay-spectacle's ruinfold adapter.
// This file is NOT maintained here: it is a snapshot of ruinfold's own game engine, copied
// (not reimplemented) so the renderer can independently recompute replay(seed, log) offline,
// without taking ruinfold-daily (a private, unpublished app) on as an installed dependency.
// Source of truth remains apps/ruinfold/src/engine/daily.mts — resync by re-copying, never hand-edit.
// Internal '#engine/*' imports below resolve via THIS package's own package.json "imports" map.

// daily — the ONLY place a UTC date turns into a number (design §1.1). Pure: takes a date STRING,
// never reads the clock itself. `node:crypto` is Node stdlib, not an npm dependency — consistent
// with zero-external-deps. Everything downstream of the returned seed (dungeon.mts's generator,
// the whole engine) is a pure function, replayable years later by anyone who knows the date string.

import { createHash } from "node:crypto";

// dailySeed — one deterministic 32-bit seed per calendar date, forever.
export function dailySeed(dateUTC: string /* "YYYY-MM-DD" */): number {
  const digest = createHash("sha256").update(`ruinfold-daily:${dateUTC}`).digest();
  return digest.readUInt32BE(0);
}
