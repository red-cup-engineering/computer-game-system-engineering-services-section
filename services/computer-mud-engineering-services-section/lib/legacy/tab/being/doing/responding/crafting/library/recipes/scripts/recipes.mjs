// recipes — materials + recipes + tools → a QUALITY output item. `recipes/` nests under
// `crafting/` because it DEEPENS craft.mjs's fiber-fusion craft with the production economy the
// trades actually run on: a recipe consumes COUNTED material items of a kind, requires a TOOL of
// a kind, and the maker's TAUGHT depth in the recipe's skill + the materials' and tool's quality
// determine the OUTPUT QUALITY. craft.mjs composes ingredient fibers; this layer is the bill of
// materials + the quality interlock (RimWorld's quality tiers: better stock + better tool + more
// skill → a finer output), kept beside craft.mjs (which it does not touch), not inside it.
//
// A material item bears  material=<kind> (e.g. "iron","oak","wool"), quality=<1..10>, and lives
// located-in its maker (a carried item). A tool item bears tool=<kind> (e.g. "hammer","saw") and
// optionally quality. Skills ACCRUE as skill:<dotted.path> cells; the maker's TAUGHT depth in a
// recipe's skill = the count of positive skill:<recipe.skill> cells on its settled fiber.
//
// RECIPES is DATA: name -> { inputs:[{material,count}], tool:<kind>|null, skill, output }. Adding
// a recipe is permissionless content, mirroring craft.mjs's data-recipes.
//
// OUTPUT QUALITY (deterministic, no RNG/Date):
//   quality = clamp(1,10, round( (taught + meanMaterialQuality + toolQuality) / 3 ))
//     taught              = count of positive skill:<recipe.skill> cells on the maker
//     meanMaterialQuality = mean `quality` of the CONSUMED material items (default 5 if unmarked)
//     toolQuality         = the tool item's `quality` (default 5; 5 too when the recipe needs no tool)
//
// CONSUMPTION POLICY: the consumed material items are RELOCATED out of the world's places by
// retracting their located-in (append-only v:null tombstone — craft.mjs's policy), so they are no
// longer carried by (containedBy) the maker; their history stays on the trace. The output item is
// minted content-addressed (made:<hash> of maker+recipe+t) and located-in the maker, carrying the
// recipe's static output cells PLUS a quality cell = the output quality.
//
// listRecipes() -> names
// canCraft(root, maker, recipeName) -> { ok, missing:[...], have:{...} }
// craftFrom(root, maker, recipeName, t) -> { output, quality, consumed:[ids] } | { error, missing }

import { settle, containedBy, rowsFor } from "#substrate";
import { rowId } from "#eavt-row";
import { holds } from "#value";
import doing, { retract } from "#doing";

// --- the catalog: ~8 recipes across trades. DATA, not code. -----------------------------------
export const RECIPES = Object.freeze({
  nail: {
    inputs: [{ material: "iron", count: 1 }],
    tool: "hammer",
    skill: "crafting.smithing.black",
    output: { kind: "item", naming: "an iron nail" },
  },
  blade: {
    inputs: [{ material: "iron", count: 2 }],
    tool: "hammer",
    skill: "crafting.smithing.weapon",
    output: {
      kind: "item",
      naming: "a forged blade",
      "weapon-damage": 10,
      "weapon-skill": "fighting.melee.sword",
    },
  },
  plank: {
    inputs: [{ material: "oak", count: 1 }],
    tool: "saw",
    skill: "crafting.carpentry",
    output: { kind: "item", naming: "an oak plank" },
  },
  coat: {
    inputs: [{ material: "wool", count: 3 }],
    tool: "needle",
    skill: "crafting.tailoring",
    output: {
      kind: "item",
      naming: "a wool coat",
      "armor-protection": 3,
      "armor-covers": "torso",
    },
  },
  rope: {
    inputs: [{ material: "hemp", count: 2 }],
    tool: null,
    skill: "crafting.ropemaking",
    output: { kind: "item", naming: "a coil of rope" },
  },
  candle: {
    inputs: [{ material: "tallow", count: 1 }, { material: "flax", count: 1 }],
    tool: null,
    skill: "crafting.chandlery",
    output: { kind: "item", naming: "a tallow candle", "light-radius": 2 },
  },
  stew: {
    inputs: [{ material: "meat", count: 1 }, { material: "root", count: 2 }],
    tool: "pot",
    skill: "crafting.cooking",
    output: { kind: "item", naming: "a bowl of stew", "provides": "need:hunger" },
  },
  lockpick: {
    inputs: [{ material: "iron", count: 1 }],
    tool: "file",
    skill: "crafting.smithing.fine",
    output: { kind: "item", naming: "a slender lockpick", "tool": "lockpick" },
  },
});

// listRecipes — the names this catalog can craft.
export function listRecipes() {
  return Object.keys(RECIPES);
}

// QUALITY DEFAULTS: an unmarked material or tool reads as the midpoint 5, so a recipe still
// crafts and quality stays in band.
const DEFAULT_QUALITY = 5;

const clamp = (lo, hi, n) => (n < lo ? lo : n > hi ? hi : n);

// cellOf — read the latest positive-evidence object for `predicate` off a settled fiber, or null.
function cellOf(thing, predicate) {
  const cell = thing.fiber.find((c) => c.predicate === predicate && holds(c.value));
  return cell ? cell.object : null;
}

// qualityOf — a settled item's `quality` cell as an integer, or DEFAULT_QUALITY when unmarked.
function readQuality(thing) {
  const q = cellOf(thing, "quality");
  const n = Math.round(Number(q));
  return Number.isFinite(n) ? n : DEFAULT_QUALITY;
}

// taughtOf — the maker's TAUGHT depth in `skill`: the count of accrued positive skill:<skill>
// rows on its trace. Skill cells ACCRUE (one row per success, distinct `t`), so the COUNT of
// rows is the depth. We read raw rows (rowsFor) rather than the settled fiber because being's
// fold aggregates identical {predicate,object} cells into one — the trace keeps every accrual.
// LOCAL to this morphism (no #proficiency import) per the cell model.
async function taughtOf(root, maker, skill) {
  const pred = `skill:${skill}`;
  const rows = await rowsFor(root, maker);
  return rows.filter((r) => r.e === maker && r.a === pred && r.v !== null && r.v !== false).length;
}

// carried — the items the maker currently carries: containedBy(root, maker), settled, keeping
// their material/tool/quality reading. Returns [{ id, material, tool, quality }].
async function carried(root, maker) {
  const ids = await containedBy(root, maker);
  const items = [];
  for (const id of ids) {
    const thing = await settle(root, id);
    items.push({
      id,
      material: cellOf(thing, "material"),
      tool: cellOf(thing, "tool"),
      quality: readQuality(thing),
    });
  }
  return items;
}

// pickInputs — from the maker's carried items, choose enough of each input kind to fill the
// recipe's bill. Returns { ok, missing:[{material,count,have}], chosen:[{id,quality}] }. The
// chosen ids are the specific material items to consume (deterministic: containedBy is sorted).
function pickInputs(recipe, items) {
  const used = new Set();
  const chosen = [];
  const missing = [];
  for (const { material, count } of recipe.inputs ?? []) {
    const matches = items.filter((it) => it.material === material && !used.has(it.id));
    if (matches.length < count) {
      missing.push({ material, count, have: matches.length });
      continue;
    }
    for (let i = 0; i < count; i += 1) {
      used.add(matches[i].id);
      chosen.push({ id: matches[i].id, quality: matches[i].quality });
    }
  }
  return { ok: missing.length === 0, missing, chosen };
}

// pickTool — find a carried tool of the required kind. Returns { ok, tool:{id,quality}|null }.
// A recipe with tool:null needs no tool (ok:true, tool:null).
function pickTool(recipe, items) {
  if (recipe.tool == null) return { ok: true, tool: null };
  const t = items.find((it) => it.tool === recipe.tool);
  return t ? { ok: true, tool: { id: t.id, quality: t.quality } } : { ok: false, tool: null };
}

// canCraft — does the maker carry enough of each material kind (by material cell + count) and the
// required tool kind? Pure read. { ok, missing:[...], have:{...} } where `have` reports the counts
// the maker carries per required material kind and whether the tool is present.
export async function canCraft(root, maker, recipeName) {
  const recipe = RECIPES[recipeName];
  if (!recipe) return { ok: false, missing: [{ recipe: recipeName, reason: "unknown recipe" }], have: {} };

  const items = await carried(root, maker);
  const { ok: matOk, missing: matMissing } = pickInputs(recipe, items);
  const { ok: toolOk } = pickTool(recipe, items);

  const have = {};
  for (const { material } of recipe.inputs ?? []) {
    have[material] = items.filter((it) => it.material === material).length;
  }
  if (recipe.tool != null) have[`tool:${recipe.tool}`] = items.some((it) => it.tool === recipe.tool);

  const missing = [...matMissing];
  if (!toolOk) missing.push({ tool: recipe.tool });

  return { ok: matOk && toolOk, missing, have };
}

// outputId — a deterministic, content-addressed id for the crafted item. Built from the fields
// that define the craft act (maker, recipe name, tick), so a replay of the identical act at the
// identical tick mints the identical item. `made:` prefix marks it a crafted item.
function outputId(maker, recipeName, t) {
  const id = rowId({ e: maker, a: `made:${recipeName}`, v: maker, t });
  return `made:${id.slice("row:".length)}`;
}

// craftFrom — consume the inputs and mint the quality output. On success returns
// { output, quality, consumed:[ids] }; on failure (insufficient material or missing tool) returns
// { error, missing } and writes NOTHING (checked before any append — atomic-ish, craft.mjs's rule).
export default async function craftFrom(root, maker, recipeName, t) {
  if (!root || !maker || !recipeName || t == null) {
    throw new TypeError("craftFrom: root, maker, recipeName, t are required");
  }
  const recipe = RECIPES[recipeName];
  if (!recipe) return { error: "unknown recipe", missing: [{ recipe: recipeName }] };

  const items = await carried(root, maker);
  const picked = pickInputs(recipe, items);
  const tool = pickTool(recipe, items);
  if (!picked.ok || !tool.ok) {
    const missing = [...picked.missing];
    if (!tool.ok) missing.push({ tool: recipe.tool });
    return { error: "cannot craft", missing };
  }

  // OUTPUT QUALITY — deterministic, fiber-derived (no RNG/Date).
  const taught = await taughtOf(root, maker, recipe.skill);
  const meanMaterialQuality =
    picked.chosen.reduce((s, c) => s + c.quality, 0) / picked.chosen.length;
  const toolQuality = tool.tool ? tool.tool.quality : DEFAULT_QUALITY;
  const quality = clamp(1, 10, Math.round((taught + meanMaterialQuality + toolQuality) / 3));

  // Check-first done; now write. Deterministic per-row t derived from the passed t.
  let seq = 0;
  const tick = () => `${t}/${++seq}`;
  const output = outputId(maker, recipeName, t);

  // Mint the output: each static output cell, then the quality cell, then located-in the maker.
  for (const [predicate, object] of Object.entries(recipe.output)) {
    await doing({ root, agent: maker, subject: output, predicate, object, t: tick() });
  }
  await doing({ root, agent: maker, subject: output, predicate: "quality", object: quality, t: tick() });
  await doing({ root, agent: maker, subject: output, predicate: "located-in", object: maker, t: tick() });

  // Consume the inputs: retract each consumed material's located-in (append-only tombstone — it
  // leaves the maker's carry; its history is preserved).
  const consumed = [];
  for (const { id } of picked.chosen) {
    await retract({ root, subject: id, predicate: "located-in", t: tick() });
    consumed.push(id);
  }

  return { output, quality, consumed };
}

// --- CLI guard: node recipes.mjs <world> <maker> <recipe> [t] ---------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , world, maker, recipeName, t] = process.argv;
  if (!world || !maker || !recipeName) {
    console.error(`usage: node recipes.mjs <world> <maker> <recipe> [t]\nrecipes: ${listRecipes().join(", ")}`);
    process.exit(2);
  }
  const result = await craftFrom(world, maker, recipeName, t ?? "craft:000001");
  console.log(JSON.stringify(result, null, 2));
}
