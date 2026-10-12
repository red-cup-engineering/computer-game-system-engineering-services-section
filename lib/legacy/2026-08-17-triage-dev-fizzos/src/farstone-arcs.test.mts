/**
 * The dredging-permit arc: a contested situation the world holds open until the player resolves it,
 * with an irreversible consequence. These name the choice→consequence invariants — granting the
 * dredge fouls the clam bed; denying spares it; either way a fisher sours; and you must be at the
 * civic office to file.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { tell, valueOf, numberOf } from "./world.mjs";
import { type Bible, loadBible } from "./world-load.mjs";
import { FizzosScene, type CommandIntent } from "./scene.mjs";

const ISLAND: Bible = {
  rooms: [
    { id: "downtown", name: "Downtown", description: "The civic blocks.", exits: { south: "marsh" }, tags: ["place", "town", "civic", "outdoor"] },
    { id: "marsh", name: "The Salt Marsh", description: "Spartina and the clam bed.", exits: { north: "downtown" }, tags: ["place", "marsh", "outdoor", "shellfish"] },
  ],
  npcs: [
    { id: "coilin-vey", name: "Coilin Vey", description: "Wants the dredge.", location: "downtown", tags: ["npc", "faction:fishers"] },
    { id: "brannaugh-ross", name: "Brannaugh Ross", description: "Works the clam bed.", location: "marsh", tags: ["npc", "faction:fishers"] },
  ],
};

const file = (line: string, where: string) => {
  const { world, content } = loadBible(ISLAND);
  const s = new FizzosScene(tell(world, [{ e: "the-dredging-permit", a: "decision-status", v: "contested" }]), content, where);
  s.join("citizen", where);
  s.runTick(1, []); // let onLoad/systems settle (won't re-seed: status already set)
  const { events } = s.runTick(2, [{ k: "command", actor: "citizen", line } satisfies CommandIntent]);
  const text = events.filter((e) => e.k === "message" && e.to === "citizen").map((e) => (e as { text: string }).text).join("\n");
  return { s, text };
};

test("you can only petition at the civic office", () => {
  const { s, text } = file("petition brannaugh", "marsh");
  assert.match(text, /records clerk's office/, "filing from the marsh is refused");
  assert.equal(valueOf(s.currentWorld(), "the-dredging-permit", "decision-status"), "contested", "the permit stays held");
});

test("WEAVE deny: petitioning for Brannaugh spares the clam bed and sours Coilin", () => {
  const { s, text } = file("petition brannaugh", "downtown");
  assert.match(text, /clam bed is spared/);
  assert.equal(valueOf(s.currentWorld(), "the-dredging-permit", "decision-status"), "denied", "the world holds to the choice");
  assert.equal(valueOf(s.currentWorld(), "marsh", "shellfish-closed"), null, "the bed is not fouled");
  assert.equal(valueOf(s.currentWorld(), "coilin-vey", "embittered"), "true", "the loser bears a lasting grievance — it will inflame the feud");
});

test("WEAVE grant: petitioning for Coilin cuts the channel and fouls the clam bed forever", () => {
  const { s, text } = file("petition coilin", "downtown");
  assert.match(text, /silt will choke the marsh clam bed/);
  assert.equal(valueOf(s.currentWorld(), "the-dredging-permit", "decision-status"), "granted");
  assert.equal(valueOf(s.currentWorld(), "marsh", "shellfish-closed"), "true", "the dredge fouled the bed — a lasting ecological wound");
  assert.ok(numberOf(s.currentWorld(), "marsh", "pollution", 0) >= 8, "silt loads the marsh");
  assert.equal(valueOf(s.currentWorld(), "brannaugh-ross", "embittered"), "true", "Brannaugh bears the grievance");
});

test("WEAVE governance: Hydrant-23 is a contested ⊤ under a precautionary advisory until re-inspected", () => {
  const bible: Bible = { rooms: [{ id: "downtown", name: "Downtown", description: "Civic.", tags: ["place", "town", "civic", "outdoor"] }] };
  const { world, content } = loadBible(bible);
  const s = new FizzosScene(tell(world, [{ e: "the-world", a: "world-seed", v: "5" }, { e: "hydrant-23", a: "water-quality", v: "contested" }, { e: "hydrant-23", a: "advisory", v: "boil-water" }]), content, "downtown");
  s.join("clerk", "downtown");
  const { events } = s.runTick(1, [{ k: "command", actor: "clerk", line: "audit hydrant-23" } satisfies CommandIntent]);
  const reply = events.filter((e) => e.k === "message" && e.to === "clerk").map((e) => (e as { text: string }).text).join("\n");
  assert.match(reply, /re-inspection/, "the clerk dispatches a re-inspection");
  const settled = valueOf(s.currentWorld(), "hydrant-23", "water-quality");
  assert.ok(settled === "pass" || settled === "fail", "the ⊤ resolves to a definite status (seeded, replay-exact)");
  // The advisory follows the result, and the dispute is no longer re-inspectable.
  const advisory = valueOf(s.currentWorld(), "hydrant-23", "advisory");
  assert.equal(advisory, settled === "pass" ? "clear" : "boil-water", "the advisory tracks the resolution");
  const { events: e2 } = s.runTick(2, [{ k: "command", actor: "clerk", line: "audit hydrant-23" } satisfies CommandIntent]);
  assert.match(e2.filter((e) => e.k === "message").map((e) => (e as { text: string }).text).join("\n"), /settled/, "a resolved hydrant needs no re-inspection");
});

test("you can only dispatch a re-inspection from the civic office", () => {
  const bible: Bible = { rooms: [{ id: "marsh", name: "Marsh", description: "Off the map.", tags: ["place", "marsh", "outdoor"] }] };
  const { world, content } = loadBible(bible);
  const s = new FizzosScene(tell(world, [{ e: "hydrant-23", a: "water-quality", v: "contested" }]), content, "marsh");
  s.join("clerk", "marsh");
  const { events } = s.runTick(1, [{ k: "command", actor: "clerk", line: "audit hydrant-23" } satisfies CommandIntent]);
  assert.match(events.filter((e) => e.k === "message").map((e) => (e as { text: string }).text).join("\n"), /records clerk's office/);
});

test("once settled, the dispute stays settled — the world holds to it", () => {
  const { s } = file("petition coilin", "downtown");
  const { events } = s.runTick(3, [{ k: "command", actor: "citizen", line: "petition brannaugh" } satisfies CommandIntent]);
  const text = events.filter((e) => e.k === "message" && e.to === "citizen").map((e) => (e as { text: string }).text).join("\n");
  assert.match(text, /already settled \(granted\)/, "you cannot re-litigate a decided permit");
});
