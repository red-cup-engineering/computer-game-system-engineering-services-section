// prove-economy — the economy mechanics: richness (value IS fiber richness) and trade (possession
// transfer as a dual-filed, superseding located-in move). value is not a number a thing carries;
// it is a read over the determined region of a settled fiber (⊥ contributes nothing; ⊤ counts and
// is contested). Trade is fiber exchange: the double-entry is the dual filing, the supersession is
// the arrow of time made of disk. Builds Farstone into a UNIQUE temp dir; same tiny harness as
// prove-interaction.mjs. Append-only throughout.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { settle, locationOf, containedBy } from "#substrate";
import ticking from "#ticking";
import buildFarstone from "./fixtures/build-fixture.mjs";
import richness, { richnessOf } from "../being/library/value/library/richness/scripts/richness.mjs";
import trade from "../being/doing/changing/trading/scripts/trade.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const lineCount = (path) => readFileSync(path, "utf8").split("\n").filter(Boolean).length;

const tmp = mkdtempSync(join(tmpdir(), "tab-econ-"));
const world = join(tmp, "farstone");

try {
  await buildFarstone(world);

  // --- richness: value IS fiber richness -----------------------------------------------------
  await ok("richness reads a settled being into { score, determined, contested }", async () => {
    const r = richness(await settle(world, "permit-23"));
    assert.equal(typeof r.score, "number");
    assert.equal(typeof r.determined, "number");
    assert.equal(typeof r.contested, "number");
    assert.ok(r.determined >= 1, "a seeded permit has determined cells");
  });

  await ok("a rich entity outscores a thin one (harbor-district > a bare item move target)", async () => {
    // harbor-district carries kind/naming/describing + exits + dual-filed contents → many cells.
    const rich = await richnessOf(world, "harbor-district");
    // south-point-light is a small place; pick the thinnest comparison that is unambiguous: a
    // fresh subject with a single move has just one determined cell.
    const thin = await richnessOf(world, "south-point-light");
    assert.ok(rich.determined > thin.determined,
      `expected harbor-district (${rich.determined}) richer than south-point-light (${thin.determined})`);
    assert.ok(rich.score > thin.score, `score should track richness (${rich.score} > ${thin.score})`);
  });

  await ok("functional cells weigh more (scarcity = settledness)", async () => {
    const permit = await settle(world, "permit-23");
    const w1 = richness(permit, { functionalWeight: 1 });
    const w5 = richness(permit, { functionalWeight: 5 });
    assert.equal(w1.determined, w5.determined, "weighting changes score, not the determined count");
    assert.ok(w5.score > w1.score, "raising functionalWeight raises the score (permit has functional cells)");
  });

  // --- contested value is ⊤ ------------------------------------------------------------------
  await ok("after ~31 ticks permit-23 goes ⊤ → contested ≥ 1", async () => {
    for (let i = 0; i < 31; i += 1) await ticking({ root: world });
    const permit = await settle(world, "permit-23");
    const cell = permit.fiber.find((c) => c.predicate === "within-window");
    assert.ok(cell, "the within-window cell should exist");
    assert.equal(cell.value.glyph, "⊤", "within-window/overdue should settle to ⊤");
    const r = richness(permit);
    assert.ok(r.contested >= 1, `expected contested ≥ 1, got ${r.contested}`);
  });

  // --- trade: fiber exchange (dual-filed + superseding located-in) ----------------------------
  await ok("trade moves an item between two holders; both legs reflected in locationOf + containedBy", async () => {
    // the brass bell starts in harbor-district; the clam rake in the-marsh. A two-legged swap
    // hands the bell to `you` and the rake to takeshi-aoki.
    assert.equal(await locationOf(world, "a-brass-bell"), "harbor-district");
    assert.equal(await locationOf(world, "a-clam-rake"), "the-marsh");

    const bellLog = join(world, "a-brass-bell.jsonl");
    const before = lineCount(bellLog);

    const result = await trade({
      root: world, t: "trade:000001",
      give: { item: "a-brass-bell", to: "you" },
      take: { item: "a-clam-rake", to: "takeshi-aoki" },
    });

    assert.equal(result.legs.length, 2, "a two-legged trade records two rows");

    // leg A — the bell now belongs to you (functional supersession).
    assert.equal(await locationOf(world, "a-brass-bell"), "you");
    assert.ok((await containedBy(world, "you")).includes("a-brass-bell"),
      "dual filing: the bell shows in your contents (double-entry credit)");
    assert.ok(!(await containedBy(world, "harbor-district")).includes("a-brass-bell"),
      "the giver no longer holds the bell (double-entry debit)");

    // leg B — the rake now belongs to the harbormaster.
    assert.equal(await locationOf(world, "a-clam-rake"), "takeshi-aoki");
    assert.ok((await containedBy(world, "takeshi-aoki")).includes("a-clam-rake"));

    // append-only: the bell's log only GREW (the new located-in superseded by read, not by edit).
    assert.ok(lineCount(bellLog) > before, "trade only appends");

    // the quote: richnessBefore/After report the holders.
    assert.ok(result.richnessBefore.you && result.richnessAfter.you, "the swap quotes you");
    assert.ok(result.richnessBefore["takeshi-aoki"], "the swap quotes the harbormaster");
  });

  await ok("a one-sided gift is trade with only a give", async () => {
    assert.equal(await locationOf(world, "a-storm-lantern"), "south-point-light");
    const result = await trade({
      root: world, t: "trade:000002",
      give: { item: "a-storm-lantern", to: "you" },
    });
    assert.equal(result.legs.length, 1, "a gift is a single leg");
    assert.equal(await locationOf(world, "a-storm-lantern"), "you");
    assert.ok((await containedBy(world, "you")).includes("a-storm-lantern"));
  });

  console.log(`\n${pass} economy checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
