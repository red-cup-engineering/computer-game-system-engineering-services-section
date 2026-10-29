import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSystemInstruction } from "../src/system-instruction.mjs";

test("buildSystemInstruction: mentions decision support, citing, and I don't know", () => {
  const text = buildSystemInstruction({ characterName: "Morgan Sennhauser" });
  assert.match(text, /Morgan Sennhauser/);
  assert.match(text, /decision-support/i);
  assert.match(text, /recordedAt/);
  assert.match(text, /I don't know/);
  assert.match(text, /never invent missing inputs/i);
});

test("buildSystemInstruction: works without a characterName", () => {
  const text = buildSystemInstruction();
  assert.match(text, /newbie EVE Online capsuleer/);
});

test("buildSystemInstruction: rejects an empty characterName", () => {
  assert.throws(() => buildSystemInstruction({ characterName: "" }), TypeError);
});
