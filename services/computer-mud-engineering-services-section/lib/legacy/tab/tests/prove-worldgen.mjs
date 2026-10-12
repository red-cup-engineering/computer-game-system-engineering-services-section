// prove-worldgen — the procedural world generator builds a SIZABLE, CONNECTED, VARIED, POPULATED
// stage, deterministically. Generates into UNIQUE /tmp dirs (never touches examples/) and asserts:
//   (a) the expected counts at defaults;
//   (b) the map is fully CONNECTED — BFS over exit-* reaches every area from any area;
//   (c) every region has ≥1 resource of each need type;
//   (d) every npc has traits, three in-range need cells, a home, and ≥1 skill;
//   (e) DETERMINISM — same seed ⇒ identical worlds (deduped row-id sets), different seeds ⇒ differ.
// Same tiny harness as prove-interaction.mjs.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { rowId, dedupe } from "#eavt-row";
import { settle, subjects, allRows } from "#substrate";
import generate from "../being/doing/changing/ticking/growing/worldgen/scripts/worldgen.mjs";

let pass = 0;
const ok = (name, fn) =>
  fn().then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
  );

const dirs = [];
const freshWorld = () => {
  const d = mkdtempSync(join(tmpdir(), "tab-wg-"));
  dirs.push(d);
  return join(d, "world");
};

// cellsOf — settle a subject and index its determined (t) cells by predicate → [objects].
async function cellsOf(root, subject) {
  const thing = await settle(root, subject);
  const by = new Map();
  for (const c of thing.fiber) {
    if (c.value.glyph !== "t") continue;
    if (!by.has(c.predicate)) by.set(c.predicate, []);
    by.get(c.predicate).push(c.object);
  }
  return by;
}

try {
  // Default generation, reused across several checks.
  const world = freshWorld();
  const out = await generate({ root: world });

  await ok("(a) default world has the expected counts", async () => {
    // defaults: regions=5, areasPerRegion=8 ⇒ 40 areas; npcs=16.
    assert.equal(out.regions.length, 5, "regions");
    assert.equal(out.areas.length, 40, "areas");
    assert.equal(out.npcs.length, 16, "npcs");
    // resources: (3 need-types + 1 extra) per region = 4 × 5 = 20.
    assert.equal(out.resources.length, 20, "resources");
    // items: max(regions*4, ceil(areas/2)) = max(20, 20) = 20.
    assert.equal(out.items.length, 20, "items");
  });

  await ok("(b) the map is fully CONNECTED — BFS over exit-* reaches every area", async () => {
    const areas = new Set(out.areas);
    // Build adjacency from each area's own exit-* cells.
    const adj = new Map();
    for (const a of out.areas) {
      const by = await cellsOf(world, a);
      const nbrs = [];
      for (const [pred, objs] of by) {
        if (pred.startsWith("exit-")) for (const o of objs) if (areas.has(o)) nbrs.push(o);
      }
      adj.set(a, nbrs);
    }
    // BFS from the first area.
    const start = out.areas[0];
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const cur = q.shift();
      for (const nx of adj.get(cur) ?? []) {
        if (!seen.has(nx)) { seen.add(nx); q.push(nx); }
      }
    }
    assert.equal(seen.size, areas.size, `reached ${seen.size} of ${areas.size} areas`);

    // And exits are SYMMETRIC enough that the reverse reachability holds too: BFS from a far area.
    const start2 = out.areas[out.areas.length - 1];
    const seen2 = new Set([start2]);
    const q2 = [start2];
    while (q2.length) {
      const cur = q2.shift();
      for (const nx of adj.get(cur) ?? []) {
        if (!seen2.has(nx)) { seen2.add(nx); q2.push(nx); }
      }
    }
    assert.equal(seen2.size, areas.size, "fully connected from a far node too");
  });

  await ok("(c) every region has ≥1 resource of each need type", async () => {
    // region → set of need-kinds provided by resources located in its areas.
    const areaRegion = new Map();
    for (const a of out.areas) {
      const by = await cellsOf(world, a);
      areaRegion.set(a, (by.get("region") ?? [])[0]);
    }
    const provided = new Map(out.regions.map((r) => [r, new Set()]));
    for (const res of out.resources) {
      const by = await cellsOf(world, res);
      const where = (by.get("located-in") ?? [])[0];
      const need = (by.get("provides") ?? [])[0];
      const region = areaRegion.get(where);
      assert.ok(region, `resource ${res} in a known area`);
      provided.get(region).add(need);
    }
    for (const r of out.regions) {
      for (const need of ["need:hunger", "need:rest", "need:recreation"]) {
        assert.ok(provided.get(r).has(need), `region ${r} provides ${need}`);
      }
    }
  });

  await ok("(d) every npc has traits, three in-range need cells, a home, ≥1 skill", async () => {
    const areas = new Set(out.areas);
    for (const npc of out.npcs) {
      const by = await cellsOf(world, npc);
      assert.equal((by.get("kind") ?? [])[0], "npc", `${npc} kind=npc`);
      assert.equal((by.get("mover") ?? [])[0], "tick", `${npc} mover=tick`);
      assert.ok((by.get("naming") ?? []).length >= 1, `${npc} has a naming`);
      assert.ok((by.get("trait") ?? []).length >= 1, `${npc} has ≥1 trait`);
      const home = (by.get("home") ?? [])[0];
      assert.ok(areas.has(home), `${npc} home is a real area`);
      assert.ok(areas.has((by.get("located-in") ?? [])[0]), `${npc} located in a real area`);
      for (const need of ["need:hunger", "need:rest", "need:recreation"]) {
        const v = (by.get(need) ?? [])[0];
        assert.equal(typeof v, "number", `${npc} ${need} is a number`);
        assert.ok(v >= 0 && v <= 100, `${npc} ${need}=${v} in 0..100`);
        assert.ok(v >= 60 && v <= 90, `${npc} ${need}=${v} starts satisfied 60..90`);
      }
      const skills = [...by.keys()].filter((p) => p.startsWith("skill:"));
      assert.ok(skills.length >= 1, `${npc} has ≥1 skill`);
    }
  });

  await ok("(e) DETERMINISM: same seed ⇒ identical worlds; different seeds ⇒ different", async () => {
    const wa = freshWorld();
    const wb = freshWorld();
    await generate({ root: wa, seed: 42 });
    await generate({ root: wb, seed: 42 });
    const idsA = dedupe(await allRows(wa)).map(rowId).sort();
    const idsB = dedupe(await allRows(wb)).map(rowId).sort();
    assert.deepEqual(idsA, idsB, "same seed → byte-identical row-id sets");

    const wc = freshWorld();
    await generate({ root: wc, seed: 43 });
    const idsC = dedupe(await allRows(wc)).map(rowId).sort();
    assert.notDeepEqual(idsA, idsC, "different seed → a different world");
  });

  await ok("(f) entity logs exist on disk for every generated id", async () => {
    const subs = new Set(await subjects(world));
    for (const id of [...out.areas, ...out.regions, ...out.npcs, ...out.resources, ...out.items]) {
      assert.ok(subs.has(id), `${id} owns a log`);
    }
  });

  console.log(`\n${pass} worldgen checks passed.`);
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}
