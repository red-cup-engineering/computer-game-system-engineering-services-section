/**
 * The predication-world-sim heart, realized on the engine. Five capabilities from the
 * design doc, each proven: actions are COMPUTED from fiber composition (not listed); you can
 * play as any fiber; history is geometric entanglement; closure fires rules-as-data to a
 * fixpoint; and a thing that settles with witnesses FOLDS into a word — death becomes
 * vocabulary, and the word can be invoked and unfolded back into a being.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type ClosureRule, type Fiber, AFFORDANCES, affordances, bodyOf, carriesWordId, closeWorld,
  entangle, entanglementsOf, fold, inhabit, isSettledDead, release, respond, unfold,
  vocabularyOf, wordFor,
} from "./predication.mjs";
import { numberOf, valueOf, world } from "./world.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";
import { loadBible, startRoomOf } from "./world-load.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

/** A hand-built fiber for the pure-module tests. */
function fiber(id: string, kind: string, tags: readonly string[], cells: Record<string, string> = {}): Fiber {
  return {
    id, kind, tags,
    has: (p) => cells[p] !== undefined && cells[p] !== "",
    value: (p) => cells[p] ?? null,
    number: (p, d = 0) => (cells[p] !== undefined && Number.isFinite(Number(cells[p])) ? Number(cells[p]) : d),
  };
}
const me = fiber("me", "player", []);

// ── 1. respond / computed affordances ──────────────────────────────────────────

test("affordances are COMPUTED from the target's fiber, not listed", () => {
  const item = fiber("a-lantern", "item", ["item", "takeable"]);
  const npc = fiber("pip", "npc", ["npc", "shop", "sells:fizzwater"], { health: "12" });
  const itemCan = affordances(me, item).map((a) => a.channel);
  assert.ok(itemCan.includes("take"), "an item affords take");
  assert.ok(!itemCan.includes("attack"), "an item does not afford attack");
  const npcCan = affordances(me, npc).map((a) => a.channel);
  assert.ok(npcCan.includes("talk") && npcCan.includes("attack") && npcCan.includes("buy"), "an npc affords talk, attack, buy from its fiber");
});

test("respond composes a single channel to a bilattice charge", () => {
  const item = fiber("a-lantern", "item", ["item"]);
  assert.equal(respond(me, item, "take"), "potential", "take composes (t)");
  assert.equal(respond(me, item, "fly"), "absurd", "an unknown channel is ⊥ — outside the menu");
  const locked = fiber("a-door", "scenery", ["door"], { "door-state": "locked" });
  assert.equal(respond(me, locked, "open"), "active", "a locked door denies opening (f), still on the menu");
});

test("a fiber that does not compose affords nothing — ⊥ everywhere", () => {
  const inert = fiber("a-pebble", "scenery", ["scenery"]);
  assert.equal(affordances(me, inert).length, 0, "no channel composes with a bare fiber");
});

// ── 2. play as any fiber ────────────────────────────────────────────────────────

test("inhabit / bodyOf / release — assume control of any fiber", () => {
  let w = world([]);
  assert.equal(bodyOf(w, "me"), "me", "un-inhabited, you wear your own fiber");
  w = inhabit(w, "me", "the-tide");
  assert.equal(bodyOf(w, "me"), "the-tide", "you perceive through the inhabited fiber");
  w = release(w, "me");
  assert.equal(bodyOf(w, "me"), "me", "release returns you to yourself");
});

// ── 3. history as entanglement (F8) ─────────────────────────────────────────────

test("entanglement is dual-filed and accumulates as geometric history", () => {
  let w = world([]);
  w = entangle(w, "me", "a-sword", "held");
  w = entangle(w, "me", "a-dragon", "fought");
  w = entangle(w, "me", "a-shield", "held");
  // Identical pairs collapse under the idempotent knowledge-join; distinct ones accumulate.
  w = entangle(w, "me", "a-sword", "held");
  const mine = entanglementsOf(w, "me");
  assert.equal(mine.length, 3, "distinct compositions leave residue — history is the fiber's shape");
  assert.ok(mine.some((e) => e.kind === "fought" && e.other === "a-dragon"));
  // Dual-filed: the row lives in the object's log too.
  assert.ok(entanglementsOf(w, "a-dragon").some((e) => e.other === "me"), "the dragon carries the encounter too");
});

// ── 4. closure: rules-as-data fired to a fixpoint ──────────────────────────────

test("closeWorld fires rules to a fixpoint, chaining one into the next", () => {
  // a → b → c: a forward chain that must settle through three rounds.
  const rules: ClosureRule[] = [
    { id: "a→b", when: (f) => f.value("a") === "1" && f.value("b") !== "1", then: (f) => [{ e: f.id, a: "b", v: "1" }] },
    { id: "b→c", when: (f) => f.value("b") === "1" && f.value("c") !== "1", then: (f) => [{ e: f.id, a: "c", v: "1" }] },
  ];
  const lens = (w: typeof start, id: string): Fiber => fiber(id, "thing", [], {
    a: valueOf(w, id, "a") ?? "", b: valueOf(w, id, "b") ?? "", c: valueOf(w, id, "c") ?? "",
  });
  const start = world([{ e: "x", a: "a", v: "1" }]);
  const { world: closed, fired } = closeWorld(start, ["x"], rules, lens);
  assert.equal(valueOf(closed, "x", "c"), "1", "the chain settles all the way to c");
  assert.ok(fired.length >= 2, "both rules fired");
  // Idempotent: re-closing the fixpoint fires nothing.
  assert.equal(closeWorld(closed, ["x"], rules, lens).fired.length, 0, "a fixpoint is stable");
});

// ── 5. the tower/fold — death becomes vocabulary ───────────────────────────────

test("isSettledDead recognises a closed, inert fiber", () => {
  assert.ok(isSettledDead(fiber("x", "npc", [], { condition: "dead" })));
  assert.ok(isSettledDead(fiber("y", "npc", [], { health: "0" })));
  assert.ok(!isSettledDead(fiber("z", "npc", [], { health: "5" })));
});

test("fold with witnesses mints a word both carry; without, none is born", () => {
  const start = world([]);
  const alone = fold(start, "a-hero", "a hero", []);
  assert.equal(alone.word, null, "settling unwitnessed mints no vocabulary (F5.1)");

  const { world: w, word } = fold(start, "a-hero", "a hero", ["mourner-a", "mourner-b"]);
  assert.equal(word, wordFor("a hero"));
  assert.ok(vocabularyOf(w).includes(word!), "the word enters the world's vocabulary (F5.3)");
  assert.ok(carriesWordId(w, "mourner-a", word!) && carriesWordId(w, "mourner-b", word!), "every witness carries the word");
  assert.ok(entanglementsOf(w, "mourner-a").some((e) => e.kind === "mourned"), "the funeral entangles the mourner with the word");
});

test("unfold resurrects a word into a new being made from the word", () => {
  const { world: w, word } = fold(world([]), "a-hero", "a hero", ["m"]);
  const { world: w2, entity } = unfold(w, word!, "a-crypt");
  assert.equal(valueOf(w2, entity, "from-word"), word, "the new being is made from the word");
  assert.equal(valueOf(w2, entity, "located-in"), "a-crypt", "and stands where it was unfolded");
});

// ── scene integration ───────────────────────────────────────────────────────────

function scene(): FizzosScene {
  const { world, content } = loadBible(STARTER_WORLD);
  return new FizzosScene(world, content, startRoomOf(STARTER_WORLD));
}
let clock = 1;
const run = (s: FizzosScene, a: string, l: string): string =>
  s.runTick(clock++, [{ k: "command", actor: a, line: l } satisfies CommandIntent]).events.find((e) => e.to === a)?.text ?? "";

test("scene: `afford` shows the computed action menu for a nearby thing", () => {
  const s = scene();
  run(s, "p", "look");
  const menu = run(s, "p", "afford fizzwater");
  assert.match(menu, /take/, "the bottle of fizzwater affords take, computed from its fiber");
});

test("scene: `inhabit` lets you perceive through another fiber", () => {
  const s = scene();
  run(s, "p", "look");
  assert.match(run(s, "p", "inhabit pip"), /awareness pours/i);
  assert.match(run(s, "p", "look"), /Through the fiber of/, "look now renders from the inhabited fiber");
  assert.match(run(s, "p", "release"), /back into yourself/i);
});

test("scene: taking a thing entangles you with it (history)", () => {
  const s = scene();
  run(s, "p", "look");
  run(s, "p", "take fizzwater");
  assert.match(run(s, "p", "history"), /held/, "your fiber now carries the holding");
});

test("scene: mourning the slain folds a word into the world, which can be invoked", () => {
  const s = scene();
  run(s, "h", "look");
  run(s, "h", "north"); // to the jetty, where the hostile rat waits
  let slain = "";
  for (let i = 0; i < 12 && !/slain|already dead/.test(slain); i++) slain = run(s, "h", "attack rat") + run(s, "h", "look");
  const eulogy = run(s, "h", "eulogize rat");
  assert.match(eulogy, /vocabulary|word/i, "mourning the rat folds it into a word");
  const word = wordFor("a harbor rat");
  assert.match(run(s, "h", "vocabulary"), new RegExp(word), "the word stands in the world's vocabulary");
  assert.match(run(s, "h", `invoke ${word}`), /fold answers/i, "and the word, carried, can be invoked");
});
