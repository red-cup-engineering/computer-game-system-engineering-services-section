// prove-federation — cross-instance federation. Two worlds merge by content-addressed G-Set
// union; identity is the SHA-256 rowId, so a row present in both collapses; dual filing is
// restored on receipt (a federated `located-in` becomes a local `containedBy` read). Same harness.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import doing from "#doing";
import federate, { mergeWorlds, admit } from "#federate";
import { settle, containedBy, locationOf, allRows, subjects } from "#substrate";
import { rowId } from "#eavt-row";
import buildFarstone from "./fixtures/build-fixture.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-fed-"));
const home = join(tmp, "home");      // a full Farstone
const away = join(tmp, "away");      // another instance with a wanderer

try {
  await buildFarstone(home);
  await buildFarstone(away);
  // On the AWAY instance, a wanderer stands in the harbor (a place that also exists at home).
  await doing({ root: away, subject: "wanderer", predicate: "kind", object: "player", t: "seed:990001" });
  await doing({ root: away, subject: "wanderer", predicate: "naming", object: "a wanderer", t: "seed:990002" });
  await doing({ root: away, subject: "wanderer", predicate: "located-in", object: "harbor-district", t: "seed:990003" });

  await ok("a single entity walks across (migrate) with identity preserved", async () => {
    const before = await subjects(home);
    assert.ok(!before.includes("wanderer"), "home doesn't know the wanderer yet");
    const { added } = await federate({ from: away, into: home, entity: "wanderer" });
    assert.ok(added >= 3);
    // identity = content-address: the wanderer's rows have the SAME rowIds in both worlds.
    const awayIds = (await allRows(away)).filter((r) => r.e === "wanderer").map(rowId).sort();
    const homeIds = (await allRows(home)).filter((r) => r.e === "wanderer").map(rowId).sort();
    assert.deepEqual(homeIds, awayIds, "same SHA-256 identity on both instances");
  });

  await ok("dual filing is restored on receipt (a federated located-in is a local read)", async () => {
    // the wanderer's located-in:harbor-district must re-file at home's harbor-district anchor.
    assert.equal(await locationOf(home, "wanderer"), "harbor-district");
    assert.ok((await containedBy(home, "harbor-district")).includes("wanderer"),
      "harbor-district now contains the wanderer locally");
  });

  await ok("migration is idempotent (G-Set: a second crossing adds nothing)", async () => {
    const { added } = await federate({ from: away, into: home, entity: "wanderer" });
    assert.equal(added, 0, "already admitted");
  });

  await ok("mergeWorlds unions whole instances, conflict-free", async () => {
    // build a third instance with one extra fact, merge it home; only the new row is added.
    const other = join(tmp, "other");
    await buildFarstone(other);
    await doing({ root: other, subject: "south-point-light", predicate: "rumor", object: "a ghost light", t: "seed:995000" });
    const { added } = await mergeWorlds(other, home);
    assert.equal(added, 1, "only the single new fact crosses; the shared world dedups");
    const light = await settle(home, "south-point-light");
    assert.ok(light.fiber.some((c) => c.predicate === "rumor"));
  });

  await ok("admit rejects malformed rows at the boundary", async () => {
    await assert.rejects(admit(home, "x", [{ e: "x", a: "y", v: 1 }]), /row/); // missing t
  });

  console.log(`\n${pass} federation checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
