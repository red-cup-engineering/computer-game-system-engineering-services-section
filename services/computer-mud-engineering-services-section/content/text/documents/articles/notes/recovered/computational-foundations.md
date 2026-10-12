---
name: computational-foundations
description: What the repo's frontier mathematics IS — the four-value bilattice FOUR, the four-regime descent (articulate→predicate→posit→settle), the identification FOUR ≅ Chu(2,0) that makes bilattice-valued predication a model of multiplicative linear logic, the consistent⊕paraconsistent split, and MLD-equivalence on settlings — and why each makes tab's engine sound. FACTS (what the kernel and lineage files say) are kept separate from PROPOSALS (what they buy the engine): paraconsistency = ⊤-as-content with no explosion, the Chu/linear-logic structure = resources and consumption, MLD = when two histories are "the same game".
---

# Computational foundations — why the substrate is sound

tab is built on a math floor the repo derives independently: the four-value bilattice and the four-regime descent that settles utterances into it.
This note records what that floor **is**, in the words of the kernel and the lineage that motivated it, and then — kept separate — what it buys the engine.
The engine claims (`next-gen-engine-architecture.md`) rest on these facts; this note is the bridge from the math to the guarantees.

## FACTS — what the repo says

### The carrier: the four-value bilattice FOUR

tab settles every cell into a thin four-value bilattice.
Its `value.mjs` names FOUR as an **evidence pair** `(pos, neg) ∈ {0,1}²`:

> "A settled cell carries an evidence pair (pos, neg) in {0,1}^2 ...
> The two bits ARE the value; the four corners are the bilattice FOUR: (0,0) = bottom ...
> (1,0) = t ...
> (0,1) = f ...
> (1,1) = top — BOTH asserted: a contradiction-as-a-VALUE, a situation, not a bug."
> (`being/library/value/scripts/value.mjs:4`)

The kernel says the same thing one level deeper: every value of FOUR "is identified with an **evidence pair** (pos, neg) ∈ {0,1}²" — pos = evidence for, neg = evidence against — and the two orders are *both defined componentwise on that pair*: the **knowledge order** (both components up) and the **truth order** (positive up, negative reversed).
So evidence is the carrier and truth/knowledge are two orders on it — "two orders + the carrier they order, not three orders" (`potential/voidmath-kernel/docs/dev/notes/2026-06-01-evidence-the-carrier-and-the-chu-root.md:18,24,32`).

tab carries the knowledge order as `knowledgeJoin` ("accumulate evidence ...
Monotone — evidence only ever grows, never retracts, as we fold more rows. ⊥ ≤_k t,f ≤_k ⊤", `value.mjs:23`) and the truth order's meet as `truthMeet` (fiber fusion, `value.mjs:28`).
A converse predication contributes negative evidence via `neg`, the truth involution that swaps the two faces (`value.mjs:41`).

### The descent: articulate → predicate → posit → settle

The kernel realizes a **four-regime descent**: an utterance `[token, claim]` "settles to a finite fixed point through `articulate → predicate → posit → settle`" (`active/voidmath-kernel/README.md:9`).
The four morphisms are the four regimes:

- `articulate` — "the aperiodic regime's constitutive generator"; utterance → `{ potential: cell }` (`active/voidmath-kernel/articulating/scripts/articulate.mjs:1`).
- `predicate` — "the transfinite generator"; emits the cell-set `Φ = E × Π × E` and the value-free fiber over it (`.../predicating/scripts/predicate.mjs:1`).
- `posit` — "the scott-continuous generator"; seeds the knowledge-least valuation (⊥ on every cell) (`.../positing/scripts/posit.mjs:1`).
- `settle` — "the finite generator"; iterates the closure "to its knowledge-least fixed point (unique by confluence) ...
  Terminates by Knaster-Tarski over the bounded knowledge lattice" (`.../positing/.../settling/scripts/settle.mjs:1`).

tab's `settle` (`scripts/_substrate.mjs:153`) is the on-disk realization of the same arc: `rowsFor → frontier → supersede → being`, folding a subject's trace to its settled fiber.
The validated `potential/voidmath` and the kernel "produce **byte-identical** settled output" (`README.md:11`); the kernel records that `settle` "is the confluent floor" (quoted in `non-confluence-is-choice.md`).

### The Chu root: FOUR ≅ Chu(2,0), hence multiplicative linear logic

The deepest recorded fact: under Jakl 2025, **FOUR ≅ Chu(2,0)**, "making bilattice-valued predication a model of **multiplicative linear logic**" (`active/voidmath-kernel/docs/dev/notes/2026-06-01-evidence-the-carrier-and-the-chu-root.md:57`).
Chu(2) is the universal `*`-autonomous category into which "Top, Pos, Vect, and more embed fully and faithfully" (same note, :59).
The evidence matrix IS the Chu matrix — points × states, "states = {positive, negative}; points = cells; each row the two presence bits" — and topology, order theory, and linear algebra are then *subcategories*, not analogies, of predication (same note, :62–66; this last is marked there as synthesis grounded in the citation).
The thin presence-bilattice is `Chu(2,0)`; thick witnessed evidence is the general `Chu` where matrix entries are real terms (same note, :66).

The repo separately spells out the **linear-logic reading of resources** (Girard, *Linear Logic*, 1987): a resource consumed exactly once is `A ⊸ B` ("the old resource A is consumed and the new resource A' is produced", `archive-from-bare-cedar-fog/library/tech/terms/writes.md:61`), a non-destructive read is the `!
A` exponential ("usable any number of times", `.../library/tech/terms/reads.md:37`), and a contract is `A ⊸ B`, "a program that consumes exactly one A-resource to produce one B-resource" (`.../library/sociology/.../governance/terms/contract.md:130`).

### The split: consistent ⊕ paraconsistent

The kernel's `compare` exposes the **consistent⊕paraconsistent split** of a settled section, `F^(k) ≅ F^(t) ⊕ F^(⊤)` — "classifying each charge consistent {⊥,t,f} vs paraconsistent {⊤}" (`.../2026-06-01-evidence-the-carrier-and-the-chu-root.md:86`).
The ⊤ corner is the paraconsistent summand: a value the algebra holds, not a fault it raises.
The repo's logic library defines what paraconsistency means — a paraconsistent logic is one in which **explosion fails**: a contradiction does not entail everything (`archive-from-bare-cedar-fog/library/philosophy/domains/western/domains/logic/domains/paraconsistent/terms/explosion.md`, `.../paraconsistent/terms/dialetheia.md`).

### MLD: when two settlings are the same

The lineage defines **mutually locally derivable** (MLD) settlings.
Two aperiodic settlings `v, v'` over a common base "are **mutually locally derivable** — written `v ∼_MLD v'` — iff there exists an invertible settling-morphism `v → v'`" (`lab/archive/predication-categories/bucket-1/concepts/mutually-locally-derivable.md:12`).
MLD "includes settling-shift" (two settlings differing only in starting ordinal are MLD) but "does **not** include arbitrary relabelling" — the morphism family "must commute with both settlings' endofunctors, so any equivalence respects the structural closure pattern, not just static values" (same file, :16).
It is "the settling analogue of MLD-equivalence for substitution tilings ([@sadun2008] Ch. 1)" (same file, :18), and "two aperiodic settlings are MLD-equivalent iff their classifying invariants in `H¹(...)
` agree" (same file, :22).

### The bypass geometry under it all

The finite-voidmath document gives the algebraic shadow that tab's `#forking`/`#history`/ `#growing` reads against: bypass chains of length ≥ 3 force **non-confluence** — two incomparable normal forms (`Thing F6.2/F6.3`, `Quality F6.4`); the residue of normalization is **entangled pairs** of bypass-related, non-adjacent generators (`Thing F8.1`); and the **tower** re-seeds each level from the settled-and-complete layer `Thing F5.3` (`Act F9.1`) (`archive-from-bare-cedar-fog/library/relationality/triage/relational-hyperverse/finite-voidmath.md`, Steps F6, F8, F9).
The cone algebra has a **right adjoint / residuation** `Act F7.2` satisfying the adjunction and modus ponens (`Quality F7.1`, `F7.4`) — the residuated-lattice structure on the space of histories.

## PROPOSALS — why this makes tab's engine sound

The following maps the facts above onto the four engine differentiators (`next-gen-engine-architecture.md:12-23`).
These are design conclusions, marked as such.

### Paraconsistency ⇒ contradiction as content, with no explosion

The engine wants "⊤ ('held both ways') ... a first-class value, not a bug" (`next-gen-engine-architecture.md:20`).
The math makes that *safe*: because the value algebra is paraconsistent (explosion fails), a world that holds a contradiction does **not** become a world that holds everything.
In a boolean engine, two NPCs asserting "the permit is in force" and "the permit is not in force" is a data race the engine must resolve (last-write-wins) or a crash.
Here `knowledgeJoin` lands that cell on ⊤ and the fold *continues* — every other cell keeps its honest value, the renderer shows the dispute, and nothing downstream explodes.
The `consistent⊕paraconsistent split` (`compare`) means the engine can always read off *which* cells are contested without that contamination leaking.
This is the formal license for "contradiction as content": disputed facts, rumor, and mood are modeled, not papered over.

### Chu / multiplicative linear logic ⇒ resources, consumption, trade

FOUR ≅ Chu(2,0) places predication inside a `*`-autonomous category — the categorical home of multiplicative linear logic, the logic of **resources used once**. tab's append-only EAVT is already resource-shaped: a write is `A ⊸ A'` (the old functional cell superseded, a new one produced — `supersede`, `_substrate.mjs:103`), a read is the non-consuming `!
A` exponential.
So crafting (consume ingredients → produce an item), trade (consume coin → produce goods), and any economy of scarce things are not bespoke subsystems with their own bookkeeping — they are the linear-logic reading of the same fold.
The Chu embeddings (Top/Pos/Vect as subcategories) say spatial, ordinal, and quantitative structure all live in one matrix, which is why "one algebra, no subsystems" (`next-gen-engine-architecture.md:23`) is achievable rather than aspirational: mood, combat, crafting, and trade are the same evidence arithmetic read through different shadows.

### MLD ⇒ when two histories are "the same game"

Forkable/replayable timelines (`next-gen-engine-architecture.md:16`) raise an immediate question: when are two divergent timelines actually the *same* world?
MLD answers it.
Two settlings are MLD-equivalent iff an invertible settling-morphism relates them that commutes with the closure — they "encode the same aperiodic structure" despite settling-shift and surface relabeling (mutually-locally-derivable.md:16, 22).
For the engine this is the right equivalence for timeline ops: a replay that starts a few ticks earlier, or a fork whose only difference is bookkeeping order, is MLD-equivalent to the original — the *same game* — whereas a fork that changes the structural closure is genuinely a different world.
MLD gives diff a principled notion of "no real difference," and gives federation a principled notion of "these two instances are running the same world."
(This is a design reading of the lineage's classification result, not a claim the engine yet computes the H¹ invariant — that lives downstream in `voidmath-mld`, per the kernel note, :100.)

### The descent's confluence ⇒ determinism and replay-equivalence

`settle` reaching its knowledge-least fixed point, "unique by confluence ...
Knaster-Tarski over the bounded knowledge lattice" (`settling/scripts/settle.mjs:1`), is precisely the property the runtime invariant depends on: `runtime.settle(e)` must equal `being(fold(log), e)` for all `e` (`next-gen-engine-architecture.md:70`).
A confluent, monotone fold is what lets the materialized view be *derived, never authoritative* — replay re-derives the same state because the math has one fixed point.
The bypass geometry then names the controlled exception: where a world *wants* genuine choice, a bypass chain (≥ 3) makes non-confluence a first-class fork rather than an update-order bug (see `non-confluence-is-choice.md`), and the residuated cone algebra (`Act F7.2`) is the machinery that keeps the algebra coherent in that non-confluent case (`finite-voidmath.md` Quality F7.1).

## Why this matters for tab

Every engine guarantee tab advertises is downstream of one of these facts.
Paraconsistency is why ⊤ is content and not a crash.
The Chu/linear-logic structure is why scarce-resource systems are one algebra.
MLD is what makes "fork", "diff", and "same world across servers" meaningful.
And the descent's confluence is why the world-is-a-log is replayable at all.
The substrate is sound because the math under it was derived to be — and tab's `value.mjs`/`_substrate.mjs` are the byte-compatible thin realization of that derived floor.

## Sources

- `development/lab/tab/being/library/value/scripts/value.mjs:4,15-18,23,28,41` (FOUR as evidence pair; knowledgeJoin; truthMeet; neg)
- `development/lab/tab/scripts/_substrate.mjs:103,153` (supersede; settle = rowsFor→frontier→supersede→being)
- `development/active/voidmath-kernel/README.md:9,11` (the four-regime descent; byte-identical settled output)
- `development/active/voidmath-kernel/articulating/scripts/articulate.mjs:1` (aperiodic generator)
- `development/active/voidmath-kernel/.../predicating/scripts/predicate.mjs:1` (transfinite generator; Φ = E×Π×E)
- `development/active/voidmath-kernel/.../positing/scripts/posit.mjs:1` (scott-continuous generator; knowledge-least seed)
- `development/active/voidmath-kernel/.../positing/.../settling/scripts/settle.mjs:1` (finite generator; confluent fixed point; Knaster-Tarski)
- `development/active/voidmath-kernel/docs/dev/notes/2026-06-01-evidence-the-carrier-and-the-chu-root.md:18,24,32,57,59,62-66,86,100` (evidence the carrier; two orders; FOUR ≅ Chu(2,0) ⇒ MLL; thin vs thick; consistent⊕paraconsistent split; downstream voidmath-mld)
- `development/lab/archive/predication-categories/bucket-1/concepts/mutually-locally-derivable.md:12,16,18,22` (MLD definition; settling-shift not relabelling; tiling analogue; H¹ invariant)
- `development/lab/archive/archive-from-bare-cedar-fog/library/relationality/triage/relational-hyperverse/finite-voidmath.md` Steps F6, F7, F8, F9 (non-confluence; cone residuation; entangled pairs; tower)
- `development/lab/archive/archive-from-bare-cedar-fog/library/philosophy/domains/western/domains/logic/domains/paraconsistent/terms/explosion.md`, `.../dialetheia.md` (paraconsistency = no explosion)
- `development/lab/archive/archive-from-bare-cedar-fog/library/tech/terms/writes.md:61`, `.../reads.md:37`, `.../sociology/.../governance/terms/contract.md:130` (linear-logic resource reading: ⊸ consumption, ! reads, contracts)
- `development/lab/tab/docs/dev/notes/next-gen-engine-architecture.md:12-23,70` (the four differentiators; the runtime invariant)
- External (for the linear-logic and tiling comparisons cited by the repo files above): J.-Y.
  Girard, *Linear Logic*, Theoretical Computer Science 50 (1987); L.
  Sadun, *Topology of Tiling Spaces* (2008); M.
  Jakl et al. 2025 (the Chu identification, as cited in the kernel note).
