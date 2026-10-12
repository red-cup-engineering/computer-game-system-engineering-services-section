// observing — an actor's FINITE KNOWABLE projection (their stream-of-world). `observing/`
// nests inside `doing/` because to observe is to enact a sensing cut — a doing that returns a
// projection without changing the world.
//
// Not a row filter: the descent localized to an observer. (i) the observer's SENSORY FRONTIER
// — the rows their apparatus can sense (their own cuts + ambient world; substrate.frontier);
// (ii) SETTLE that frontier under the observer's view (being), with functional supersession;
// (iii) PROJECT the settled view through the observer's `perceives` (their Umwelt) to the
// finite knowable. Sense (frontier) ≠ know (settled + projected). Two actors in the same place
// observe different worlds because their `perceives` select different predications.
//
// observing({ root, observer, subject }) -> { thing, shp }

import { settle, containedBy } from "#substrate";
import { holds } from "#value";
import { rowsFor } from "#substrate";

// perceivesOf — the observer's Umwelt: the predications its apparatus can sense. Read from the
// observer's own `perceives` rows; empty/absent means "perceives everything" (a bare sensor).
async function perceivesOf(root, observer) {
  const rows = (await rowsFor(root, observer)).filter((r) => r.e === observer && r.a === "perceives");
  const set = new Set();
  for (const r of rows) if (typeof r.v === "string") set.add(r.v);
  return set;
}

export default async function observing({ root, observer, subject }) {
  const thing = await settle(root, subject, { observer });
  const perceives = await perceivesOf(root, observer);
  // The Umwelt projection: keep only cells whose predication the observer can sense. An empty
  // perceives-set is a bare sensor that perceives all predications.
  const knowable =
    perceives.size === 0
      ? thing.fiber
      : thing.fiber.filter((c) => perceives.has(c.predicate) || c.predicate.startsWith("exit-"));
  return { thing: { entity: thing.entity, fiber: knowable }, shp: renderShp(thing.entity, observer, knowable) };
}

// look — the MUD `look`: an actor's reading of a place. naming/describing/exit-<dir> are
// predications (not has-x fields); contents come from the converse of located-in via the
// place's object-anchor cache (the dual filing).
export async function look({ root, observer, subject }) {
  const thing = await settle(root, subject, { observer });
  const held = (p) => thing.fiber.filter((c) => c.predicate === p && holds(c.value)).map((c) => c.object);
  const exits = {};
  for (const c of thing.fiber) {
    if (c.predicate.startsWith("exit-") && holds(c.value)) exits[c.predicate.slice(5)] = c.object;
  }
  return {
    subject,
    observer,
    name: held("naming")[0] ?? subject,
    description: held("describing")[0] ?? null,
    exits,
    contents: await containedBy(root, subject),
  };
}

// renderShp — project a settled view to a finite self-hosting packet (the player's experience),
// carrying each mark's bilattice glyph so ⊤ situations are visible, not hidden.
function renderShp(entity, observer, fiber) {
  const cells = fiber
    .map((c) => `  ${c.value.glyph ?? "?"} ${c.predicate} ${JSON.stringify(c.object)}`)
    .join("\n");
  return `# ${entity} — as seen by ${observer}\n${cells}\n`;
}
