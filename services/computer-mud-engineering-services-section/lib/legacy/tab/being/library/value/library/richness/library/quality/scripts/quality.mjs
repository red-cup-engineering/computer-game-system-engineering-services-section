// quality — an item's `quality` cell read as a 0..1 BONUS the rest of the sim can lean on.
// `quality/` nests under `richness/` because both quote a settled fiber into a number without
// changing anything — richness scores a whole fiber, quality reads the single `quality=<0..100>`
// cell the ITEM convention defines. The interlock (RimWorld's quality tiers): a better tool makes
// a skilled action MORE likely to compose to t. So crafting/practice can add qualityBonus(item)
// to its odds — a deterministic, fiber-derived nudge, never a roll. Pure; zero deps beyond #value.
//
// qualityBonus(itemThing) -> Number in [0,1]
//   itemThing : a settled being { entity, fiber:[{ predicate:"quality", object:<0..100>, value, ...}] }
//   reads the first positive-evidence `quality` cell, clamps its object to 0..100, returns /100.
//   No quality cell (or no positive evidence) → 0 (an unmarked item gives no bonus).
// qualityOf(root, item, opts?) = qualityBonus(await settle(root, item)).
//   CLI: node quality.mjs <world> <item>

import { holds } from "#value";
import { settle } from "#substrate";

const MAX_QUALITY = 100;

export default function qualityBonus(itemThing) {
  if (!itemThing || !Array.isArray(itemThing.fiber)) {
    throw new TypeError("qualityBonus: itemThing must be a settled being { entity, fiber }");
  }
  const cell = itemThing.fiber.find((c) => c.predicate === "quality" && holds(c.value));
  if (!cell) return 0; // unmarked item → no bonus
  const q = Number(cell.object);
  if (!Number.isFinite(q)) return 0;
  return Math.min(MAX_QUALITY, Math.max(0, q)) / MAX_QUALITY;
}

export async function qualityOf(root, item, opts = {}) {
  return qualityBonus(await settle(root, item, opts.settle ?? {}));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, item] = process.argv.slice(2);
  if (!world || !item) {
    console.error("usage: node quality.mjs <world> <item>");
    process.exit(2);
  }
  console.log(JSON.stringify(await qualityOf(world, item)));
}
