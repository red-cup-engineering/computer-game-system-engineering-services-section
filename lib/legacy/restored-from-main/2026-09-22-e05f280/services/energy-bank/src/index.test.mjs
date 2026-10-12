import { test } from "node:test";
import assert from "node:assert/strict";
import * as EnergyBank from "./index.mjs";

test("index.mts: re-exports one representative symbol from every module, with no name collisions", () => {
  assert.equal(typeof EnergyBank.guestAccountId, "function"); // accounts.mts
  assert.equal(typeof EnergyBank.createLedger, "function"); // ledger.mts
  assert.equal(typeof EnergyBank.checkAll, "function"); // invariants.mts
  assert.equal(typeof EnergyBank.transferEnergy, "function"); // transfer.mts
  assert.equal(typeof EnergyBank.mockBackend, "object"); // settlement.mts
});

test("index.mts: the barrel is enough on its own to fund and audit a ledger end to end", () => {
  const ledger = EnergyBank.createLedger();
  EnergyBank.fundAccount(ledger, "equity:earned:onestone", "onestone:account-a", "5", "ENERGY", "ref-1", "2026-08-19");
  assert.deepEqual(EnergyBank.checkAll(ledger), []);
});
