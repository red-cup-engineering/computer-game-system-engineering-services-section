---
name: perception-as-umwelt-filter
description: Perception is fiber filtering, not a query — each actor perceives only the predications its apparatus can sense, so two actors in the same place experience different worlds. Grounds observing.mjs (frontier → settle → perceives filter) and the ambient-vs-attributed decision.
---

# Perception as Umwelt filter

The predication-world-sim borrows Uexküll's **Umwelt**: a tick on a branch and a bird in the
canopy share a forest but not an environment — each one's world is constituted by what its
capacities can sense. *"Each entity's fiber determines what it perceives, which determines its
environment."* `tab`'s `observing` is that, made of three steps:

1. **frontier** — the rows an observer's apparatus can sense: its own cuts, plus the *ambient*
   world (rows attributed to no one), plus public converse declarations. This is the agential-
   realist boundary: you know your own cuts and the shared world, not other agents' private cuts
   until you perceive them.
2. **settle** — fold that frontier (with functional supersession) into a `being`.
3. **the perceives filter** — keep only cells whose predication is in the observer's `perceives`
   set (its Umwelt). An empty `perceives` is a bare sensor that perceives everything.

So two actors looking at the same harbor see different things: the player (perceiving
naming/describing/ringing/phase) sees the bell ringing and the tide falling; an actor that
perceives only chemistry would see neither, but would see what the player cannot. Same place,
different worlds, because different fibers select different predications. The world is one set of
rows; the Umwelt is the non-⊥ region each fiber picks out.

## The ambient/attributed decision

This is why the seed and the tick are **ambient** (no agent): the shared world — places, items,
tide, ferry — must be perceivable by everyone, so it is attributed to no one. Only a genuine
actor-initiated move (the harbormaster tending the bell) is attributed, and so stays private until
another actor perceives it. Get this wrong (attribute the world to a "ground" agent) and `frontier`
hides the entire world from every observer — which is exactly the bug the first test run caught.

## Renderer, not generator

`observing` also projects to a small text packet (an SHP), carrying each cell's bilattice glyph so
a **⊤** is *shown*, not hidden. The renderer never invents: every line is a settled predication.
The world-sim is firm on this — *"the renderer is a formatter, not a generator."* The content is
the algebra's; language only formats it.

## Sources

- `.../predication-world-sim/predication-world-sim.md` §"Deeper: the Umwelt system", §"the perspective renderer"
- the archive's `articulating/doing/observing/scripts/observing.mjs` (frontier → settle → SHP)
