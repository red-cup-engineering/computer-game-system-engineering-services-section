// prove-deep-play2 — the SECOND deep wave through the player surface: magic, faith, stealth, locks,
// guilds, quests, and medicine, all driven through the same makeSession a server runs, asserting
// each verb actually moved the world. Harness mirrors prove-deep-play.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, containedBy } from "#substrate";
import { healthOf, injure } from "#health";
import conditionsOf from "#conditions";
import { isHidden, isLocked } from "#covert";
import { manaOf } from "#magic";
import { makeSession } from "../scripts/play.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-deep2-"));
const world = join(tmp, "w");
let s = 0;
const set = (e, a, v) => doing({ root: world, subject: e, predicate: a, object: v, t: `seed:${String(++s).padStart(6, "0")}` });
const teach = async (id, path, n) => { for (let i = 0; i < n; i += 1) await set(id, `skill:${path}`, path); };

try {
  await set("hall", "naming", "The Lodge");
  // The player: a dabbler in every art (stats + a spread of taught skills + a lockpick + coin).
  await set("you", "kind", "player"); await set("you", "naming", "You"); await set("you", "mover", "session"); await set("you", "located-in", "hall");
  await set("you", "attr:int", 14); await set("you", "attr:dex", 13); await set("you", "coin", 100);
  await teach("you", "magic.evocation", 3);
  await teach("you", "covert.theft", 4); await teach("you", "covert.locks", 4); await teach("you", "covert.stealth", 3);
  await teach("you", "people.healing", 4);
  await set("a-lockpick", "kind", "item"); await set("a-lockpick", "naming", "a set of picks"); await set("a-lockpick", "tool", "lockpick"); await set("a-lockpick", "located-in", "you");
  // The cast: a target to spell, a victim to rob, a patient to mend, a quest-giver, a locked chest.
  await set("bo", "kind", "npc"); await set("bo", "naming", "Bo"); await set("bo", "mover", "tick"); await set("bo", "located-in", "hall");
  await set("vic", "kind", "npc"); await set("vic", "naming", "Vic"); await set("vic", "mover", "tick"); await set("vic", "located-in", "hall");
  await set("a-trinket", "kind", "item"); await set("a-trinket", "naming", "a silver locket"); await set("a-trinket", "located-in", "vic");
  await set("patient", "kind", "npc"); await set("patient", "naming", "Wenna"); await set("patient", "mover", "tick"); await set("patient", "located-in", "hall");
  await injure({ root: world, subject: "patient", part: "arm", severity: 5, t: "seed:900001" });
  await set("old-pell", "kind", "npc"); await set("old-pell", "naming", "Old Pell"); await set("old-pell", "mover", "tick"); await set("old-pell", "located-in", "hall");
  await set("a-chest", "kind", "item"); await set("a-chest", "naming", "an oak chest"); await set("a-chest", "locked", 15); await set("a-chest", "located-in", "hall");

  const ses = makeSession({ root: world, actor: "you" });

  await ok("magic: learn then cast a spell that wounds a target and spends mana", async () => {
    assert.match(await ses.handle("learn spark"), /learn spark/);
    const before = await manaOf(world, "you");
    const out = await ses.handle("cast spark bo");
    assert.match(out, /You cast spark on Bo/);
    assert.ok((await healthOf(world, "bo")).injuries.length >= 1, "Bo is wounded by the spell");
    assert.ok((await manaOf(world, "you")) < before, "mana was spent");
  });

  await ok("faith: worship, pray, and invoke a blessing on yourself", async () => {
    assert.match(await ses.handle("worship Maraset"), /bow your head to Maraset/);
    assert.match(await ses.handle("pray"), /piety \d+/);
    assert.match(await ses.handle("invoke benediction"), /You invoke benediction/);
    assert.ok((await conditionsOf(world, "you")).some((c) => c.name === "blessed"), "you are blessed");
  });

  await ok("covert: hide conceals you; pick opens a locked chest", async () => {
    assert.match(await ses.handle("hide"), /concealment \d+/);
    assert.equal(await isHidden(world, "you"), true);
    assert.equal(await isLocked(world, "a-chest"), true);
    assert.match(await ses.handle("pick chest"), /clicks open/);
    assert.equal(await isLocked(world, "a-chest"), false);
  });

  await ok("covert: steal lifts an item from a victim", async () => {
    assert.match(await ses.handle("steal locket vic"), /lift a silver locket from Vic/);
    assert.ok((await containedBy(world, "you")).includes("a-trinket"), "you now hold the locket");
    assert.ok(!(await containedBy(world, "vic")).includes("a-trinket"), "Vic no longer holds it");
  });

  await ok("guilds: join the watch and hold its novice title", async () => {
    assert.match(await ses.handle("join watch"), /admitted to the watch/);
    assert.match(await ses.handle("title"), /Recruit/);
  });

  await ok("quests: accept an offered quest; it enters your journal", async () => {
    const quests = await ses.handle("quests");
    assert.match(quests, /reach-the-lighthouse/);
    assert.match(await ses.handle("accept reach-the-lighthouse"), /You accept/);
    assert.match(await ses.handle("quests"), /reach-the-lighthouse\] accepted/);
  });

  await ok("medicine: treat a patient's wound and diagnose", async () => {
    const before = (await healthOf(world, "patient")).injuries.find((i) => i.part === "arm").severity;
    const out = await ses.handle("treat patient arm");
    assert.match(out, /tend Wenna's arm/);
    const after = (await healthOf(world, "patient")).injuries.find((i) => i.part === "arm");
    assert.ok(!after || after.severity < before, "the arm wound is reduced");
    assert.match(await ses.handle("diagnose patient"), /arm|unhurt/);
  });

  await ok("score surfaces the new callings (mana, devotion, title)", async () => {
    const out = await ses.handle("score");
    assert.ok(/calling:/.test(out), "a calling line appears");
    assert.ok(/mana \d+/.test(out) && /Maraset/.test(out) && /watch/.test(out), "mana + god + guild shown");
  });

  console.log(`\n${pass} deep-play2 checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
