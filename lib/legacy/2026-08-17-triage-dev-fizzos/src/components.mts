/**
 * `@emsenn/fizzos/components` — the recursive component topology.
 *
 * The whole ecosystem builds its objects the same way: a thing is *formed* from finer
 * things by a gerund morphism, nested under it, recursively — `agent →(actuating)→
 * actuator →(embodying)→ body →(integrating)→ drone →(swarming)→ swarm`. The runtime is
 * "an inverse-limit image of the abstract object" (swarm-intelligence journal): the whole
 * is the limit of its nested parts, and its aggregate state is *folded up* from theirs.
 *
 * FizzOS already nests by two morphisms — `located-in` (a thing in a place) and `part-of`
 * (a room of a ship). This module reads that nesting as ONE recursive component tree and
 * gives the **forming** direction: a super-component's properties are computed from its
 * sub-components. A ship's manifest is its rooms' contents; a region's ecological health
 * is the **bilattice knowledge-join** of its cells' — so a sea where some cells thrive and
 * some are dead reads `stable`, the contested whole, the inverse-limit image. Move the
 * whole and the nested diagram comes along for free, because the parts were only ever
 * `located-in`/`part-of` it — conservation carries the colimit.
 */
import { type ChargeValueName, chargeValue, joinKnowledgeValue } from "@emsenn/relating";
import { type World, contentsOf, numberOf, valueOf } from "./world.mjs";

/** The immediate sub-components of a node: everything `located-in` it or `part-of` it. */
export function childrenOf(w: World, node: string): readonly string[] {
  return [...contentsOf(w, node), ...contentsOf(w, node, "part-of")];
}

/** Every component nested within a root, transitively (the root's whole subtree). */
export function subtreeOf(w: World, root: string): readonly string[] {
  const seen = new Set<string>();
  const stack = [...childrenOf(w, root)];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const child of childrenOf(w, node)) if (!seen.has(child)) stack.push(child);
  }
  return [...seen];
}

/**
 * Fold a charge-valued predicate up the subtree by the knowledge-join — the forming
 * direction. Agreement reinforces; opposing readings (a thriving cell and a dead one)
 * glue to the held contradiction `stable`. This is the component's state *formed from* its
 * parts, the inverse-limit image of the nested cover.
 */
export function aggregateCharge(w: World, root: string, predicate: string): ChargeValueName {
  let value: ChargeValueName = "absurd";
  for (const node of subtreeOf(w, root)) {
    const raw = valueOf(w, node, predicate);
    if (raw === null) continue;
    value = joinKnowledgeValue(chargeValue(value), chargeValue(raw as ChargeValueName)).name;
  }
  return value;
}

/** Sum a numeric predicate over the subtree — a manifest formed from the parts. */
export function aggregateNumber(w: World, root: string, predicate: string): number {
  let total = 0;
  for (const node of subtreeOf(w, root)) total += numberOf(w, node, predicate, 0);
  return total;
}
