// prove-comms — COMMS (EPIC D): say/tell into the room and async mail, both as intra-actions.
// Builds a tiny world by hand in a UNIQUE /tmp dir (no Farstone, no examples), drives the
// communication morphisms directly, and asserts the agential-realist properties: an utterance is
// an ambient entity the room contains; co-located actors hear it and non-co-located ones don't;
// speech is replay-deterministic (content-addressed id); a letter lands in the recipient's
// mailbox; hasMail/readMail behave; reading is append-only; comprehends gates on language.
//
// Same tiny harness as prove-interaction.mjs. Standalone: run `node tests/prove-comms.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { settle, containedBy, rowsFor } from "#substrate";
import { holds } from "#value";
import being from "#being";

import say, { tell, comprehends, comprehendsAt } from "../being/doing/saying/scripts/say.mjs";
import mail, { hasMail, readMail, mbox, LETTER_FUNCTIONAL } from "../being/doing/mailing/scripts/mail.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-comms-"));
const world = join(tmp, "w");

// place an actor into a room (functional located-in; relational so it dual-files at the room).
const place = async (who, room, t) => {
  await doing({ root: world, subject: who, predicate: "kind", object: "player", t: `${t}a` });
  await doing({ root: world, subject: who, predicate: "naming", object: who, t: `${t}b` });
  await doing({ root: world, subject: who, predicate: "located-in", object: room, t: `${t}c` });
};

try {
  // Two rooms. alice + bob share the-square; carla stands alone in the-alley.
  await place("alice", "the-square", "seed:000001");
  await place("bob", "the-square", "seed:000002");
  await place("carla", "the-alley", "seed:000003");

  // --- say: an utterance is an ambient entity the room contains; frontier hears it ----------
  await ok("say creates an utterance the room contains", async () => {
    const { utterance } = await say({ root: world, speaker: "alice", text: "hail and well met", t: "tick:1/say:1" });
    const here = await containedBy(world, "the-square");
    assert.ok(here.includes(utterance), "the utterance entity should be located-in the room");
    const u = await settle(world, utterance);
    const cell = (p) => u.fiber.find((c) => c.predicate === p && holds(c.value))?.object;
    assert.equal(cell("kind"), "utterance");
    assert.equal(cell("spoken-by"), "alice");
    assert.equal(cell("saying"), "hail and well met");
    assert.equal(cell("in-language"), "common");
  });

  await ok("a co-located actor is in heardBy; a non-co-located one is not; speaker is not", async () => {
    const { heardBy } = await say({ root: world, speaker: "alice", text: "is anyone about?", t: "tick:1/say:2" });
    assert.ok(heardBy.includes("bob"), "bob shares the square — should hear");
    assert.ok(!heardBy.includes("carla"), "carla is in the alley — should NOT hear");
    assert.ok(!heardBy.includes("alice"), "the speaker does not hear themselves");
  });

  // --- replay determinism: same act → same content-addressed utterance id -------------------
  await ok("the utterance is replay-deterministic (content-addressed id)", async () => {
    const a = await say({ root: world, speaker: "bob", text: "the same words", t: "tick:9/say:1" });
    const b = await say({ root: world, speaker: "bob", text: "the same words", t: "tick:9/say:1" });
    assert.equal(a.utterance, b.utterance, "identical speech at identical tick → identical id");
    assert.ok(a.utterance.startsWith("utt:"), "utterance ids carry the utt: prefix");
    // Different text or tick must mint a different id.
    const c = await say({ root: world, speaker: "bob", text: "other words", t: "tick:9/say:1" });
    assert.notEqual(a.utterance, c.utterance);
  });

  // --- tell: directed utterance located-in the listener -------------------------------------
  await ok("tell is heard by the listener and located in them, not the room", async () => {
    const { utterance, heardBy } = await tell({ root: world, speaker: "carla", listener: "carla", text: "(muttering)", t: "tick:2/tell:1" });
    assert.ok(heardBy.includes("carla"), "the addressed listener hears the directed utterance");
    const u = await settle(world, utterance);
    const loc = u.fiber.find((c) => c.predicate === "located-in" && holds(c.value))?.object;
    assert.equal(loc, "carla", "a directed utterance is located-in the listener");
    const square = await containedBy(world, "the-square");
    assert.ok(!square.includes(utterance), "a told utterance does not land in the room");
  });

  // --- mail: a letter entity in the recipient's mailbox -------------------------------------
  await ok("mail puts a letter in the recipient's mailbox; hasMail becomes true", async () => {
    assert.equal(await hasMail({ root: world, owner: "bob" }), false, "bob starts with no mail");
    const { letter } = await mail({ root: world, from: "alice", to: "bob", subject: "supper", body: "meet me at dusk", t: "tick:3/mail:1" });
    const box = await containedBy(world, mbox("bob"));
    assert.ok(box.includes(letter), "the letter should be located-in bob's mailbox");
    assert.equal(await hasMail({ root: world, owner: "bob" }), true, "bob now has mail");
    assert.equal(await hasMail({ root: world, owner: "carla" }), false, "carla's mailbox is untouched");
  });

  await ok("mail is replay-deterministic (content-addressed letter id)", async () => {
    const a = await mail({ root: world, from: "alice", to: "carla", subject: "x", body: "same letter", t: "tick:7/mail:1" });
    const b = await mail({ root: world, from: "alice", to: "carla", subject: "x", body: "same letter", t: "tick:7/mail:1" });
    assert.equal(a.letter, b.letter, "identical mailing at identical tick → identical id");
    assert.ok(a.letter.startsWith("letter:"));
  });

  // --- readMail: returns the body, marks read, append-only ----------------------------------
  await ok("readMail returns from/subject/body and marks the letter read", async () => {
    const { letters } = await readMail({ root: world, reader: "bob", t: "tick:4/read:1" });
    const supper = letters.find((l) => l.subject === "supper");
    assert.ok(supper, "the supper letter should be returned");
    assert.equal(supper.from, "alice");
    assert.equal(supper.body, "meet me at dusk");
  });

  await ok("a second read shows read=true (append-only, no mutation, history intact)", async () => {
    // The letter's settled `read` cell is now true.
    const box = await containedBy(world, mbox("bob"));
    let foundReadTrue = false;
    for (const id of box) {
      // settle with the letter-local functional set so `read` supersedes to its latest value.
      const t = await settle(world, id, { functional: LETTER_FUNCTIONAL });
      const reads = t.fiber.filter((c) => c.predicate === "read");
      // supersession means exactly ONE read cell survives, and it is read=true.
      assert.equal(reads.length, 1, "the read cell supersedes to a single latest value");
      if (reads[0].object === true && holds(reads[0].value)) foundReadTrue = true;
      // append-only: the original read=false row must still be ON the raw trace.
      const raw = await rowsFor(world, id);
      const hasFalse = raw.some((r) => r.e === id && r.a === "read" && r.v === false);
      const hasTrue = raw.some((r) => r.e === id && r.a === "read" && r.v === true);
      assert.ok(hasFalse, "the original read=false row is never deleted (append-only)");
      assert.ok(hasTrue, "a new read=true row was appended");
    }
    assert.ok(foundReadTrue, "settle supersedes to read=true");
    // The letter is still in the mailbox after reading (not removed).
    assert.equal(await hasMail({ root: world, owner: "bob" }), true);
    // Re-reading is idempotent in effect: it still returns the letter, still read.
    const again = await readMail({ root: world, reader: "bob", t: "tick:5/read:1" });
    assert.ok(again.letters.some((l) => l.subject === "supper"));
  });

  // --- comprehends: the language hook -------------------------------------------------------
  await ok("comprehends: true for common, false for an unknown language the observer lacks", async () => {
    const bob = await settle(world, "bob");
    assert.equal(comprehends(bob, "common"), true, "everyone comprehends the common tongue");
    assert.equal(comprehends(bob, "elvish"), false, "bob lacks understands:elvish");
    assert.equal(comprehends(bob), true, "default language is common");
  });

  await ok("comprehends: true once the observer has understands:<lang>", async () => {
    await doing({ root: world, subject: "alice", predicate: "understands:elvish", object: true, t: "seed:000100" });
    const alice = await settle(world, "alice");
    assert.equal(comprehends(alice, "elvish"), true, "alice now understands elvish");
    // and the disk-settling convenience agrees.
    assert.equal(await comprehendsAt({ root: world, observer: "alice", lang: "elvish" }), true);
    assert.equal(await comprehendsAt({ root: world, observer: "bob", lang: "elvish" }), false);
  });

  console.log(`\n${pass} comms checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
