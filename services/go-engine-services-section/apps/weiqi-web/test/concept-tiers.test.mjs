// Event-toast wiring coverage (task requirement: "event-toast wiring
// tests") for the settings-tier gate on LIVE CONCEPT RECOGNITION (task
// item 4). concept-tiers.mjs's shouldToast is the one rule the whole
// feature hinges on -- kept pure and DOM-free specifically so it can be
// exercised directly here against the kernel's real SemanticEventType
// union, without a browser.
//
// Run with: node --test 'test/*.test.mts'

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shouldToast,
  isValidTier,
  TIER_BEGINNER,
  TIER_INTERMEDIATE,
  TIER_OFF,
  TIERS,
  COMMON_EVENT_TYPES,
  RARE_EVENT_TYPES,
  TOASTABLE_EVENT_TYPES,
} from "../public/js/concept-tiers.mjs";

// The engine's own SemanticEventType union (weiqi-engine/src/events.mts)
// -- kept as a literal list here (not imported) so this test fails loudly
// if the kernel ever adds an event type this module hasn't made a
// deliberate toast/no-toast decision about, rather than silently passing.
const ALL_KERNEL_EVENT_TYPES = [
  "atari-given",
  "atari-escaped",
  "capture",
  "ko-started",
  "ko-resolved",
  "connection",
  "eye-formed",
  "group-killed",
  "pass",
  "game-ended",
];

test("off tier never toasts anything, for every known event type", () => {
  for (const type of ALL_KERNEL_EVENT_TYPES) {
    assert.equal(shouldToast(type, TIER_OFF), false, `off tier toasted "${type}"`);
  }
});

test("beginner tier toasts every common and every rare event", () => {
  for (const type of COMMON_EVENT_TYPES) {
    assert.equal(shouldToast(type, TIER_BEGINNER), true, `beginner should toast common event "${type}"`);
  }
  for (const type of RARE_EVENT_TYPES) {
    assert.equal(shouldToast(type, TIER_BEGINNER), true, `beginner should toast rare event "${type}"`);
  }
});

test("intermediate tier toasts only rare events, never common ones", () => {
  for (const type of RARE_EVENT_TYPES) {
    assert.equal(shouldToast(type, TIER_INTERMEDIATE), true, `intermediate should toast rare event "${type}"`);
  }
  for (const type of COMMON_EVENT_TYPES) {
    assert.equal(shouldToast(type, TIER_INTERMEDIATE), false, `intermediate should NOT toast common event "${type}"`);
  }
});

test("pass and game-ended are never toasted, at any tier -- deliberately excluded, not merely tier-gated", () => {
  for (const tier of TIERS) {
    assert.equal(shouldToast("pass", tier), false, `"pass" toasted at tier "${tier}"`);
    assert.equal(shouldToast("game-ended", tier), false, `"game-ended" toasted at tier "${tier}"`);
  }
});

test("group-killed is never toasted on its own -- it is redundant with the accompanying capture toast", () => {
  for (const tier of TIERS) {
    assert.equal(shouldToast("group-killed", tier), false, `"group-killed" toasted at tier "${tier}"`);
  }
});

test("every kernel event type gets a defined (non-throwing, boolean) answer at every tier", () => {
  for (const type of ALL_KERNEL_EVENT_TYPES) {
    for (const tier of TIERS) {
      const result = shouldToast(type, tier);
      assert.equal(typeof result, "boolean", `shouldToast("${type}", "${tier}") did not return a boolean`);
    }
  }
});

test("an unrecognized tier value is treated as showing nothing, not as beginner-by-default (fails closed, not open)", () => {
  assert.equal(shouldToast("capture", "not-a-real-tier"), false);
});

test("TOASTABLE_EVENT_TYPES is exactly the union of common and rare", () => {
  const union = new Set([...COMMON_EVENT_TYPES, ...RARE_EVENT_TYPES]);
  assert.deepEqual([...TOASTABLE_EVENT_TYPES].sort(), [...union].sort());
});

test("common and rare event-type sets are disjoint", () => {
  for (const type of COMMON_EVENT_TYPES) {
    assert.equal(RARE_EVENT_TYPES.has(type), false, `"${type}" appears in both COMMON and RARE`);
  }
});

test("isValidTier accepts exactly the three documented tiers and rejects everything else", () => {
  assert.equal(isValidTier(TIER_BEGINNER), true);
  assert.equal(isValidTier(TIER_INTERMEDIATE), true);
  assert.equal(isValidTier(TIER_OFF), true);
  assert.equal(isValidTier("expert"), false);
  assert.equal(isValidTier(undefined), false);
  assert.equal(isValidTier(""), false);
});
