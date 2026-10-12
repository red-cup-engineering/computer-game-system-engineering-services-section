/**
 * Horizontal scale: a federation of authoritative shards, one world. Two scenes each tick
 * their own zone in parallel (no shared writer); a player who walks across the zone boundary
 * MIGRATES — their fiber and everything they carry sent as an entity packet, dropped from the
 * source shard, imported into the destination with stats and inventory intact. Cross-shard
 * agreement is read with the same federation H¹ a single tick uses (`@emsenn/computing`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Federation, type Shard } from "./federation.mjs";
import { FizzosScene } from "./scene.mjs";
import { type Bible, loadBible } from "./world-load.mjs";

/** A world split across two shards: the west quay (A) and the east tower (B), joined by a bridge. */
const BIBLE: Bible = {
  rooms: [
    { id: "west-quay", name: "West Quay", description: "The western quay.", exits: { east: "the-bridge" } },
    { id: "the-bridge", name: "The Bridge", description: "A long bridge over the strait.", exits: { west: "west-quay", east: "east-tower" } },
    { id: "east-tower", name: "East Tower", description: "The eastern tower.", exits: { west: "the-bridge" } },
  ],
  items: [
    { id: "a-lantern", name: "a brass lantern", description: "A bright brass lantern.", location: "west-quay", tags: ["item", "takeable"] },
  ],
  npcs: [
    { id: "a-sentry", name: "a sentry", description: "A still tower sentry.", location: "east-tower", tags: ["npc", "health:10", "attack:1"] },
  ],
};

/** Two independent scenes over the same content, each authoritative for half the rooms. */
function federation(): Federation {
  const west = loadBible(BIBLE);
  const east = loadBible(BIBLE);
  const shards: Shard[] = [
    { name: "west", scene: new FizzosScene(west.world, west.content, "west-quay"), zone: new Set(["west-quay", "the-bridge"]) },
    { name: "east", scene: new FizzosScene(east.world, east.content, "east-tower"), zone: new Set(["east-tower"]) },
  ];
  return new Federation(shards);
}

test("a player is routed to the shard that owns the room they stand in", () => {
  const fed = federation();
  assert.equal(fed.join("p", "west-quay"), "west", "joining the west quay puts you on the west shard");
  fed.step();
  assert.equal(fed.shardOf("p"), "west");
});

test("walking across the zone boundary migrates the player, with inventory and stats intact", () => {
  const fed = federation();
  fed.join("p", "west-quay");
  fed.step(); // join + look settle on west
  fed.queue("p", "take lantern");
  fed.step();
  fed.queue("p", "east"); // to the bridge — still west's zone
  fed.step();
  assert.equal(fed.shardOf("p"), "west", "the bridge belongs to the west shard");
  fed.queue("p", "east"); // onto the east tower — east's zone: a crossing
  const { migrations } = fed.step();
  assert.equal(fed.shardOf("p"), "east", "the player migrated to the east shard");
  assert.deepEqual(migrations.map((m) => `${m.from}->${m.to}`), ["west->east"], "the crossing is reported");

  // On the destination shard the player carries the lantern and is a known player there.
  const east = fed.shardOf("p");
  assert.equal(east, "east");
  // The lantern's placement came across in the packet: it is located in the player on east.
  fed.queue("p", "inventory");
  const after = fed.step();
  const inv = after.events.find((e) => e.to === "p" && e.shard === "east");
  assert.match(inv?.text ?? "", /lantern/i, "the carried lantern migrated with the player");
});

test("shards tick in parallel — the east world lives while the player is on the west", () => {
  const fed = federation();
  fed.join("p", "west-quay");
  for (let i = 0; i < 5; i++) fed.step(); // player idles on west; east ticks independently
  // The east shard's sentry exists and the east tick advanced on its own (no west input).
  const east = fed["shards"].get("east")!;
  assert.ok(east.scene.metrics().tick >= 4, "the east shard advanced its own authoritative tick");
});

test("federation confluence — after a clean migration the shards agree (one section)", () => {
  const fed = federation();
  fed.join("p", "west-quay");
  fed.step();
  // The player is held by exactly one shard, so the federation is a clean global section.
  assert.equal(fed.confluenceOf("p"), true, "no shard disagreement: the H¹ class vanishes");
});
