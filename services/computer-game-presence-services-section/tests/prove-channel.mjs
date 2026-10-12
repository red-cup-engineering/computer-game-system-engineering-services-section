import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createChannelRegistry,
  subscribe,
  unsubscribe,
  unsubscribeAll,
  membersOf,
} from "../src/channel.mjs";

test("createChannelRegistry starts empty", () => {
  assert.deepEqual(createChannelRegistry(), {});
});

test("subscribe adds a member and is idempotent", () => {
  let reg = createChannelRegistry();
  reg = subscribe(reg, "lobby", "g1:a");
  assert.deepEqual(membersOf(reg, "lobby"), ["g1:a"]);
  const again = subscribe(reg, "lobby", "g1:a");
  assert.deepEqual(membersOf(again, "lobby"), ["g1:a"]);
});

test("subscribe never mutates its input registry", () => {
  const reg = createChannelRegistry();
  const next = subscribe(reg, "lobby", "g1:a");
  assert.deepEqual(reg, {});
  assert.notEqual(reg, next);
});

test("unsubscribe removes just that channel's membership", () => {
  let reg = subscribe(createChannelRegistry(), "lobby", "g1:a");
  reg = subscribe(reg, "other", "g1:a");
  reg = unsubscribe(reg, "lobby", "g1:a");
  assert.deepEqual(membersOf(reg, "lobby"), []);
  assert.deepEqual(membersOf(reg, "other"), ["g1:a"]);
  assert.equal("lobby" in reg, false);
});

test("unsubscribeAll removes a key from every channel", () => {
  let reg = subscribe(createChannelRegistry(), "lobby", "g1:a");
  reg = subscribe(reg, "other", "g1:a");
  reg = subscribe(reg, "other", "g1:b");
  reg = unsubscribeAll(reg, "g1:a");
  assert.deepEqual(membersOf(reg, "lobby"), []);
  assert.deepEqual(membersOf(reg, "other"), ["g1:b"]);
});

test("membersOf returns empty array for an unknown channel", () => {
  assert.deepEqual(membersOf(createChannelRegistry(), "nope"), []);
});
