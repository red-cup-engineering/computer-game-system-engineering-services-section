/**
 * Food preservation (survival): the built smokehouse *matters* — it cures fresh fish into smoked
 * fish that keeps through the lean season and trades dearer. Construction → survival → economy.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tell, valueOf } from "./world.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

test("you can only cure at a smokehouse/forge", () => {
  const bible: Bible = {
    rooms: [{ id: "shore", name: "Shore", description: "Open.", tags: ["place", "outdoor"] }],
    items: [{ id: "f1", name: "a fresh fish", description: "Silver.", location: "cook", tags: ["item", "takeable", "fish", "edible", "nutrition:3"] }],
  };
  const { world, content } = loadBible(bible);
  const s = new FizzosScene(world, content, "shore");
  s.join("cook", "shore");
  const { events } = s.runTick(1, [{ k: "command", actor: "cook", line: "cure" } satisfies CommandIntent]);
  const reply = events.filter((e) => e.k === "message" && e.to === "cook").map((e) => (e as { text: string }).text).join("\n");
  assert.match(reply, /need a smokehouse/, "no smokehouse, no curing");
});

test("WEAVE construction→survival→economy: a smokehouse cures fresh fish into preserved smoked fish", () => {
  const bible: Bible = {
    rooms: [{ id: "smokehouse", name: "a smokehouse", description: "Racks over a slow fire.", tags: ["place", "indoor", "built", "smokehouse"] }],
    items: [{ id: "f1", name: "a fresh fish", description: "Silver.", location: "cook", tags: ["item", "takeable", "fish", "edible", "nutrition:3"] }],
  };
  const { world, content } = loadBible(bible);
  const s = new FizzosScene(world, content, "smokehouse");
  s.join("cook", "smokehouse");
  s.runTick(1, [{ k: "command", actor: "cook", line: "cure" } satisfies CommandIntent]);

  assert.equal(valueOf(s.currentWorld(), "f1", "located-in"), "nothing", "the fresh fish was consumed");
  // A smoked fish now sits in the cook's hands — preserved, more nourishing, more valuable.
  const things = content.things as Record<string, { tags: readonly string[] }>;
  const cured = Object.keys(things).find((id) => id.startsWith("cured-"));
  assert.ok(cured !== undefined, "a smoked fish was produced");
  assert.equal(valueOf(s.currentWorld(), cured!, "located-in"), "cook", "and it's in the cook's hands");
  assert.ok(things[cured!]!.tags.includes("preserved"), "it keeps");
  assert.ok(things[cured!]!.tags.includes("nutrition:6"), "it nourishes more than a fresh fish (3)");
});
