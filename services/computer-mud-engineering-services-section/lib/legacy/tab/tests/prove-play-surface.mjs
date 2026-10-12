// prove-play-surface — the RICH PLAYER COMMAND SURFACE (the living server, player half). A player
// and an npc DO the same things through the same morphisms; this drives the player's `makeSession`
// (the headless core serve.mjs/play.mjs share) through the bread-and-butter MUD verbs and asserts
// each one actually moved the world the way the npc tick would: speech becomes an utterance; a give
// relocates an item; eating spends a resource and restores a need; attack lands a wound; practice
// files a skill; mail lands in a mailbox. Same tiny harness as prove-comms.mjs.
//
// Standalone: `node tests/prove-play-surface.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, containedBy } from "#substrate";
import { needsOf } from "#needing";
import { healthOf } from "#health";
import mail, { mbox } from "#mailing";
import { makeSession } from "../scripts/play.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-play-"));
const world = join(tmp, "w");

// seed helpers — file rows directly (pre-tick `seed:` stamps sort before any tick row).
let s = 0;
const seed = () => `seed:${String(++s).padStart(6, "0")}`;
const set = (subject, predicate, object) => doing({ root: world, subject, predicate, object, t: seed() });
async function actor(id, name, room, mover, needs = {}) {
  await set(id, "kind", mover === "session" ? "player" : "npc");
  await set(id, "naming", name);
  await set(id, "mover", mover);
  await set(id, "located-in", room);
  for (const [n, v] of Object.entries(needs)) await set(id, `need:${n}`, v);
}

try {
  // A two-room world: the hall (player + Bob + a coin + a loaf) and the yard to its north.
  await set("hall", "naming", "The Hall");
  await set("hall", "describing", "a long stone hall");
  await set("hall", "exit-north", "yard");
  await set("yard", "naming", "The Yard");
  await actor("you", "You", "hall", "session", { hunger: 40, rest: 70, recreation: 70 });
  await set("you", "skill:combat", 70);                 // numeric skill so a blow can land
  await actor("bob", "Bob", "hall", "tick", { hunger: 60, rest: 60, recreation: 60 });
  await set("a-coin", "kind", "item");
  await set("a-coin", "naming", "a brass coin");
  await set("a-coin", "located-in", "hall");
  await set("a-loaf", "kind", "resource");
  await set("a-loaf", "naming", "a barley loaf");
  await set("a-loaf", "provides", "need:hunger");
  await set("a-loaf", "amount", 3);
  await set("a-loaf", "located-in", "hall");

  const ses = makeSession({ root: world, actor: "you" });

  await ok("look shows the room, Bob, and the exit", async () => {
    const out = await ses.handle("look");
    assert.ok(out.includes("The Hall"), "room name");
    assert.ok(out.includes("Bob"), "Bob is also here");
    assert.ok(/north/.test(out), "the north exit is shown");
  });

  await ok("say emits an utterance the room contains, spoken-by you", async () => {
    const out = await ses.handle("say hello there");
    assert.match(out, /You say, "hello there"/);
    const here = await containedBy(world, "hall");
    const utt = here.find((id) => id.startsWith("utt:"));
    assert.ok(utt, "an utterance entity is now in the hall");
    const u = await settle(world, utt);
    assert.equal(u.fiber.find((c) => c.predicate === "spoken-by")?.object, "you");
    assert.equal(u.fiber.find((c) => c.predicate === "saying")?.object, "hello there");
  });

  await ok("tell directs an utterance to the listener (located-in Bob)", async () => {
    const out = await ses.handle("tell bob meet me at dusk");
    assert.match(out, /You tell Bob, "meet me at dusk"/);
    const onBob = await containedBy(world, "bob");
    assert.ok(onBob.some((id) => id.startsWith("utt:")), "a directed utterance is located-in Bob");
  });

  await ok("take then give relocates the item to Bob", async () => {
    assert.match(await ses.handle("take coin"), /You take a brass coin/);
    assert.deepEqual(await containedBy(world, "you"), ["a-coin"]);
    assert.match(await ses.handle("give coin bob"), /You give a brass coin to Bob/);
    assert.ok((await containedBy(world, "bob")).includes("a-coin"), "Bob now holds the coin");
    assert.ok(!(await containedBy(world, "you")).includes("a-coin"), "you no longer hold it");
  });

  await ok("eat spends the resource and restores the need (the npc USE mechanic)", async () => {
    const out = await ses.handle("eat loaf");
    assert.match(out, /hunger 40→90/, "the need was raised toward the ceiling");
    assert.equal((await needsOf(world, "you")).levels.hunger, 90, "settled need:hunger is 90");
    const loaf = await settle(world, "a-loaf");
    assert.equal(loaf.fiber.find((c) => c.predicate === "amount")?.object, 2, "the loaf was depleted by one");
  });

  await ok("practice files a skill on your fiber", async () => {
    assert.match(await ses.handle("practice fishing"), /You practice fishing/);
    const me = await settle(world, "you");
    assert.ok(me.fiber.some((c) => c.predicate === "skill:fishing"), "skill:fishing now on the fiber");
  });

  await ok("score reports needs, body, and skills", async () => {
    const out = await ses.handle("score");
    assert.ok(/needs:/.test(out) && /hunger 90/.test(out), "needs line, updated hunger");
    assert.ok(/body:/.test(out) && /moving 100%/.test(out), "body capacities");
    assert.ok(/combat/.test(out), "the combat skill is listed");
  });

  await ok("attack lands a wound on Bob (skill 70 beats his 50 defence)", async () => {
    const out = await ses.handle("attack bob");
    assert.match(out, /You strike Bob's \w+/, "a blow lands");
    const h = await healthOf(world, "bob");
    assert.ok(h.injuries.length >= 1, "Bob now carries a wound");
  });

  await ok("mail posts a letter to Bob's mailbox; reading your own returns the body", async () => {
    assert.match(await ses.handle("mail bob supper at the inn"), /You post a letter to Bob/);
    assert.ok((await containedBy(world, mbox("bob"))).length >= 1, "a letter is in Bob's mailbox");
    // A letter addressed to YOU, then read via the bare `mail` command.
    await mail({ root: world, from: "bob", to: "you", subject: "(no subject)", body: "thanks for the coin", t: "seed:900001" });
    const read = await ses.handle("mail");
    assert.match(read, /thanks for the coin/, "the bare `mail` command reads your inbox");
  });

  await ok("flee moves you out through the only exit", async () => {
    const out = await ses.handle("flee");
    assert.match(out, /You flee north/);
    assert.ok(out.includes("The Yard"), "you arrive in the yard");
  });

  await ok("help lists the talk + live verb groups", async () => {
    const out = await ses.handle("help");
    assert.ok(/Talk:/.test(out) && /Live:/.test(out) && /say/.test(out));
  });

  console.log(`\n${pass} play-surface checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
