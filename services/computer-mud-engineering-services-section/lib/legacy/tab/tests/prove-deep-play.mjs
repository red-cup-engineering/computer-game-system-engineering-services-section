// prove-deep-play — the DEEP player surface: the Discworld-grade systems reached through the same
// makeSession a server drives. Drives wield/wear/tactics (arsenal) → score; buy from a shop
// (market); craft a recipe (recipes); a social (souls) → an emote entity; consider a foe
// (proficiency+health); and asserts the world actually moved. Harness mirrors prove-play-surface.
//
// Standalone: `node tests/prove-deep-play.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, containedBy } from "#substrate";
import { combatProfile } from "#arsenal";
import { coinOf } from "#market";
import { makeSession } from "../scripts/play.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-deep-"));
const world = join(tmp, "w");

let s = 0;
const set = (e, a, v) => doing({ root: world, subject: e, predicate: a, object: v, t: `seed:${String(++s).padStart(6, "0")}` });

try {
  // The hall: the player (with stats, coin, a smithing skill), a sword + breastplate to don, raw
  // iron + a hammer to forge with, a meat pie for sale, and an NPC to size up and salute.
  await set("hall", "naming", "The Forge Hall");
  await set("you", "kind", "player"); await set("you", "naming", "You"); await set("you", "mover", "session"); await set("you", "located-in", "hall");
  await set("you", "attr:str", 14); await set("you", "coin", 500);
  for (let i = 0; i < 3; i += 1) await set("you", "skill:crafting.smithing.black", "crafting.smithing.black");
  await set("a-sword", "kind", "item"); await set("a-sword", "naming", "an iron sword");
  await set("a-sword", "weapon-damage", 8); await set("a-sword", "weapon-skill", "fighting.melee.sword"); await set("a-sword", "weight", 3);
  await set("a-sword", "located-in", "you");
  await set("a-plate", "kind", "item"); await set("a-plate", "naming", "a steel breastplate");
  await set("a-plate", "armor-protection", 5); await set("a-plate", "armor-covers", "torso"); await set("a-plate", "located-in", "you");
  await set("iron-1", "material", "iron"); await set("iron-1", "quality", 6); await set("iron-1", "naming", "an iron bar"); await set("iron-1", "located-in", "you");
  await set("a-hammer", "tool", "hammer"); await set("a-hammer", "quality", 5); await set("a-hammer", "naming", "a smith's hammer"); await set("a-hammer", "located-in", "you");
  await set("a-pie", "kind", "item"); await set("a-pie", "naming", "a meat pie"); await set("a-pie", "price", 30); await set("a-pie", "located-in", "hall");
  await set("ada", "kind", "npc"); await set("ada", "naming", "Ada"); await set("ada", "mover", "tick"); await set("ada", "located-in", "hall");

  const ses = makeSession({ root: world, actor: "you" });

  await ok("wield sets the weapon; combatProfile + score reflect it", async () => {
    assert.match(await ses.handle("wield sword"), /You wield an iron sword/);
    const prof = await combatProfile(world, "you");
    assert.equal(prof.weapon.id, "a-sword");
    assert.equal(prof.weapon.damage, 8);
    assert.match(await ses.handle("score"), /wielding an iron sword/);
  });

  await ok("wear straps armour onto the covered part", async () => {
    assert.match(await ses.handle("wear breastplate"), /onto your torso/);
    const prof = await combatProfile(world, "you");
    assert.equal(prof.armorByPart.torso, 5);
  });

  await ok("tactics sets your stance", async () => {
    assert.match(await ses.handle("tactics offensive"), /offensive stance/);
    const prof = await combatProfile(world, "you");
    assert.equal(prof.tactics.attack, "offensive");
  });

  await ok("score shows stats, purse and burden", async () => {
    const out = await ses.handle("score");
    assert.ok(/stats:\s+str 14/.test(out), "stats line with str 14");
    assert.ok(/purse:\s+\$5\.00p/.test(out), "purse shows $5.00p");
    assert.ok(/carrying \d+\/\d+/.test(out), "burden / capacity");
  });

  await ok("buy moves a priced ware and debits the purse (market)", async () => {
    assert.match(await ses.handle("wares"), /meat pie — 30p/);
    assert.match(await ses.handle("buy pie"), /You buy a meat pie for 30p/);
    assert.ok((await containedBy(world, "you")).includes("a-pie"), "the pie is now carried");
    assert.equal(await coinOf(world, "you"), 470, "purse debited by 30");
  });

  await ok("craft consumes materials and mints a quality output (recipes)", async () => {
    const out = await ses.handle("craft nail");
    assert.match(out, /craft an iron nail \(quality \d+\)/);
    assert.ok(!(await containedBy(world, "you")).includes("iron-1"), "the iron bar was consumed");
    const made = (await containedBy(world, "you")).find((id) => id.startsWith("made:"));
    const item = await settle(world, made);
    assert.ok(item.fiber.some((c) => c.predicate === "quality"), "the output carries a quality cell");
  });

  await ok("a social emits a perceivable emote and reads first-person", async () => {
    assert.match(await ses.handle("smile"), /You smile\./);
    assert.match(await ses.handle("wave ada"), /You wave at Ada\.|You wave\./);
    const here = await containedBy(world, "hall");
    assert.ok(here.some((id) => id.startsWith("emote:")), "an emote entity is in the room");
  });

  await ok("a freeform emote files an ambient emote with my name", async () => {
    assert.match(await ses.handle("emote hefts the hammer thoughtfully"), /You hefts the hammer|hefts the hammer/);
    const here = await containedBy(world, "hall");
    const emotes = [];
    for (const id of here) if (id.startsWith("emote:")) emotes.push(await settle(world, id));
    assert.ok(emotes.some((e) => e.fiber.some((c) => c.predicate === "emote-text" && /hefts the hammer/.test(String(c.object)))), "freeform text present");
  });

  await ok("consider sizes up a foe", async () => {
    const out = await ses.handle("consider ada");
    assert.match(out, /Ada (would|looks|is)/);
  });

  await ok("skills lists the tree with derived bonuses", async () => {
    const out = await ses.handle("skills");
    assert.match(out, /\+\d+ crafting\.smithing\.black/);
  });

  console.log(`\n${pass} deep-play checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
