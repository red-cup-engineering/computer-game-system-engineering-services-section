import assert from "node:assert/strict";
import test from "node:test";
import { interestFor } from "../scripts/interest-correlation.mjs";

function roomWithMembers(entries) {
  const members = new Map(entries);
  return { members: () => members };
}

test("a subscriber's own actorId is of interest, another actor's is not", () => {
  const connA = { socket: "a" };
  const connB = { socket: "b" };
  const room = roomWithMembers([
    ["actor-a", { conn: connA }],
    ["actor-b", { conn: connB }],
  ]);
  const interest = interestFor(() => room);
  assert.equal(interest("actor-a", connA), true);
  assert.equal(interest("actor-b", connA), false);
  assert.equal(interest("actor-a", connB), false);
  assert.equal(interest("actor-b", connB), true);
});

test("fails closed when the room is not yet available", () => {
  const interest = interestFor(() => null);
  assert.equal(interest("actor-a", { socket: "a" }), false);
});

test("fails closed for a connection with no registered member yet", () => {
  const room = roomWithMembers([["actor-a", { conn: { socket: "a" } }]]);
  const interest = interestFor(() => room);
  assert.equal(interest("actor-a", { socket: "unregistered" }), false);
});

test("correlates by reference equality on conn, not by id-shaped coincidence", () => {
  const room = roomWithMembers([["actor-a", { conn: { socket: "a" } }]]);
  const interest = interestFor(() => room);
  // a structurally-identical-but-distinct object is NOT the same connection
  assert.equal(interest("actor-a", { socket: "a" }), false);
});
