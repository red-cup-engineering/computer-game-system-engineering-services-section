// prove-perception — the SENSORY STREAM (perceiving): what an observer NEWLY perceives in its
// room across a tick window (sinceTick, nowTick]. `perceive` is the DELTA, not a snapshot — the
// "you hear / you see" lines a MUD prints between commands. This suite builds a tiny hand-made
// world in a UNIQUE /tmp dir (no Farstone, no examples), drives the real morphisms (#saying,
// #fighting) and the substrate directly, and asserts the four channels the morphism narrates:
//   SPEECH (say)  — an utterance said in my room this window, not my own, surfaces; my own does not.
//   SPEECH (tell) — a directed tell to ME surfaces for me; a co-located bystander does NOT see it.
//   MOVEMENT      — diffing the passed prevHere set: a newcomer "arrives"; first call (prevHere=null)
//                   is silent (just a snapshot to diff against next time).
//   HARM          — a fresh injury cell on a co-located actor within the window is a strike I witness.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node tests/prove-perception.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { append } from "#substrate";

import say, { tell } from "#saying";
import attack from "#fighting";

// perceiving is not yet wired into package.json's imports, so it comes in by relative path (the
// same convention the other suites use for a morphism whose #alias is not registered yet).
import perceive from "../being/doing/observing/perceiving/scripts/perceive.mjs";

let pass = 0;
const ok = (name, fn) =>
  Promise.resolve()
    .then(fn)
    .then(
      () => { pass += 1; console.log(`  ok  ${name}`); },
      (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
    );

const tmp = mkdtempSync(join(tmpdir(), "tab-perception-"));
const world = join(tmp, "w");

// place — an actor in a room: a naming, a `mover` cell (so perceive counts it an ACTOR, not an
// item/utterance), and a functional located-in (relational → dual-files at the room).
let seq = 0;
const place = async (who, room) => {
  const t = `seed:${String(++seq).padStart(6, "0")}`;
  await doing({ root: world, subject: who, predicate: "kind", object: "player", t: `${t}a` });
  await doing({ root: world, subject: who, predicate: "naming", object: `${who}-the-name`, t: `${t}b` });
  await doing({ root: world, subject: who, predicate: "mover", object: "session", t: `${t}c` });
  await doing({ root: world, subject: who, predicate: "located-in", object: room, t: `${t}d` });
};

try {
  // alice, bob, cara share `hall`; dan waits offstage in `yard` until the movement check.
  await place("alice", "hall");
  await place("bob", "hall");
  await place("cara", "hall");
  await place("dan", "yard");

  // === SPEECH (say) ===========================================================================

  await ok("say: bob perceives alice's in-room utterance (text + her name); not his own speech", async () => {
    // alice speaks at tick 5; bob speaks at tick 5 too. Window (4, 5] should surface alice's words.
    await say({ root: world, speaker: "alice", text: "hello", t: "tick:000005/say:0001" });
    await say({ root: world, speaker: "bob", text: "i am bob", t: "tick:000005/say:0002" });

    const { lines } = await perceive({ root: world, observer: "bob", sinceTick: 4, nowTick: 5 });
    assert.ok(lines.some((l) => l.includes("hello")), `bob should hear "hello"; got ${JSON.stringify(lines)}`);
    assert.ok(lines.some((l) => l.includes("alice-the-name")), "the heard line names the speaker, alice");
    // bob does NOT perceive his OWN speech.
    assert.ok(!lines.some((l) => l.includes("i am bob")), "an actor never perceives its own utterance");
  });

  await ok("say: a window that excludes the tick surfaces nothing (delta, not snapshot)", async () => {
    // the same utterances are at tick 5; a window of (5, 6] is past them → silent.
    const { lines } = await perceive({ root: world, observer: "bob", sinceTick: 5, nowTick: 6 });
    assert.ok(!lines.some((l) => l.includes("hello")), "an utterance outside the window is not re-narrated");
  });

  // === SPEECH (tell) ==========================================================================

  await ok("tell: bob perceives a directed tell to him; co-located cara does NOT", async () => {
    await tell({ root: world, speaker: "alice", listener: "bob", text: "psst", t: "tick:000007/tell:0001" });

    const bobLines = (await perceive({ root: world, observer: "bob", sinceTick: 6, nowTick: 7 })).lines;
    assert.ok(bobLines.some((l) => l.includes("tells you") && l.includes("psst")), `bob should get the tell; got ${JSON.stringify(bobLines)}`);

    const caraLines = (await perceive({ root: world, observer: "cara", sinceTick: 6, nowTick: 7 })).lines;
    assert.ok(!caraLines.some((l) => l.includes("psst")), "a directed tell is private to its listener");
  });

  // === MOVEMENT ===============================================================================

  await ok("movement: first call (prevHere=null) is silent; a later arrival is narrated", async () => {
    // First perceive: prevHere defaults to null ⇒ no movement narration, just a snapshot to diff.
    const first = await perceive({ root: world, observer: "alice", sinceTick: 7, nowTick: 8 });
    assert.ok(!first.lines.some((l) => l.includes("arrives")), "the first call emits no movement lines");
    assert.ok(first.hereNow instanceof Set, "perceive returns the co-located actor set");
    assert.ok(first.hereNow.has("bob") && first.hereNow.has("cara"), "bob and cara are here now");
    assert.ok(!first.hereNow.has("dan"), "dan is still offstage in the yard");

    // dan walks into the hall at tick 9.
    await append(world, "dan", { e: "dan", a: "located-in", v: "hall", t: "tick:000009/move:0001" });

    // Second perceive: pass the prior hereNow as prevHere ⇒ dan's arrival shows.
    const second = await perceive({ root: world, observer: "alice", prevHere: first.hereNow, sinceTick: 8, nowTick: 9 });
    assert.ok(second.lines.some((l) => l.includes("arrives") && l.includes("dan-the-name")), `dan should arrive; got ${JSON.stringify(second.lines)}`);
    assert.ok(second.hereNow.has("dan"), "dan is now co-located");
  });

  // === HARM ===================================================================================

  await ok("harm: alice witnesses a co-located actor take a wound within the window", async () => {
    // Give alice a strong combat skill so a strike lands deterministically: attack 60 vs cara's
    // fresh defence (floor(capacity:moving/2) = 50) → HIT, no RNG. The wound cell is stamped at t.
    await doing({ root: world, subject: "alice", predicate: "skill:combat", object: 60, t: "seed:000900" });

    const r = await attack({ root: world, agent: "alice", target: "cara", t: "tick:000011/hit:0001" });
    assert.equal(r.outcome, "hit", `expected a deterministic hit; got ${r.outcome} (${r.glyph})`);

    // bob (a co-located bystander) witnesses cara reeling from the wound in the window (10, 11].
    const { lines } = await perceive({ root: world, observer: "bob", sinceTick: 10, nowTick: 11 });
    assert.ok(
      lines.some((l) => l.includes("cara-the-name") && (l.includes("reels") || l.includes("wound"))),
      `bob should witness cara's wound; got ${JSON.stringify(lines)}`,
    );

    // And a direct injury cell, appended on a co-located actor in-window, is narrated too — proving
    // the HARM scan reads injury:* off the trace, independent of the combat morphism.
    await append(world, "dan", { e: "dan", a: "injury:arm", v: 4, t: "tick:000013/wound:0001" });
    const danLines = (await perceive({ root: world, observer: "bob", sinceTick: 12, nowTick: 13 })).lines;
    assert.ok(
      danLines.some((l) => l.includes("dan-the-name") && l.includes("arm")),
      `bob should witness dan's arm wound; got ${JSON.stringify(danLines)}`,
    );
  });

  console.log(`\n${pass} perception checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
