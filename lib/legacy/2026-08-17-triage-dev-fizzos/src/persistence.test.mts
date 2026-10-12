/**
 * Durability — the world survives process death. Atomic writes never corrupt the save;
 * a played session reloads exactly; a garbage file degrades to "start fresh", not a crash.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileStore } from "./persistence.mjs";
import { FizzosScene, type SceneSnapshot } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

const tmp = (): string => join(mkdtempSync(join(tmpdir(), "fizzos-")), "world.json");

function scene(): FizzosScene {
  const { world, content } = loadBible(STARTER_WORLD);
  return new FizzosScene(world, content, startRoomOf(STARTER_WORLD));
}

test("durable store — a saved world reloads exactly (simulated crash + restart)", () => {
  const path = tmp();
  const store = fileStore<SceneSnapshot>(path);
  assert.equal(store.load(), null, "no save yet -> start fresh");

  const live = scene();
  live.runTick(0, [{ k: "command", actor: "hero", line: "look" }]); // hero joins
  store.save(live.snapshot());

  // a new process boots and loads the latest snapshot
  const reloaded = scene();
  const loaded = store.load();
  assert.ok(loaded !== null, "the snapshot is readable after a 'crash'");
  reloaded.restore(loaded!);
  assert.equal(reloaded.snapOf("hero")?.locatedIn, live.snapOf("hero")?.locatedIn, "the world survives death");
});

test("durable store — a corrupt save degrades to fresh start, never throws", () => {
  const path = tmp();
  writeFileSync(path, "{ this is not json");
  const store = fileStore<SceneSnapshot>(path);
  assert.doesNotThrow(() => store.load());
  assert.equal(store.load(), null, "garbage -> null, so the server can start a fresh world");
});

test("durable store — atomic write replaces the prior save wholesale", () => {
  const path = tmp();
  const store = fileStore<SceneSnapshot>(path);
  const a = scene();
  a.runTick(0, [{ k: "command", actor: "alice", line: "look" }]);
  store.save(a.snapshot());
  const b = scene();
  b.runTick(1, [{ k: "command", actor: "bob", line: "look" }]);
  store.save(b.snapshot());
  const loaded = store.load();
  assert.ok(loaded!.players.includes("bob"), "the latest save wins");
  assert.ok(!loaded!.players.includes("alice"), "the prior save is wholly replaced, not merged");
});
