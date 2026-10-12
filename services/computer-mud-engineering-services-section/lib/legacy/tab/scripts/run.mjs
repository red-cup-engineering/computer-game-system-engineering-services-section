// run — the self-running world. The thin stateful shell around the pure operations: it does
// not hold the world in memory, it drives the disk. Two modes:
//
//   node scripts/run.mjs <world>            # run forever, one tick per interval (a daemon)
//   node scripts/run.mjs <world> --ticks N  # run N ticks then stop (bounded, for tests/demos)
//   node scripts/run.mjs <world> --replay   # don't tick; just settle & print every entity
//
// Crash recovery is free: the world IS the append-only log, so killing this process and
// restarting it loses nothing — the next tick reads the latest functional rows off disk and
// carries on. This mirrors qtmud's run-universe (a thread + a sleep + a schedule drain) and the
// swarm replay discipline (status is folded from the trace, never held in memory).

import { argv, exit } from "node:process";
import { subjects, settle } from "#substrate";
import ticking from "#ticking";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function replay(world) {
  const out = {};
  for (const s of await subjects(world)) {
    const thing = await settle(world, s);
    out[s] = Object.fromEntries(
      thing.fiber.map((c) => [`${c.predicate} ${JSON.stringify(c.object)}`, c.value.glyph]),
    );
  }
  return out;
}

async function main() {
  const args = argv.slice(2);
  const world = args.find((a) => !a.startsWith("--"));
  if (!world) {
    console.error(
      "usage: node scripts/run.mjs <world-dir> [--ticks N | --replay | --grow N | " +
        "--history <e> | --forks <e> | --richness <e>] [--interval MS]",
    );
    exit(2);
  }
  const flag = (f, d) => {
    const i = args.indexOf(f);
    return i >= 0 ? args[i + 1] : d;
  };

  if (args.includes("--replay")) {
    console.log(JSON.stringify(await replay(world), null, 2));
    return;
  }
  // Query / generation flags (read or grow the world, print, exit). Imported lazily so the
  // daemon path stays light.
  if (args.includes("--grow")) {
    const { default: grow } = await import("#growing");
    console.log(JSON.stringify(await grow({ root: world, generations: Number(flag("--grow", "0")) }), null, 2));
    return;
  }
  if (args.includes("--history")) {
    const { historyOf } = await import("#history");
    console.log(JSON.stringify(await historyOf(world, flag("--history")), null, 2));
    return;
  }
  if (args.includes("--forks")) {
    const { default: settleForks } = await import("#forking");
    const { base, forks, seams } = await settleForks(world, flag("--forks"));
    console.log(JSON.stringify({ cells: base.fiber.length, forks: forks.length, seams }, null, 2));
    return;
  }
  if (args.includes("--richness")) {
    const { richnessOf } = await import("#richness");
    console.log(JSON.stringify(await richnessOf(world, flag("--richness")), null, 2));
    return;
  }
  if (args.includes("--merge")) {
    const { mergeWorlds } = await import("#federate");
    console.log(JSON.stringify(await mergeWorlds(flag("--merge"), world), null, 2));
    return;
  }
  if (args.includes("--fork")) {
    const { fork } = await import("#timeline");
    await fork(world, flag("--fork"));
    console.log(`forked ${world} → ${flag("--fork")}`);
    return;
  }
  if (args.includes("--diff")) {
    const { diff } = await import("#timeline");
    const d = await diff(world, flag("--diff"));
    console.log(`shared ${d.shared}, only-here ${d.onlyA.length}, only-there ${d.onlyB.length}`);
    return;
  }
  if (args.includes("--storylog")) {
    const { default: storylog } = await import("#storylog");
    for (const e of await storylog(world)) console.log(`${e.t}  ${e.line}`);
    return;
  }
  if (args.includes("--inspect")) {
    const { default: inspect } = await import("#inspect");
    console.log(JSON.stringify(await inspect(world, flag("--inspect")), null, 2));
    return;
  }
  if (args.includes("--tension")) {
    const { worldTension } = await import("#directing");
    console.log(JSON.stringify(await worldTension(world), null, 2));
    return;
  }
  if (args.includes("--factions")) {
    const { default: factions } = await import("#factions");
    console.log(JSON.stringify(await factions(world), null, 2));
    return;
  }
  if (args.includes("--closure")) {
    const { closureOf } = await import("#closure");
    console.log(JSON.stringify(await closureOf(world, flag("--closure")), null, 2));
    return;
  }
  if (args.includes("--monologue")) {
    const { monologueOf } = await import("#monologuing");
    console.log((await monologueOf(world, flag("--monologue"))).join("\n") || "(no contradictions held)");
    return;
  }
  if (args.includes("--generate")) {
    const { default: generate } = await import("#worldgen");
    const out = await generate({ root: world, seed: Number(flag("--generate", "1")) });
    console.log(`generated ${out.areas.length} areas, ${out.regions.length} regions, ${out.npcs.length} npcs, ${out.resources.length} resources, ${out.items.length} items under ${world}`);
    return;
  }
  if (args.includes("--needs")) {
    const { needsOf } = await import("#needing");
    console.log(JSON.stringify(await needsOf(world, flag("--needs")), null, 2));
    return;
  }
  if (args.includes("--health")) {
    const { healthOf } = await import("#health");
    console.log(JSON.stringify(await healthOf(world, flag("--health")), null, 2));
    return;
  }
  if (args.includes("--load")) {
    const { readFileSync } = await import("node:fs");
    const { loadWorld, lint } = await import("#dsl");
    const def = JSON.parse(readFileSync(flag("--load"), "utf8"));
    const issues = lint(def);
    if (issues.length) { console.error(JSON.stringify(issues, null, 2)); exit(1); }
    const { written } = await loadWorld(world, def);
    console.log(`loaded ${written} rows from ${flag("--load")} into ${world}`);
    return;
  }

  const interval = Number(flag("--interval", "200")); // qtmud sleeps 0.2s between ticks
  const bounded = args.includes("--ticks");
  const limit = bounded ? Number(flag("--ticks", "1")) : Infinity;

  // Accelerate the loop with the in-memory runtime: the world's reads now hit RAM, appends keep
  // it live, and the on-disk log stays authoritative (the runtime is derived). This is what makes
  // a long simulation real-time. `--no-runtime` falls back to the pure-disk path.
  const { loadRuntime } = await import("#runtime");
  const { useRuntime, dropRuntime } = await import("#substrate");
  const accel = !args.includes("--no-runtime");
  if (accel) useRuntime(world, await loadRuntime(world));

  // The Storyteller/Director paces the world: every few ticks it reads world-tension and, if the
  // world has gone quiet, seeds ONE small pressure (it nudges, it never scripts). `--no-director`
  // turns it off; `--director-every N` sets the cadence.
  const director = !args.includes("--no-director");
  const directorEvery = Number(flag("--director-every", "5"));
  const { direct } = director ? await import("#directing") : { direct: null };

  try {
    const regen = !args.includes("--no-regen");
    for (let i = 0; i < limit; i += 1) {
      const { tick, appended } = await ticking({ root: world, regen });
      let note = "";
      if (director && tick % directorEvery === 0) {
        const { intervention } = await direct({ root: world, t: `tick:${String(tick).padStart(6, "0")}/direct` });
        if (intervention) note = `  · director seeded a pressure (${intervention.kind ?? "tension"})`;
      }
      console.log(`tick ${tick}: ${appended.length} changes${note}`);
      if (i + 1 < limit) await sleep(interval);
    }
  } finally {
    if (accel) dropRuntime(world);
  }
  if (bounded) console.log(`stopped after ${limit} tick(s); world is on disk at ${world}`);
}

main().catch((e) => {
  console.error(e);
  exit(1);
});
