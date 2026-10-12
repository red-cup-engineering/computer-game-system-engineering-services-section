import assert from "node:assert/strict";
import test from "node:test";
import { createSingleCommandValidator, DEFAULT_MAX_COMMAND_LENGTH } from "../scripts/single-command-game-protocol.mjs";

test("accepts a well-shaped command envelope and trims it", () => {
  const gameValidate = createSingleCommandValidator();
  assert.deepEqual(gameValidate({ kind: "command", args: { command: "  look north  " } }, "actor-1"), {
    kind: "command",
    args: { command: "look north" },
  });
});

test("rejects a non-object, a wrong kind, or a missing/malformed args.command", () => {
  const gameValidate = createSingleCommandValidator();
  assert.equal(gameValidate(null, "actor-1"), null);
  assert.equal(gameValidate("not an object", "actor-1"), null);
  assert.equal(gameValidate({ kind: "move" }, "actor-1"), null);
  assert.equal(gameValidate({ kind: "command" }, "actor-1"), null);
  assert.equal(gameValidate({ kind: "command", args: null }, "actor-1"), null);
  assert.equal(gameValidate({ kind: "command", args: { command: 42 } }, "actor-1"), null);
});

test("rejects an empty or whitespace-only command", () => {
  const gameValidate = createSingleCommandValidator();
  assert.equal(gameValidate({ kind: "command", args: { command: "" } }, "actor-1"), null);
  assert.equal(gameValidate({ kind: "command", args: { command: "   " } }, "actor-1"), null);
});

test("enforces the default max command length of 256, and a caller-supplied one", () => {
  const gameValidate = createSingleCommandValidator();
  const atLimit = "a".repeat(DEFAULT_MAX_COMMAND_LENGTH);
  const overLimit = "a".repeat(DEFAULT_MAX_COMMAND_LENGTH + 1);
  assert.deepEqual(gameValidate({ kind: "command", args: { command: atLimit } }, "actor-1"), { kind: "command", args: { command: atLimit } });
  assert.equal(gameValidate({ kind: "command", args: { command: overLimit } }, "actor-1"), null);

  const shortValidate = createSingleCommandValidator({ maxCommandLength: 5 });
  assert.equal(shortValidate({ kind: "command", args: { command: "toolong" } }, "actor-1"), null);
  assert.deepEqual(shortValidate({ kind: "command", args: { command: "hi" } }, "actor-1"), { kind: "command", args: { command: "hi" } });
});

test("the actor id is ignored — this shape carries no per-actor policy", () => {
  const gameValidate = createSingleCommandValidator();
  const a = gameValidate({ kind: "command", args: { command: "look" } }, "actor-1");
  const b = gameValidate({ kind: "command", args: { command: "look" } }, "actor-2");
  assert.deepEqual(a, b);
});
