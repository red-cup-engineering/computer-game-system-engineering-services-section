import assert from "node:assert/strict";
import test from "node:test";
import { deriveReadoutEnvelope } from "../scripts/derive-readout-envelope.mjs";

// Matches the stub-engine.mjs analysis fixture: four points exercising all
// four FOUR outcomes at the derive-readout-envelope defaults (ownership
// threshold 0.2, variance threshold 0.05).
const ANALYSIS_RESPONSE = {
  id: "q1",
  ownership: [0.9, -0.9, 0.05, 0.05],
  ownershipStdev: [0.01, 0.01, 0.01, 0.5],
  rootInfo: { boardXSize: 2, boardYSize: 2 },
};

test("deriveReadoutEnvelope classifies all four FOUR outcomes", () => {
  const envelope = deriveReadoutEnvelope(ANALYSIS_RESPONSE);
  assert.deepEqual(envelope.charge, ["potential", "active", "absurd", "stable"]);
  assert.deepEqual(envelope.readout, ["0.900000", "-0.900000", "0.050000", "0.050000"]);
  assert.equal(envelope.position, "q1");
  assert.deepEqual(envelope.source, { engine: "katago", boardXSize: 2, boardYSize: 2 });
});

test("deriveReadoutEnvelope's content identity is stable across two derivations of the same input", () => {
  const first = deriveReadoutEnvelope(ANALYSIS_RESPONSE);
  const second = deriveReadoutEnvelope(ANALYSIS_RESPONSE);
  assert.equal(first.identity, second.identity);
  assert.match(first.identity, /^ni:\/\/\/sha-256;/);
});

test("deriveReadoutEnvelope's content identity changes when the readout changes", () => {
  const first = deriveReadoutEnvelope(ANALYSIS_RESPONSE);
  const changed = deriveReadoutEnvelope({ ...ANALYSIS_RESPONSE, ownership: [0.9, -0.9, 0.05, -0.9] });
  assert.notEqual(first.identity, changed.identity);
});

test("deriveReadoutEnvelope honors custom thresholds", () => {
  const envelope = deriveReadoutEnvelope(ANALYSIS_RESPONSE, {
    ownershipThreshold: 0.95, // nothing crosses this, so every point falls to bot/top
    varianceThreshold: 0.2,
  });
  assert.deepEqual(envelope.charge, ["absurd", "absurd", "absurd", "stable"]);
});
