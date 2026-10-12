# Nested self-forming component topology

A derivation note: how FizzOS constructs its world out of nested components that are formed from each other, read off the ecosystem's own pattern.

## The pattern (from the corpus)

Across the stack, every object is built the same way — a noun is *formed* from a finer noun by a gerund morphism, nested under it, recursively:

```
agent →(actuating)→ actuator →(embodying)→ body →(integrating)→ drone →(swarming)→ swarm
```

The swarm-intelligence journal states the load-bearing fact: **"the runtime is an inverse-limit image of the abstract object."** The whole is the limit of its nested parts; its state is the fold of theirs.
Names follow the *gerund + variance* discipline: morphisms are gerund verbs, objects are nouns, and each morphism declares its variance.

## The reading for FizzOS

FizzOS already nests by two morphisms:

- `located-in` — a thing in a place (the linear, conserving one);
- `part-of` — a room of a ship, a cell of a region.

Read as ONE recursive **component tree**, every place/thing is a component, and the path from the world down to a thing is a chain of these nesting morphisms:

```
world ⊃ region ⊃ ocean-cell ⊃ ship ⊃ room ⊃ thing      (located-in / part-of)
```

Two directions fall out, and `@emsenn/fizzos/components` realizes both:

1. **Forming (parts → whole).** A super-component's state is *folded up* from its sub-components.
  `aggregateNumber` sums a manifest (a fleet's hull = Σ its ships'); `aggregateCharge` folds a charge by the **bilattice knowledge-join** (a region's ecology = the join of its cells').
  Because the join is paraconsistent, a sea where some cells thrive (`potential`) and some are dead (`active`) reads `stable` — the contested whole, *held* rather than averaged away.
  This is the inverse-limit image of the nested cover, and it is *the same* knowledge-join the world settles by — not a new mechanism.
  (Verified: `survey` reads both a cell and the Fizzwater Sound entire.)

2. **Carrying (whole moves → parts come along).** Moving a component is one functional `located-in` retraction on it; its whole subtree was only ever nested *within* it, so it moves for free.
  The ship-carries-crew invariant generalizes to any depth: a region could drift carrying its cells carrying their ships carrying their crews.
  Conservation carries the colimit; nothing tracks membership.

## Why this is the right construction

- It is **uniform**: rooms, ships, ocean cells, regions, and the world are one recursive component type, distinguished only by their tags and their nesting morphism — no bespoke "ship vs room vs region" containment code.
- It is **theory-true**: forming = the knowledge-join (relating), the whole = the inverse-limit (the corpus's stated shape), movement = conservation (linear `located-in`).
- It **composes upward without limit**: fleets of ships, archipelagos of regions, federations of harbors — each a component folded from the one below, the same way the corpus folds agents into swarms.

The primitives live in `components.mts` (`subtreeOf`, `childrenOf`, `aggregateCharge`, `aggregateNumber`); the first application is region-level ecology in `scene.survey`.
