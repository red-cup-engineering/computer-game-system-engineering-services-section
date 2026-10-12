import assert from "node:assert/strict";
import test from "node:test";
import { projectGamePosition } from "../src/game-position.mjs";

test("projects explicit work and ledger evidence", () => {
  const result = projectGamePosition(
    { items: [{ id: "one", status: "active" }] },
    { entries: [{ event: "inspect", trace: "session:a", subject: "one", evidence: [] }] },
    { session: "a" },
    { generatedAt: "2026-08-30T12:00:00.000Z" },
  );
  assert.equal(result.session, "a");
  assert.equal(result.challenge, 1);
  assert.deepEqual(result.repertoire, ["inspect"]);
});

test("does not acquire work or ledger state", () => {
  assert.throws(() => projectGamePosition({}, {}, {}, { generatedAt: "2026-08-30T12:00:00.000Z" }), /work\.items/);
});
