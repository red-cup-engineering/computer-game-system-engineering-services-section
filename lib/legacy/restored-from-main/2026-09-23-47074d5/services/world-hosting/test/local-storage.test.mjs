import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineGame } from "@red-cup-engineering/feltos/game";
import { createEngine } from "@red-cup-engineering/feltos/engine";
import { snapshotEngine } from "@red-cup-engineering/feltos/persistence";
import { openWorldStore, resolveWorldBackend } from "../src/world-store.mjs";
import { openClockStore } from "../src/clock-store.mjs";

test("world and historical clock survive reopening local stores", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "world-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const backend = resolveWorldBackend({ FELTOS_SAVE: join(directory, "world.json"), FELTOS_BUCKET: "retired" });
  assert.equal(backend.kind, "file");
  const engine = createEngine(defineGame({ id: "local-test", name: "Local test", start: "room", rooms: { room: { name: "Room", description: "A room." } } }));
  await openWorldStore(backend).save(engine);
  assert.deepEqual(snapshotEngine(await openWorldStore(backend).load()), snapshotEngine(engine));
  await openClockStore(backend, { clockKind: "farstone.world-clock.v1" }).save({ lastTickAt: 12345 });
  assert.deepEqual(await openClockStore(backend, { clockKind: "farstone.world-clock.v1" }).load(), { lastTickAt: 12345 });
  assert.equal(await openClockStore(backend, { clockKind: "other" }).load(), null);
  assert.throws(() => openWorldStore({ kind: "bucket", bucket: "retired" }), /local file/);
});
