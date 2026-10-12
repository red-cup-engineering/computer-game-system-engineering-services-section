// craft — Minecraft-style crafting as FIBER FUSION. `crafting/` nests under `responding/`
// because a craft is just a fold of `composes` (respond's ⊥-test) across a recipe's required
// input cells: a recipe is a COMPOSITION of input item fibers → an output item. Recipes are
// DATA, not code — adding one is permissionless content, mirroring npc `intends` rules.
//
// A recipe = { requires:[{predicate,object}], yields:{ id, cells:[{predicate,object}] } }. Each
// requirement is MET iff SOME input's settled fiber `composes` a message-mark on that channel:
// message = { channel:req.predicate, payload:{[req.predicate]:req.object} }. composes() is true
// when the fusion ⊙ of the message-mark with a bearing cell is non-⊥ — i.e. the input fiber
// SPEAKS to that ingredient. Crafting SUCCEEDS iff every requirement is met.
//
// On success: mint the output by `doing` each yields.cell onto yields.id (attributed to the
// agent), and CONSUME each input by `retract`ing its `located-in` (append-only tombstone). On
// failure (a missing ingredient → ⊥): NO writes at all (checked before writing — atomic-ish).
// DETERMINISTIC: every appended row's `t` is derived from the passed `t` (no RNG/Date).
//
// craft({ root, agent, recipe, inputs, t }) -> { ok, output?, appended, missing? }
// canCraft({ root, recipe, inputs }) -> boolean

import { settle } from "#substrate";
import { composes } from "#responding";
import doing, { retract } from "#doing";

// markFor — the message that probes whether an input bears the ingredient `req`. The channel
// names the ingredient's predication; the payload re-points the same key at it so a cell whose
// predicate === req.predicate is the one that bears (respond's bears-rule). Composition with a
// non-⊥ result means the input's fiber affirms (or contests) that ingredient.
const markFor = (req) => ({ channel: req.predicate, payload: { [req.predicate]: req.object } });

// metBy — does ANY of the settled input fibers compose the requirement `req`? Returns the input
// id that satisfies it (for consumption bookkeeping), or null when no input speaks to it.
function metBy(req, settledInputs) {
  for (const [id, fiber] of settledInputs) {
    // a requirement names BOTH a predicate and an object; composes() checks the channel, so we
    // also confirm the bearing cell carries the required object (the specific ingredient value).
    if (!composes(fiber, markFor(req))) continue;
    const bears = fiber.fiber.some((c) => c.predicate === req.predicate && c.object === req.object);
    if (bears) return id;
  }
  return null;
}

// settleInputs — settle every input id to its current fiber. inputs is { id: ... } (the value is
// ignored; presence/identity is what matters — each key is an entity id in the world).
async function settleInputs(root, inputs) {
  const ids = Array.isArray(inputs) ? inputs : Object.keys(inputs); // accept an array OR object of ids
  const settled = new Map();
  for (const id of ids) settled.set(id, await settle(root, id));
  return settled;
}

// resolve — pure: which requirements are unmet, and which input satisfies each met one. No writes.
async function resolve(root, recipe, inputs) {
  const settled = await settleInputs(root, inputs);
  const missing = [];
  const consumes = new Set(); // input ids to consume on success
  for (const req of recipe.requires ?? []) {
    const id = metBy(req, settled);
    if (id === null) missing.push(req);
    else consumes.add(id);
  }
  return { missing, consumes: [...consumes] };
}

export async function canCraft({ root, recipe, inputs }) {
  if (!root || !recipe || !inputs) throw new TypeError("canCraft: root, recipe, inputs are required");
  const { missing } = await resolve(root, recipe, inputs);
  return missing.length === 0;
}

export default async function craft({ root, agent, recipe, inputs, t }) {
  if (!root || !recipe || !inputs || t == null) {
    throw new TypeError("craft: root, recipe, inputs, t are required");
  }
  if (!recipe.yields || !recipe.yields.id || !Array.isArray(recipe.yields.cells)) {
    throw new TypeError("craft: recipe.yields needs { id, cells:[] }");
  }

  // Check FIRST, write second — no partial crafts. A missing ingredient short-circuits cleanly.
  const { missing, consumes } = await resolve(root, recipe, inputs);
  if (missing.length > 0) return { ok: false, missing, appended: [] };

  const appended = [];
  let seq = 0;
  const tick = () => `${t}/${++seq}`; // deterministic per-row t derived from the passed t

  // Mint the output: doing each yields cell onto the output entity, attributed to the agent.
  for (const cell of recipe.yields.cells) {
    const { row } = await doing({
      root, agent, subject: recipe.yields.id, predicate: cell.predicate, object: cell.object, t: tick(),
    });
    appended.push(row);
  }

  // Consume the inputs: retract each consumed input's located-in (append-only tombstone — the
  // item leaves the world's places; its history is preserved).
  for (const id of consumes) {
    const { row } = await retract({ root, subject: id, predicate: "located-in", t: tick() });
    appended.push(row);
  }

  return { ok: true, output: recipe.yields.id, appended };
}

// --- CLI guard: node craft.mjs <world> <recipeJsonFile> [agent] -------------------------------
// The recipe JSON file is { requires, yields, inputs }. Crafts and prints the result.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , world, recipeFile, agent = "smith"] = process.argv;
  if (!world || !recipeFile) {
    console.error("usage: node craft.mjs <world> <recipeJsonFile> [agent]");
    process.exit(2);
  }
  const { readFile } = await import("node:fs/promises");
  const spec = JSON.parse(await readFile(recipeFile, "utf8"));
  const { inputs = {}, ...recipe } = spec;
  const result = await craft({ root: world, agent, recipe, inputs, t: "craft:000001" });
  console.log(JSON.stringify(result, null, 2));
}
