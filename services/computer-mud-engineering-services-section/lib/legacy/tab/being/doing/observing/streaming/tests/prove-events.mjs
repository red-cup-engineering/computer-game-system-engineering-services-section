// prove-events — STREAMING (the SSE firehose projection): worldEvents turns one daemon cycle's
// raw EAVT rows into structured, topic-tagged world-events. Builds small row arrays by hand and
// asserts the projection: a dimension tick row -> a tick event; an utterance's cells -> one say
// event with who+text; an injury row + its enacted-by reification -> a combat event naming the
// attacker; a coin row -> a coin/market event; a price row -> a price/market event; an actor's
// located-in -> a move event while an utterance's located-in does NOT; topics are tagged. The ⊤
// case builds a tiny on-disk world with a contradicted cell and passes { root }.
//
// Same tiny harness as prove-comms.mjs. Standalone: run `node being/doing/observing/streaming/tests/prove-events.mjs`.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import { append } from "#substrate";
import { rowId } from "#eavt-row";

import worldEvents, { EVENT_TOPICS, topicOf } from "../scripts/events.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const find = (evs, type) => evs.filter((e) => e.type === type);
const one = (evs, type) => { const m = find(evs, type); assert.equal(m.length, 1, `expected exactly one ${type}, got ${m.length}`); return m[0]; };

const tmp = mkdtempSync(join(tmpdir(), "tab-events-"));
const world = join(tmp, "w");

try {
  // --- TICK -----------------------------------------------------------------------------------
  await ok("a dimension tick row projects to a tick event on topic world", async () => {
    const evs = await worldEvents([{ e: "farstone", a: "tick", v: 42, t: "tick:000042" }]);
    const ev = one(evs, "tick");
    assert.equal(ev.n, 42);
    assert.equal(ev.topic, "world");
    assert.equal(ev.t, "tick:000042");
  });

  // --- SAY: an utterance's cells group into ONE say event ------------------------------------
  await ok("an utterance's cells project to a single say event with who+text (+room)", async () => {
    const t = "tick:1/say:1";
    const rows = [
      { e: "utt:abc", a: "kind", v: "utterance", t },
      { e: "utt:abc", a: "spoken-by", v: "alice", t },
      { e: "utt:abc", a: "saying", v: "hail", t },
      { e: "utt:abc", a: "in-language", v: "common", t },
      { e: "utt:abc", a: "located-in", v: "the-square", t },
    ];
    const evs = await worldEvents(rows);
    const ev = one(evs, "say");
    assert.equal(ev.who, "alice");
    assert.equal(ev.text, "hail");
    assert.equal(ev.room, "the-square");
    assert.equal(ev.topic, "chat");
    // the utterance's located-in must NOT also produce a move event.
    assert.equal(find(evs, "move").length, 0, "an utterance's located-in is not a move");
  });

  await ok("a directed utterance carries `to`", async () => {
    const t = "tick:2/tell:1";
    const rows = [
      { e: "utt:xyz", a: "spoken-by", v: "carla", t },
      { e: "utt:xyz", a: "saying", v: "psst", t },
      { e: "utt:xyz", a: "located-in", v: "bob", t },
      { e: "utt:xyz", a: "told-to", v: "bob", t },
    ];
    const ev = one(await worldEvents(rows), "say");
    assert.equal(ev.to, "bob");
    assert.equal(ev.who, "carla");
  });

  // --- EMOTE ---------------------------------------------------------------------------------
  await ok("an emote's cells project to a single emote event", async () => {
    const t = "tick:3/emote:1";
    const rows = [
      { e: "emote:q", a: "emoting-by", v: "bob", t },
      { e: "emote:q", a: "emote-text", v: "Bob grins.", t },
    ];
    const ev = one(await worldEvents(rows), "emote");
    assert.equal(ev.who, "bob");
    assert.equal(ev.text, "Bob grins.");
    assert.equal(ev.topic, "chat");
  });

  // --- COMBAT: an injury row + its enacted-by reification names the attacker ------------------
  await ok("an injury row + its enacted-by reification projects a combat event naming the attacker", async () => {
    const t = "tick:4/fight:1";
    const injury = { e: "bob", a: "injury:arm", v: 7, t };
    const reified = { e: rowId(injury), a: "enacted-by", v: "alice", t };
    const evs = await worldEvents([injury, reified]);
    const ev = one(evs, "combat");
    assert.equal(ev.target, "bob");
    assert.equal(ev.part, "arm");
    assert.equal(ev.severity, 7);
    assert.equal(ev.attacker, "alice");
    assert.equal(ev.topic, "combat");
    // the reified row itself does not become its own event.
    assert.equal(evs.length, 1, "only the combat event, not the reification");
  });

  await ok("an injury without a reification still projects combat, sans attacker", async () => {
    const ev = one(await worldEvents([{ e: "bob", a: "injury:leg", v: 3, t: "tick:4/x" }]), "combat");
    assert.equal(ev.part, "leg");
    assert.equal(ev.attacker, undefined);
  });

  // --- DEATH ---------------------------------------------------------------------------------
  await ok("a dead:true row projects a death event on topic combat", async () => {
    const ev = one(await worldEvents([{ e: "bob", a: "dead", v: true, t: "tick:5/die" }]), "death");
    assert.equal(ev.who, "bob");
    assert.equal(ev.topic, "combat");
  });

  // --- MARKET --------------------------------------------------------------------------------
  await ok("a coin row projects a coin/market event", async () => {
    const ev = one(await worldEvents([{ e: "alice", a: "coin", v: 100, t: "tick:6/buy" }]), "coin");
    assert.equal(ev.who, "alice");
    assert.equal(ev.coin, 100);
    assert.equal(ev.topic, "market");
  });

  await ok("a price row projects a price/market event; an amount row is a supply signal", async () => {
    const priced = one(await worldEvents([{ e: "ale", a: "price", v: 5, t: "tick:6/p" }]), "price");
    assert.equal(priced.item, "ale");
    assert.equal(priced.price, 5);
    assert.equal(priced.topic, "market");

    const supply = one(await worldEvents([{ e: "ale", a: "amount", v: 12, t: "tick:6/a" }]), "price");
    assert.equal(supply.item, "ale");
    assert.equal(supply.amount, 12);
    assert.equal(supply.topic, "market");
  });

  // --- MOVE: an actor's located-in is a move; a non-actor prefix is not ----------------------
  await ok("an actor's located-in projects a move; an utterance/letter/corpse located-in does not", async () => {
    const rows = [
      { e: "alice", a: "located-in", v: "the-alley", t: "tick:7/m" },
      { e: "utt:abc", a: "located-in", v: "the-square", t: "tick:7/u" },
      { e: "letter:1", a: "located-in", v: "mbox:bob", t: "tick:7/l" },
      { e: "corpse:bob", a: "located-in", v: "the-square", t: "tick:7/c" },
    ];
    const evs = await worldEvents(rows); // no root: prefix filter only
    const moves = find(evs, "move");
    assert.equal(moves.length, 1, "only the actor moved");
    assert.equal(moves[0].who, "alice");
    assert.equal(moves[0].to, "the-alley");
    assert.equal(moves[0].topic, "world");
  });

  await ok("with a root, a located-in subject without a `mover` cell is NOT a move", async () => {
    // alice has a mover cell; a-rock does not. Both get a located-in this cycle.
    await doing({ root: world, subject: "alice", predicate: "mover", object: true, t: "seed:1" });
    await doing({ root: world, subject: "a-rock", predicate: "kind", object: "item", t: "seed:2" });
    const rows = [
      { e: "alice", a: "located-in", v: "the-square", t: "tick:8/m" },
      { e: "a-rock", a: "located-in", v: "the-square", t: "tick:8/r" },
    ];
    const evs = await worldEvents(rows, { root: world });
    const moves = find(evs, "move");
    assert.equal(moves.length, 1, "only the mover moved");
    assert.equal(moves[0].who, "alice");
  });

  // --- TOP (⊤): a contradicted cell on disk surfaces as a top event ---------------------------
  await ok("a contradicted cell surfaces as a ⊤ event on topic world (with root)", async () => {
    // assert a fact both ways via the CONVERSE predication (being folds q-rows as neg evidence).
    // The converse declaration (open has-converse shut) must live in gate's OWN log so settle reads
    // it, so we append the three rows straight into gate's log: declare the converse, then assert
    // open=true AND shut=true -> the `open true` cell settles to ⊤ (held both ways).
    await append(world, "gate", { e: "open", a: "has-converse", v: "shut", t: "seed:9" });
    await append(world, "gate", { e: "gate", a: "open", v: true, t: "seed:10" });
    await append(world, "gate", { e: "gate", a: "shut", v: true, t: "seed:11" });
    const rows = [{ e: "gate", a: "open", v: true, t: "tick:9/g" }];
    const evs = await worldEvents(rows, { root: world });
    const tops = find(evs, "top");
    assert.ok(tops.length >= 1, "the contradicted cell should surface as ⊤");
    const ev = tops.find((e) => e.entity === "gate" && e.predicate === "open");
    assert.ok(ev, "the gate's open cell is held both ways");
    assert.equal(ev.topic, "world");
  });

  await ok("with no root, the ⊤ pass is skipped entirely", async () => {
    const evs = await worldEvents([{ e: "gate", a: "open", v: true, t: "tick:9/g" }]);
    assert.equal(find(evs, "top").length, 0);
  });

  // --- the taxonomy: topics are tagged and consistent ----------------------------------------
  await ok("EVENT_TOPICS and topicOf tag every event's type consistently", async () => {
    assert.deepEqual([...EVENT_TOPICS].sort(), ["chat", "combat", "market", "world"]);
    const mixed = [
      { e: "farstone", a: "tick", v: 1, t: "tick:1" },
      { e: "alice", a: "coin", v: 9, t: "tick:1/c" },
      { e: "bob", a: "dead", v: true, t: "tick:1/d" },
    ];
    const evs = await worldEvents(mixed);
    for (const ev of evs) {
      assert.equal(ev.topic, topicOf(ev.type), `${ev.type} -> ${ev.topic}`);
      assert.ok(EVENT_TOPICS.includes(ev.topic), `${ev.topic} is a known topic`);
    }
  });

  // --- determinism: same cycle -> identical projection ---------------------------------------
  await ok("the projection is deterministic (same rows -> identical events)", async () => {
    const rows = [
      { e: "farstone", a: "tick", v: 3, t: "tick:3" },
      { e: "alice", a: "coin", v: 1, t: "tick:3/c" },
      { e: "bob", a: "coin", v: 2, t: "tick:3/c2" },
    ];
    const a = await worldEvents(rows);
    const b = await worldEvents(rows);
    assert.deepEqual(a, b);
  });

  console.log(`\n${pass} events checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
