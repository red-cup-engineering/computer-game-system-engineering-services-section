# The predication world-sim, realized on FizzOS

The design document (`predication-world-sim.md`, in the relationality corpus) is a complete theory of a world engine: *everything is a fiber, `respond()` is the universal interaction, actions are computed from fiber-composition rather than listed, you can play as anything, history is geometric entanglement, non-confluence is real choice, and the tower/fold generates vocabulary from play* — down to the settled layer being a Fibonacci quasicrystal and the world carrying a thermodynamic temperature (β_c = ln ρ, the plastic number) that sets the flow zone.

FizzOS already realizes a real slice of it without having named it so: the world **is** a bilattice charge valuation (the FOUR — `potential`/`active`/`stable`/`absurd` = t/f/⊤/⊥), the tick is the sole-writer **settlement**, `perceive` is **Umwelt** fiber-filtering, and `concurrency` (H¹) is the **non-confluence** detector.
What it lacked was the doc's most-repeated claim — *the available actions are COMPUTED, not listed* — because the engine dispatched a hardcoded verb switch, the exact opposite.

`@emsenn/fizzos/predication` (`src/predication.mts`) adds the five operational capabilities that turn the switch inside out.
All build on the existing assertion-world (`world.mts` fibers + charges); none hand-roll a parallel engine.

## 1. respond / computed affordances

`respond(actor, target, channel)` composes two fibers on one channel and returns the settled **charge**.
`affordances(actor, target)` returns every channel whose composition is non-⊥ — **the computed action menu**.
The vocabulary is rules-as-data (`AFFORDANCES`): an item affords `take`, an NPC affords `talk`/`attack`, a shop affords `buy`, a resource node affords `harvest`, a *locked* door composes `active` (f — denied, still shown), and a bare fiber affords nothing (⊥ everywhere).
In-world: `afford <thing>`.

## 2. Play as any fiber

`inhabit <entity>` assumes control of **any** closed fiber — a ship, an NPC, the tide — and `look` then renders through its predicates (perception is fiber-filtering).
`release` returns you to yourself.
`bodyOf(w, actor)` is the inhabited fiber, used by `look`, `afford`, and `history`.

## 3. History as entanglement (F8)

Interactions leave **geometric residue**: taking a thing, or trading blows, dual-files an `entangled` pair onto both fibers.
`history` reads the residue off your fiber — your past is the shape of your fiber, not a separate log.
(Identical pairs collapse under the idempotent knowledge-join; distinct ones accumulate.)

## 4. Closure — rules-as-data to a fixpoint

`closeWorld` fires forward-chaining `ClosureRule`s to a Knaster-Tarski least fixed point each tick (the `closureTick` agent).
`WORLD_RULES` is small but real: a polluted cell **blights**, clean water **heals**, and a blighted-yet-teeming cell is **torn** — emergence from rules over fibers, not a bespoke pass.
New world-logic is a rule, not code.

## 5. The tower/fold — death becomes vocabulary (the weird one)

A thing that settles **with witnesses** (F5.3 — settled *and* partnered) **folds into a word**: `eulogize <slain>` mints a real vocabulary atom that the mourners carry.
Without witnesses it settles alone (F5.1) and no word is born.
The word is a genuine composable predicate: `vocabulary` lists the world's word-stock, `invoke <word>` composes a word you carry, and `unfold <word>` resurrects it into a new being *made from the word that was made from a thing*.
"The entity transcended death by becoming language.
Not metaphorically.
Algebraically."

## What remains of the larger vision

This is the operational heart, not the whole 2500-line program.
Deliberately **not** yet built, and tracked as future work:

- **The tower's thermodynamics** — vocabulary growth on the Padovan sequence, the world's temperature β and the critical point β_c = ln ρ that sets the flow zone (adaptive difficulty as a partition function, not a slider).
- **The settled layer as a Fibonacci quasicrystal** — the acceptance window that gates which predicates become permanent vocabulary.
- **Permanent branching (I.
  7–I.
  8)** — bypass cones as queryable alternative timelines; an oracle that reads the futures not taken.
- **Self-bypass (F4.4)** — habit / addiction / meditation as a fiber that fires and returns to itself.
- **Richer respond()** — affordance composition that reads *both* fibers deeply (a heavy sword vs. weak limbs composing to `f`), so success is computed from predicate richness.

Each is a clean extension of the same machinery: more rules-as-data, more fiber-composition, the same charges and the same settling tick.
