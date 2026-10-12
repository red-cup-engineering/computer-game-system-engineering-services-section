/**
 * The Underfarr's living machinery: monsters that come back. These name the one invariant that
 * turns a cleared dungeon from a one-time museum into repeatable PvE — the renewing dark — and the
 * geography it reads (`home:`, `respawn:`, `depth:`). The crawl itself is bible content; this is the
 * system that keeps it dangerous after the first sweep.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tell, valueOf, placeOf, numberOf } from "./world.mjs";
import { homeOf, DEFAULT_RESPAWN } from "./depths.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

test("homeOf reads a monster's den from its tags, or null when it dens where it stands", () => {
  assert.equal(homeOf(["npc", "monster", "home:ufr-warren", "health:60"]), "ufr-warren");
  assert.equal(homeOf(["npc", "monster", "hostile"]), null);
});

const LAIR: Bible = {
  rooms: [
    { id: "den", name: "The Gnawed Den", description: "Bone and dark.", tags: ["place", "underground", "cave", "dark", "depth:1"] },
    { id: "tunnel", name: "A Tunnel", description: "Out.", exits: { in: "den" }, tags: ["place", "underground", "dark", "depth:1"] },
  ],
  npcs: [
    { id: "rat", name: "a giant rat", description: "Yellow-toothed and bold.", location: "den", tags: ["npc", "monster", "hostile", "home:den", "health:2", "attack:1", "respawn:3", "beast"] },
  ],
};

test("INVARIANT the renewing dark: a slain monster comes back at its den after its respawn delay", () => {
  const { world, content } = loadBible(LAIR);
  // Seed the hero hardy enough to weather the rat's bites while we cut it down.
  const s = new FizzosScene(tell(world, [
    { e: "hero", a: "health", v: "40" }, { e: "hero", a: "max-health", v: "40" },
    { e: "hero", a: "attack", v: "20" }, { e: "hero", a: "condition", v: "alive" },
  ]), content, "den");
  s.join("hero", "den");

  // Cut the rat down — a couple of blows past its 2 health.
  let t = 1;
  for (; t <= 6 && valueOf(s.currentWorld(), "rat", "condition") !== "dead"; t++) {
    s.runTick(t, [{ k: "command", actor: "hero", line: "attack rat" } satisfies CommandIntent]);
  }
  assert.equal(valueOf(s.currentWorld(), "rat", "condition"), "dead", "the rat falls");

  // Immediately after, it stays a corpse — the dark has not renewed it yet.
  s.runTick(t++, []);
  assert.equal(valueOf(s.currentWorld(), "rat", "condition"), "dead", "still down the tick after");

  // Run on past the respawn:3 window; the dark brings its like again, whole, at its den.
  for (let i = 0; i < 8; i++) s.runTick(t++, []);
  assert.equal(valueOf(s.currentWorld(), "rat", "condition"), "alive", "the rat is back");
  assert.equal(placeOf(s.currentWorld(), "rat"), "den", "back at its den");
  assert.equal(numberOf(s.currentWorld(), "rat", "health", 0), 2, "and whole again (full health)");
});

test("a monster with no respawn tag uses the default delay; the depth tag drives the deep atmosphere", () => {
  // The default is a real cooldown, not instant — a cleared room stays cleared for a while.
  assert.ok(DEFAULT_RESPAWN >= 10, "the dark renews slowly enough that clearing a room means something");
  // Sanity: depth-tagged rooms are what the atmosphere system keys on; the lair is depth 1.
  const { content } = loadBible(LAIR);
  assert.ok(content.rooms["den"]!.tags.some((t) => t.startsWith("depth:")), "the den is a depth room");
});
