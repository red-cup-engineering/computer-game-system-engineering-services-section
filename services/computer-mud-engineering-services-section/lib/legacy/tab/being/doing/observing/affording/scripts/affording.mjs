// affording — the COMPUTED action menu. `affording/` nests under `observing/` as a sibling of
// `look`: it is a reading of the world that changes nothing and returns the moves that would
// compose non-trivially with the actor's situation. The world-sim: "the available actions are
// COMPUTED, not listed — whatever messages produce non-⊥ when composed with nearby fibers."
//
// This is the menu a player's session or an npc's respond() chooses from. v1 computes the three
// always-present spatial affordances from the actor's place and inventory — movement (exits that
// hold), take (co-located items), drop (carried items) — each filtered for non-triviality (a
// move that wouldn't change settlement is dropped). Richer, fiber-derived affordances (use a
// tool, talk to an actor) are respond()-driven and come later.
//
// affording({ root, actor }) -> [{ verb, object, message:{predicate,object}, why }]

import { settle, containedBy, locationOf } from "#substrate";
import { holds } from "#value";
import { look } from "#observing";

// isActor — an entity is an actor (not a takeable item) iff its fiber holds a `mover` cell.
async function isActor(root, id) {
  const thing = await settle(root, id);
  return thing.fiber.some((c) => c.predicate === "mover" && holds(c.value));
}

export default async function affording({ root, actor }) {
  if (!root || !actor) throw new TypeError("affording: root and actor are required");
  const loc = await locationOf(root, actor);
  if (!loc) return [];
  const place = await look({ root, observer: actor, subject: loc });
  const out = [];

  // movement — every exit that holds is a non-trivial `located-in` change (destination ≠ here).
  for (const [dir, dest] of Object.entries(place.exits)) {
    if (dest === loc) continue;
    out.push({ verb: "go", object: dir, message: { predicate: "located-in", object: dest }, why: `exit-${dir} holds` });
  }

  // take — co-located items (not the actor, not other actors). Non-trivial: not already carried.
  for (const id of place.contents) {
    if (id === actor) continue;
    if (await isActor(root, id)) continue;
    out.push({ verb: "take", object: id, message: { predicate: "located-in", object: actor }, why: `${id} is here` });
  }

  // drop — anything the actor carries returns to the current place.
  for (const id of await containedBy(root, actor)) {
    out.push({ verb: "drop", object: id, message: { predicate: "located-in", object: loc }, why: `you carry ${id}` });
  }

  return out;
}
