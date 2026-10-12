/**
 * The Cabinet: interiority as a deepening of the perception fiber (DESIGN §4.3). These name the
 * invariant — *two minds in the same room perceive different worlds* — and check that a faculty
 * is a lens onto the live simulation (the weather, an NPC's stance), seeded so it replays exact.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, tell } from "./world.mjs";
import { FACULTIES, type DialogueView, type InteriorityView, cabinetReport, cabinetSeed, dialogueLines, interiorityLines, senses } from "./interiority.mjs";
import { loadBible, type Bible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

const cabinet = (actor: string, level: number) => world(FACULTIES.map((f) => ({ e: actor, a: `faculty:${f.key}`, v: String(level) })));

const VIEW: InteriorityView = {
  weather: "fog",
  season: "autumn",
  tide: "low",
  npcs: [{ name: "Dax Pell", mood: "content", stance: "offensive", armed: true }],
  hasHidden: true,
  contested: ["the catch runs strong here and the water is fouled, both at once"],
  self: { hunger: 0, rest: 0, health: 10, maxHealth: 10 },
};

test("INVARIANT umwelt: a keener cabinet perceives strictly more of the same room than a duller one", () => {
  const keen = interiorityLines(cabinet("a", 9), "a", VIEW, 1, 100);
  const dull = interiorityLines(cabinet("b", 0), "b", VIEW, 1, 100);
  // Perception's tell is difficulty 7: a level-9 mind always catches it; a level-0 mind never can.
  assert.ok(keen.some((w) => w.faculty === "perception"), "the keen mind notices the hidden thing");
  assert.ok(!dull.some((w) => w.faculty === "perception"), "the dull mind walks past it — the world is restricted to its senses");
  assert.ok(keen.length > dull.length, "more faculty, more world");
});

test("faculties are lenses onto the live simulation — Shivers reads the sky, Half Light the threat", () => {
  const lines = interiorityLines(cabinet("a", 9), "a", VIEW, 1, 100);
  assert.ok(lines.some((w) => w.faculty === "shivers" && /fog/.test(w.line)), "Shivers voices the weather the climate settled");
  assert.ok(lines.some((w) => w.faculty === "half-light" && /Dax Pell/.test(w.line)), "Half Light reads the armed NPC's stance");
  assert.ok(lines.some((w) => w.faculty === "inland-empire"), "Inland Empire feels the fog and the contradiction");
});

test("INVARIANT replay-is-exact: the same mind, world, and clock surface identical whispers", () => {
  assert.deepEqual(interiorityLines(cabinet("a", 4), "a", VIEW, 7, 250), interiorityLines(cabinet("a", 4), "a", VIEW, 7, 250));
  // The check is a seeded white check, not Math.random.
  assert.equal(senses(3, 5, 0.99), true);
  assert.equal(senses(0, 7, 0.0), false);
});

test("two characters are dealt different cabinets by the seed — different minds, reproducibly", () => {
  const a = cabinetSeed(1, "brannaugh");
  const b = cabinetSeed(1, "coilin");
  assert.notDeepEqual(a.map((f) => f.v), b.map((f) => f.v), "name-distributed cabinets differ");
  assert.deepEqual(cabinetSeed(1, "brannaugh").map((f) => f.v), a.map((f) => f.v), "same seed + name re-deals the same mind");
});

test("the Cabinet listens in: faculties read an NPC beneath the words of a conversation", () => {
  const view: DialogueView = { name: "Greer Tenn", mood: "weary", topNeed: "hunger", wants: "edible", contestedBelief: true };
  const keen = dialogueLines(cabinet("a", 9), "a", view, 1, 100);
  assert.ok(keen.some((w) => w.faculty === "empathy" && /weary/.test(w.line)), "Empathy reads the true mood");
  assert.ok(keen.some((w) => w.faculty === "logic" && /bargain/.test(w.line)), "Logic reads the unspoken demand (the Director's want)");
  assert.ok(keen.some((w) => w.faculty === "inland-empire"), "Inland Empire feels the held contradiction");
  // A dull mind, talking to a content NPC with nothing held, hears only the words.
  assert.deepEqual(dialogueLines(cabinet("b", 0), "b", { name: "x", mood: "content", topNeed: null, wants: null, contestedBelief: false }, 1, 100), []);
});

test("the cabinet is dealt on join and read back by `mind`", () => {
  const bible: Bible = { rooms: [{ id: "quay", name: "Quay", description: "Tar and granite.", tags: ["place", "harbor", "outdoor"] }] };
  const { world: w, content } = loadBible(bible);
  const s = new FizzosScene(tell(w, [{ e: "the-world", a: "world-seed", v: "3" }]), content, "quay");
  s.join("skipper", "quay");
  const { events } = s.runTick(1, [{ k: "command", actor: "skipper", line: "mind" } satisfies CommandIntent]);
  const text = events.filter((e) => e.k === "message" && e.to === "skipper").map((e) => (e as { text: string }).text).join("\n");
  assert.match(text, /Your cabinet/, "`mind` reports the faculties");
  assert.match(cabinetReport(s.currentWorld(), "skipper"), /Shivers/);
});
