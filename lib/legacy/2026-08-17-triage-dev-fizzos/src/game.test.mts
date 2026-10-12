/**
 * The engine/game seam: FizzOS is a general engine that a `GameDefinition` parameterizes.
 * The engine core knows nothing of pollution or blight — it runs the closure rules and the
 * fields the game hands it. A neutral game settles and diffuses nothing; a custom (non-
 * Farstone) game's own field diffuses and its own rule fires. Farstone is just one definition.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { type GameDefinition, NEUTRAL_GAME } from "./game.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { numberOf, tell, valueOf } from "./world.mjs";

const WATERS: Bible = {
  rooms: [
    { id: "dock", name: "Dock", description: "d", exits: { out: "sea-a" } },
    { id: "sea-a", name: "A", description: "a", exits: { in: "dock", deep: "sea-b" }, tags: ["ocean"] },
    { id: "sea-b", name: "B", description: "b", exits: { shallow: "sea-a" }, tags: ["ocean"] },
  ],
};

test("a NEUTRAL game bakes nothing in — pollution neither diffuses nor blights", () => {
  const { world, content } = loadBible(WATERS);
  const s = new FizzosScene(tell(world, [{ e: "sea-a", a: "pollution", v: "20" }]), content, "dock", NEUTRAL_GAME);
  let clock = 1;
  for (let i = 0; i < 8; i++) s.runTick(clock++, []);
  assert.equal(numberOf(s.currentWorld(), "sea-b", "pollution", 0), 0, "no field declared → pollution does not spread");
  assert.equal(valueOf(s.currentWorld(), "sea-a", "blighted"), null, "no rule declared → nothing blights");
});

test("Farstone (the default game) DOES diffuse and blight the same world", () => {
  const { world, content } = loadBible(WATERS);
  const s = new FizzosScene(tell(world, [{ e: "sea-a", a: "pollution", v: "20" }]), content, "dock"); // default = Farstone
  let clock = 1;
  for (let i = 0; i < 6; i++) s.runTick(clock++, []);
  assert.ok(numberOf(s.currentWorld(), "sea-b", "pollution", 0) > 1, "Farstone's pollution field spreads the plume");
  assert.equal(valueOf(s.currentWorld(), "sea-a", "blighted"), "true", "Farstone's blight rule fires on the fouled cell");
});

test("a custom (non-Farstone) game parameterizes the same engine", () => {
  // A forge world with its OWN field (heat) and its OWN closure rule (scorch) — no Farstone.
  const FORGE: Bible = {
    rooms: [
      { id: "yard", name: "Yard", description: "y", exits: { in: "forge-a" } },
      { id: "forge-a", name: "Forge A", description: "a", exits: { out: "yard", deep: "forge-b" }, tags: ["forge"] },
      { id: "forge-b", name: "Forge B", description: "b", exits: { shallow: "forge-a" }, tags: ["forge"] },
    ],
  };
  const SMITHING: GameDefinition = {
    name: "smithing",
    fields: [{ name: "heat", overTag: "forge", predicate: "heat", rate: 0.2 }],
    worldRules: [{ id: "scorch", when: (f) => f.number("heat", 0) >= 10 && f.value("scorched") !== "true", then: (f) => [{ e: f.id, a: "scorched", v: "true" }] }],
  };
  const { world, content } = loadBible(FORGE);
  const s = new FizzosScene(tell(world, [{ e: "forge-a", a: "heat", v: "20" }]), content, "yard", SMITHING);
  let clock = 1;
  for (let i = 0; i < 4; i++) s.runTick(clock++, []);
  assert.ok(numberOf(s.currentWorld(), "forge-b", "heat", 0) > 1, "the game's own heat field diffuses");
  assert.equal(valueOf(s.currentWorld(), "forge-a", "scorched"), "true", "the game's own scorch rule fires");
});

test("a game ships its OWN genre catalog (professions) — not Farstone's", () => {
  const HALL: Bible = { rooms: [{ id: "hall", name: "Hall", description: "h", exits: {} }] };
  const RANGER_GAME: GameDefinition = {
    name: "rangers",
    catalogs: { professions: { ranger: { title: "Ranger", skills: ["tracking", "archery"] } } },
  };
  const { world, content } = loadBible(HALL);
  const s = new FizzosScene(world, content, "hall", RANGER_GAME);
  let clock = 1;
  const run = (a: string, l: string): string =>
    s.runTick(clock++, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events.find((e) => e.to === a)?.text ?? "";
  run("p", "look");
  assert.match(run("p", "profess ranger"), /Ranger/, "the game's own profession is offered");
  assert.match(run("p", "profess fisher"), /no trade "fisher"/i, "Farstone's professions are NOT present");
  assert.ok(numberOf(s.currentWorld(), "p", "skill:tracking", 0) >= 15, "the custom trade grounds its custom skills");
});

test("ecology is game-declared — a NEUTRAL game's waters do not live", () => {
  const { world, content } = loadBible(WATERS);
  // Seed fish + pollution; under the neutral game (no ecology) neither should change.
  const seeded = tell(world, [{ e: "sea-a", a: "fish-stock", v: "10" }, { e: "sea-a", a: "pollution", v: "8" }]);
  const s = new FizzosScene(seeded, content, "dock", NEUTRAL_GAME);
  let clock = 1;
  for (let i = 0; i < 9; i++) s.runTick(clock++, []);
  assert.equal(numberOf(s.currentWorld(), "sea-a", "pollution", 0), 8, "no ecology → pollution does not decay");
  assert.equal(numberOf(s.currentWorld(), "sea-a", "fish-stock", 0), 10, "no ecology → fish do not grow");
});

test("the genre toolkit is optional — `genre: false` offers no trade/craft/harvest verbs", () => {
  const HALL: Bible = { rooms: [{ id: "hall", name: "Hall", description: "h", exits: {} }] };
  const BARE: GameDefinition = { name: "bare", genre: false };
  const { world, content } = loadBible(HALL);
  const s = new FizzosScene(world, content, "hall", BARE);
  let clock = 1;
  const run = (a: string, l: string): string =>
    s.runTick(clock++, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events.find((e) => e.to === a)?.text ?? "";
  run("p", "look");
  assert.match(run("p", "fish"), /don't know how to "fish"/i, "a genre verb is not offered");
  assert.match(run("p", "craft a raft"), /don't know how to "craft"/i, "nor crafting");
  // Core verbs still work.
  assert.match(run("p", "look"), /Hall/, "the generic engine still looks, moves, speaks");
});

test("the SDK escape hatch — a game composes engine world-helpers via ctx.apply and reads ctx.catalogs", () => {
  let sawProfessions = 0;
  const ESCAPE: GameDefinition = {
    name: "escape",
    genre: false,
    commands: {
      bless: (ctx, actor) => {
        sawProfessions = Object.keys(ctx.catalogs.professions).length; // resolved toolkit data is exposed
        ctx.apply((w) => tell(w, [{ e: actor, a: "blessed", v: "true" }])); // run an engine World→World helper
        return "Blessed.";
      },
    },
  };
  const { world, content } = loadBible({ rooms: [{ id: "hall", name: "Hall", description: "h", exits: {} }] });
  const s = new FizzosScene(world, content, "hall", ESCAPE);
  let clock = 1;
  const run = (a: string, l: string): string =>
    s.runTick(clock++, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events.find((e) => e.to === a)?.text ?? "";
  run("p", "look");
  assert.match(run("p", "bless"), /Blessed/);
  assert.equal(valueOf(s.currentWorld(), "p", "blessed"), "true", "ctx.apply ran a World→World transform through the engine");
  assert.ok(sawProfessions > 0, "ctx.catalogs exposes the resolved genre toolkit data to any game");
});
