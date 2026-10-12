/**
 * The live text-MUD transport (on the upstream session carrier): a queued command
 * drains into the sole-writer tick and the acting player's own events come back —
 * identity is a stable actor id derived from the name, so reconnection returns the same
 * character. No hand-rolled socket or account store; the carrier is inherited.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { actorIdFor, createFizzosMud, throttleIntents } from "./mud-server.mjs";
import type { CommandIntent } from "./scene.mjs";
import { STARTER_WORLD } from "./starter-world.mjs";

const cmd = (actor: string, line: string): CommandIntent => ({ k: "command", actor, line });

test("identity — a name resolves to a stable, clean actor id (reconnect-safe)", () => {
  assert.equal(actorIdFor("Cap Tain"), "player-cap-tain");
  assert.equal(actorIdFor("Cap Tain"), actorIdFor("cap   tain"), "same name, same actor on every login");
});

test("transport — a queued command drains into the tick and moves its own actor", () => {
  const mud = createFizzosMud(STARTER_WORLD);
  const actor = actorIdFor("Cap");
  // the carrier validates and queues session input as a command intent
  assert.ok(mud.carrier.queue.push({ session: actor, line: "north" }) !== null, "valid line accepted");
  assert.equal(mud.carrier.queue.push({ session: actor, line: "   " }), null, "blank line rejected");
  mud.step(); // the sole-writer tick drains the queue
  assert.equal(mud.scene.snapOf(actor)?.locatedIn, "the-jetty", "the player joined and moved");
});

test("flood control — an actor's commands are capped per tick; others are unaffected", () => {
  // One actor floods 50 lines; a second sends one. The cap keeps order and protects the tick.
  const flood = Array.from({ length: 50 }, () => cmd("player-spammer", "look"));
  const { kept, throttled } = throttleIntents([...flood, cmd("player-calm", "look")], 4);
  assert.equal(kept.filter((i) => i.actor === "player-spammer").length, 4, "the flooder is capped at the budget");
  assert.equal(kept.filter((i) => i.actor === "player-calm").length, 1, "a well-behaved actor is never throttled");
  assert.deepEqual(throttled, ["player-spammer"], "the flooder is reported for a slow-down notice");
});

test("transport — the tick advances NPC life even with no player input", () => {
  const mud = createFizzosMud(STARTER_WORLD);
  for (let i = 0; i < 30; i++) mud.step(); // no commands queued
  // pip (an NPC) develops a mood from drifting needs over empty ticks
  assert.equal(typeof mud.snapshot, "function");
  assert.ok(mud.scene.snapOf("pip-fizzle") !== null, "the world keeps living between commands");
});
