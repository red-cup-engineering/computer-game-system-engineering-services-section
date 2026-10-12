---
name: paracosm-and-world-sim-fused
description: Fuses the repo's formal paracosm theory (reproducible paracosm RP(S)=Mod(S)/~_{J,N,O}) with the predication-world-sim vision. Argues that tab's running world IS Mod(S) made to run, and maps the reproducibility triad — gluing, normalization, bisimulation — onto tab's concrete machinery: dual-filed EAVT, the settlement fold, and the Umwelt projection.
---

# Paracosm and the world-sim, fused

Two streams in the repo describe the same thing from opposite ends and have never been joined.
This note joins them, and shows that `tab` is the join made executable.

## The two streams

**Paracosm theory** (`development/lab/archive/archive-from-bare-cedar-fog/.../worldbuilding/terms/paracosm.md`
and `.../lit/theorem-of-reproducible-paracosmic-models.md`) is *top-down* and categorical. A
**paracosmic sketch** `S` is a small category `C_S` (the diegetic ontology — entities, events,
relations), some designated (co)limit cones (causal/spatial/temporal constraints), and a family
of **modal endofunctors** `□_i` (knowledge, memory, speculation, agency). A **model** is a
limit-preserving functor `M : C_S → Set`; the models form `Mod(S)`. A paracosm is **reproducible**
when its models are taken up to three equivalences:

> `RP(S) = Mod(S) / ~_{J,N,O}` — **J** gluing (local models agreeing on overlaps glue to a unique
> global one: descent), **N** normalization (a terminating, locally-confluent rewrite system),
> **O** bisimulation (observational equivalence among viewpoints).

**The predication-world-sim** (`.../predication-world-sim/predication-world-sim.md`) is *bottom-up*
and operational. Everything with predicates is an entity with a *fiber*; `respond()` composes
fibers; the world is the on-disk trace; the tick settles the universe; perception is fiber
filtering (Umwelt); an NPC is just an entity with a fiber. It never mentions sketches or `Mod(S)`.

## The fusion

The world-sim is `Mod(S)` **made to run.** A model `M` assigns, to each object of the diegetic
ontology, a set — its inhabitants and their state. In `tab` that assignment is exactly a
**settled `being`**: `being(subject, trace)` is `M` evaluated at `subject`, and the whole
population of `<entity>.jsonl` logs is `M` evaluated across `C_S`. The diegetic ontology `C_S` is
the `thing` descent (area→region→dimension, actor→npc/player, item). The modal endofunctors `□_i`
are the operations: `observing` is the *knowledge/agency* modality (it restricts a model to what a
viewpoint can know), `changing`/`ticking` is the *time* modality (it carries one model to the
next). So play is a walk through `Mod(S)`, and the tick is the endofunctor that takes a step.

The payoff is that the **reproducibility triad lands on machinery tab already has:**

| RP(S) equivalence | what it means | tab's mechanism |
|---|---|---|
| **J — gluing / descent** | local views agree on overlaps and glue to one world | **dual-filed EAVT**: a relational row lives in both the subject's and the object's log; a federated row is admitted only once its dual filing is restored. The same row, content-addressed, glues two local logs into one fact. `dedupe`/`allRows` is the descent. |
| **N — normalization** | a terminating, confluent rewrite to a canonical form | **the settlement fold**: `being` folds a trace to a fixed point; `supersede` (latest-t wins) is the rewrite; content-addressing makes the result order-independent and canonical. (Where the algebra is genuinely non-confluent — real choice — N is *not* imposed; see `non-confluence-is-choice`.) |
| **O — bisimulation** | viewpoints that can't be told apart are identified | **the Umwelt projection**: `observing` settles an observer's frontier and filters to its `perceives`. Two worlds a viewpoint cannot distinguish through its fiber project to the same knowable — that *is* observational equivalence, computed, not asserted. |

So a `tab` world is a **reproducible paracosm** precisely when its EAVT is consistently dual-filed
(J), its functional predicates settle (N), and its actors' projections are stable (O). The theory
told us *which invariants make a world a world*; the package makes those invariants the cheapest
thing to satisfy — they fall out of dual filing, the fold, and the projection.

## Why this matters for tab

It tells us what "correct" means for a world without leaving the algebra. A bug is a place where
one of the three fails: a relational row filed at only one anchor (J broken — the contents read
wrong), a non-functional predicate that should have been functional (N broken — two "current"
places at once, which the bilattice would show as ⊤), or an Umwelt that leaks predicates an actor
can't sense (O broken). Each is checkable. And it tells us the **growth** story: the tower/fold
(`growing`) extends `C_S` itself — settled entities become new objects of the diegetic ontology at
the next level — so the paracosm is not a fixed sketch but one that enriches itself from play,
which is the world-sim's "the world builds itself from play" stated in the theory's own terms.

## Sources

- `development/lab/archive/archive-from-bare-cedar-fog/library/media/domains/worldbuilding/terms/paracosm.md`
- `development/lab/archive/archive-from-bare-cedar-fog/library/relationality/content/triage/scientific-texts/media/lit/theorem-of-reproducible-paracosmic-models.md`
- `development/lab/archive/predication-categories/bucket-4/.../predication-world-sim/predication-world-sim.md`
- the gluing/dual-filing rule in `development/active/typed-resource-catalog/docs/dev/specification.md` §4
