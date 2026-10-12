// prove-souls — SOULS: the MUD "soul", socials/emotes as intra-actions. A social is not a message
// sent down a wire; it is an AMBIENT EMOTE entity (attributed to no agent) the room contains, so
// co-located actors perceive it with zero query and zero routing — the body-language sibling of
// saying. Builds a tiny world by hand in a UNIQUE /tmp dir (no Farstone, no examples), drives the
// soul morphism directly, and asserts the properties: an emote is an ambient entity the room
// contains; co-located actors are in heardBy and the actor is not; the third-person sentence is
// rendered with display names; targeting reifies emote-target; the emote id is content-addressed
// (replay-deterministic); the table has >= 120 socials; hasSoul / listSouls / resolve behave.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-souls.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, containedBy } from "#substrate";
import { holds } from "#value";

import soul, { SOULS, listSouls, hasSoul, resolve } from "../being/doing/saying/library/souls/scripts/soul.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-souls-"));
const world = join(tmp, "w");

// place an actor (with a display name) into a room. functional located-in dual-files at the room.
const place = async (who, naming, room, t) => {
  await doing({ root: world, subject: who, predicate: "kind", object: "player", t: `${t}a` });
  await doing({ root: world, subject: who, predicate: "naming", object: naming, t: `${t}b` });
  await doing({ root: world, subject: who, predicate: "located-in", object: room, t: `${t}c` });
};

const cellOf = (thing, p) => thing.fiber.find((c) => c.predicate === p && holds(c.value))?.object;

try {
  // 'you' is named Bob; 'ada' is named Ada. Both stand in the-square; 'eve' stands in the-alley.
  await place("you", "Bob", "the-square", "seed:000001");
  await place("ada", "Ada", "the-square", "seed:000002");
  await place("eve", "Eve", "the-alley", "seed:000003");

  // --- pure table: catalogue, membership, placeholder substitution -----------------------------
  await ok("the soul table carries at least 120 socials", async () => {
    assert.ok(listSouls().length >= 120, `expected >= 120 socials, got ${listSouls().length}`);
    assert.ok(Array.isArray(listSouls()) && listSouls().every((n) => typeof n === "string"));
    // listSouls is sorted.
    const names = listSouls();
    assert.deepEqual(names, [...names].sort(), "listSouls must be sorted");
  });

  await ok("hasSoul: true for a known social, false for a nonsense one", async () => {
    assert.equal(hasSoul("smile"), true);
    assert.equal(hasSoul("poke"), true);
    assert.equal(hasSoul("xyzzy"), false);
  });

  await ok("resolve substitutes {me} and {them} placeholders (pure, no world)", async () => {
    const u = resolve("smile", "Bob");
    assert.equal(u.self, "You smile.");
    assert.equal(u.others, "Bob smiles.");
    // targeted use of an untargeted social uses its targeted templates.
    const tg = resolve("smile", "Bob", "Ada");
    assert.equal(tg.others, "Bob smiles at Ada.");
    // a targeted-only social renders only with a target.
    const p = resolve("poke", "Bob", "Ada");
    assert.equal(p.self, "You poke Ada.");
    assert.equal(p.others, "Bob pokes Ada.");
    assert.throws(() => resolve("poke", "Bob"), /requires a target/);
    assert.throws(() => resolve("zzznope", "Bob"), /unknown social/);
  });

  // --- soul (untargeted): an ambient emote the room contains; the frontier perceives it --------
  await ok("soul files an ambient emote entity the room contains", async () => {
    const { emote, self, others } = await soul({ root: world, actor: "you", name: "smile", t: "tick:1/soul:1" });
    const here = await containedBy(world, "the-square");
    assert.ok(here.includes(emote), "the emote entity should be located-in the room");
    assert.ok(emote.startsWith("emote:"), "emote ids carry the emote: prefix");
    const e = await settle(world, emote);
    assert.equal(cellOf(e, "kind"), "emote");
    assert.equal(cellOf(e, "emoting-by"), "you");
    assert.ok(cellOf(e, "emote-text").includes("Bob smiles"), `emote-text was "${cellOf(e, "emote-text")}"`);
    assert.equal(cellOf(e, "located-in"), "the-square");
    assert.equal(cellOf(e, "emote-target"), undefined, "an untargeted emote has no emote-target");
    assert.equal(self, "You smile.");
    assert.equal(others, "Bob smiles.");
  });

  await ok("heardBy includes a co-located actor, excludes a non-co-located one and the actor", async () => {
    const { heardBy } = await soul({ root: world, actor: "you", name: "wave", t: "tick:1/soul:2" });
    assert.ok(heardBy.includes("ada"), "ada shares the square — should perceive the emote");
    assert.ok(!heardBy.includes("eve"), "eve is in the alley — should NOT perceive it");
    assert.ok(!heardBy.includes("you"), "the actor does not perceive their own emote in heardBy");
  });

  // --- soul (targeted): emote-target reified, name resolved from the world ----------------------
  await ok("a targeted soul reifies emote-target and renders the target's display name", async () => {
    const { emote, self, others } = await soul({ root: world, actor: "you", name: "poke", target: "ada", t: "tick:2/soul:1" });
    const e = await settle(world, emote);
    assert.equal(cellOf(e, "emote-target"), "ada");
    assert.ok(cellOf(e, "emote-text").includes("Bob pokes Ada"), `emote-text was "${cellOf(e, "emote-text")}"`);
    assert.equal(self, "You poke Ada.");
    assert.equal(others, "Bob pokes Ada.");
  });

  // --- replay determinism: same act → same content-addressed emote id --------------------------
  await ok("the emote is replay-deterministic (content-addressed id)", async () => {
    const a = await soul({ root: world, actor: "you", name: "bow", target: "ada", t: "tick:9/soul:1" });
    const b = await soul({ root: world, actor: "you", name: "bow", target: "ada", t: "tick:9/soul:1" });
    assert.equal(a.emote, b.emote, "identical social at identical tick → identical id");
    // a different social, target, or tick must mint a different id.
    const c = await soul({ root: world, actor: "you", name: "bow", target: null, t: "tick:9/soul:1" });
    assert.notEqual(a.emote, c.emote, "targeted vs untargeted mint different ids");
    const d = await soul({ root: world, actor: "you", name: "wave", target: "ada", t: "tick:9/soul:1" });
    assert.notEqual(a.emote, d.emote, "a different social mints a different id");
  });

  // --- errors -----------------------------------------------------------------------------------
  await ok("soul throws on an unknown social and on an actor with no room", async () => {
    await assert.rejects(soul({ root: world, actor: "you", name: "xyzzy", t: "tick:3/soul:1" }), /unknown social/);
    // 'ghost' has no located-in row, so it has no room to emote into.
    await doing({ root: world, subject: "ghost", predicate: "naming", object: "Ghost", t: "seed:000009" });
    await assert.rejects(soul({ root: world, actor: "ghost", name: "smile", t: "tick:3/soul:2" }), /nowhere/);
  });

  // --- opts override: name without a world lookup -----------------------------------------------
  await ok("opts.actorName / opts.targetName override the world's naming", async () => {
    const { others } = await soul({ root: world, actor: "you", name: "poke", target: "ada", t: "tick:4/soul:1", opts: { actorName: "Robert", targetName: "Adelaide" } });
    assert.equal(others, "Robert pokes Adelaide.");
  });

  // --- table shape: every entry is renderable ---------------------------------------------------
  await ok("every soul in the table renders without throwing (targeted and untargeted)", async () => {
    for (const name of listSouls()) {
      const s = SOULS[name];
      if (!s.targeted) resolve(name, "Me");      // untargeted form exists
      resolve(name, "Me", "Them");                // targeted form always renders
    }
  });

  console.log(`\n${pass} soul checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
