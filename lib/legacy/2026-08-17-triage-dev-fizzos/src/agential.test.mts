/**
 * Agential realism: every entity is a fiber, so every entity has a regardable interiority — and
 * the agential cut is *enacted by the observer* (you read another only as far as your faculties
 * reach). These name it: NPCs carry cabinets too; a thing "remembers" what it has touched; and a
 * keener mind reads more of the same inner life than a duller one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, tell } from "./world.mjs";
import { FACULTIES, type RegardView, facultyLevel, regardLines } from "./interiority.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

const observer = (id: string, level: number) => world(FACULTIES.map((f) => ({ e: id, a: `faculty:${f.key}`, v: String(level) })));

const GREER: RegardView = {
  name: "Greer Tenn", kind: "npc", mood: "weary", topNeed: "hunger",
  beliefs: ["the dredging permit"], entanglements: ["held", "fought"], keenFaculty: "Perception",
};

test("INVARIANT the agential cut is enacted: a keener observer reads more of the same inner life", () => {
  const keen = regardLines(observer("a", 9), "a", GREER, 1, 100);
  const dull = regardLines(observer("b", 0), "b", GREER, 1, 100);
  assert.ok(keen.length > dull.length, "more faculty, more of the other's interiority is legible");
  assert.ok(keen.some((w) => w.faculty === "empathy" && /watchfulness/.test(w.line)), "the keen observer feels the NPC reading THEM back — mutual interiority");
});

test("things have interiority too: a blade is marked by what it has touched (intra-action residue)", () => {
  const knife: RegardView = { name: "a gutting knife", kind: "item", mood: null, topNeed: null, beliefs: [], entanglements: ["fought"], keenFaculty: null };
  const lines = regardLines(observer("a", 9), "a", knife, 1, 100);
  assert.ok(lines.some((w) => /remembers violence|residue of fought/.test(w.line)), "the knife remembers the killing — agential realism for objects");
});

test("every NPC is dealt a cabinet at load — the world is full of minds, not props", () => {
  const bible: Bible = {
    rooms: [{ id: "quay", name: "Quay", description: "Granite.", tags: ["place", "harbor", "outdoor"] }],
    npcs: [{ id: "greer", name: "Greer Tenn", description: "A fishwife.", location: "quay", tags: ["npc"] }],
  };
  const { world: w, content } = loadBible(bible);
  const s = new FizzosScene(tell(w, [{ e: "the-world", a: "world-seed", v: "5" }]), content, "quay");
  const total = FACULTIES.reduce((n, f) => n + facultyLevel(s.currentWorld(), "greer", f.key), 0);
  assert.ok(total > 0, "Greer perceives the world through faculties of her own");
});

test("`regard` reads an entity's interiority through the scene, and keens the observer's senses", () => {
  const bible: Bible = {
    rooms: [{ id: "quay", name: "Quay", description: "Granite.", tags: ["place", "harbor", "outdoor"] }],
    npcs: [{ id: "greer", name: "Greer Tenn", description: "A fishwife.", location: "quay", tags: ["npc"] }],
  };
  const { world: w, content } = loadBible(bible);
  const seed = [
    { e: "greer", a: "mood", v: "weary" }, { e: "greer", a: "belief:permit", v: "stable" },
    { e: "seer", a: "faculty:empathy", v: "9" }, { e: "seer", a: "faculty:logic", v: "9" }, { e: "seer", a: "faculty:inland-empire", v: "9" },
    { e: "seer", a: "health", v: "20" }, { e: "seer", a: "max-health", v: "20" }, { e: "seer", a: "condition", v: "alive" },
  ];
  const s = new FizzosScene(tell(w, seed), content, "quay");
  s.join("seer", "quay");
  const before = facultyLevel(s.currentWorld(), "seer", "empathy");
  const { events } = s.runTick(1, [{ k: "command", actor: "seer", line: "regard greer" } satisfies CommandIntent]);
  const text = events.filter((e) => e.k === "message" && e.to === "seer").map((e) => (e as { text: string }).text).join("\n");
  assert.match(text, /attend closely to Greer Tenn/, "the regard reads her interiority");
  assert.match(text, /weary/, "her mood is legible to a keen empath");
  assert.ok(facultyLevel(s.currentWorld(), "seer", "empathy") > before, "regarding another keens your own senses");
});
