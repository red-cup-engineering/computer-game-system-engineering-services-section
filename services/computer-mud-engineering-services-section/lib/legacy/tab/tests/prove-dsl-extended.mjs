// prove-dsl-extended — the DSL gaps the demo world surfaced: describing, first-class feuds
// (rivals/allies → opinion-of), converse declarations, perceives, and state-aware `intends`
// ({need,below} / {mood}). Same tiny harness as the other suites.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import compile, { loadWorld, lint } from "#dsl";
import { settle, rowsFor } from "#substrate";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const good = {
  areas: [{ id: "hall", name: "The Hall", biome: "town", describing: "a long stone hall", exits: {} }],
  npcs: [
    {
      id: "ada", name: "Ada", "located-in": "hall", home: "hall", traits: ["kind"],
      needs: { hunger: 50, rest: 50, recreation: 50 },
      describing: "a steady hand", rivals: ["bo"], perceives: ["naming", "ringing"],
      converse: { predicate: "within-window", to: "overdue" },
      intends: [
        { when: { need: "hunger", below: 30 }, do: { predicate: "saying", object: "I'm hungry" } },
        { when: { mood: "breaking" }, do: { predicate: "saying", object: "I can't go on" } },
      ],
    },
    { id: "bo", name: "Bo", "located-in": "hall", home: "hall", traits: ["greedy"],
      needs: { hunger: 50, rest: 50, recreation: 50 }, allies: ["ada"] },
  ],
};

const tmp = mkdtempSync(join(tmpdir(), "tab-dslx-"));
const world = join(tmp, "w");

try {
  await ok("lint is clean on a definition using every new field", async () => {
    assert.deepEqual(lint(good), []);
  });

  await ok("describing is emitted on areas and npcs", async () => {
    const rows = compile(good);
    assert.ok(rows.some((r) => r.subject === "hall" && r.predicate === "describing"));
    assert.ok(rows.some((r) => r.subject === "ada" && r.predicate === "describing"));
  });

  await ok("rivals/allies become first-class opinion-of cells", async () => {
    const rows = compile(good);
    const op = rows.filter((r) => String(r.predicate).startsWith("opinion-of"));
    assert.ok(op.some((r) => r.subject === "ada" && r.object === "rival"), "ada rivals bo");
    assert.ok(op.some((r) => r.subject === "bo" && r.object === "friend"), "bo allies ada");
  });

  await ok("perceives (the Umwelt) is emitted", async () => {
    const rows = compile(good);
    const p = rows.filter((r) => r.subject === "ada" && r.predicate === "perceives").map((r) => r.object);
    assert.ok(p.includes("naming") && p.includes("ringing"));
  });

  await ok("state-aware intends carry the rich `when` forms", async () => {
    const rows = compile(good).filter((r) => r.predicate === "intends");
    assert.ok(rows.some((r) => r.object?.when?.need === "hunger" && r.object?.when?.below === 30));
    assert.ok(rows.some((r) => r.object?.when?.mood === "breaking"));
  });

  await ok("loadWorld writes a readable world + the converse declaration", async () => {
    await loadWorld(world, good);
    const ada = await settle(world, "ada");
    assert.ok(ada.fiber.some((c) => c.predicate === "describing"));
    assert.ok(ada.fiber.some((c) => c.predicate.startsWith("opinion-of") && c.object === "rival"));
    // the converse is applied at load time (declareConverse files a has-converse row on the log).
    const rows = await rowsFor(world, "ada");
    assert.ok(rows.some((r) => r.a === "has-converse" && r.v === "overdue"), "within-window↦overdue declared");
  });

  await ok("lint catches a bad need name, a non-numeric below, and an unknown rival", async () => {
    const bad = JSON.parse(JSON.stringify(good));
    bad.npcs[0].intends[0].when.need = "banana";       // not a real need
    bad.npcs[0].intends[1] = { when: { need: "hunger", below: "lots" }, do: { predicate: "x", object: "y" } };
    bad.npcs[1].allies = ["nobody"];                    // unknown id
    const issues = lint(bad);
    assert.ok(issues.length >= 3, `expected ≥3 issues, got ${issues.length}: ${JSON.stringify(issues)}`);
  });

  console.log(`\n${pass} DSL-extended checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
