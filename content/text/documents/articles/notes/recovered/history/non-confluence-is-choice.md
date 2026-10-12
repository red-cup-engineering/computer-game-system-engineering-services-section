---
name: non-confluence-is-choice
description: Why genuine choice in a tab world is not a dialogue tree but non-confluence in the settlement algebra — bypass chains of length ≥3 force incomparable normal forms (voidmath F6), the alternative branches are real bypass cones (F7), and tab already has the apex (⊤) that marks the fork. Records the formal finite-voidmath geometry the world-sim names, and proposes the thin read that surfaces it without touching the confluent fold.
---

# Non-confluence is choice

tab's tick is confluent today. The settlement fold drives every entity to one settled
`being`, and `supersede` (latest-t wins) makes the functional predicates single-valued. That
is the right floor. But the world-sim vision says the *interesting* worlds are the ones where
the floor is not the whole story — where the algebra itself presents a genuine fork and the
future is not yet determined. This note records what the repo means by that, in its own words,
and proposes the thin read that surfaces it.

## What the repo says

The predication-world-sim states it directly:

> "Voidmath F6: bypass chains of length ≥ 3 force non-confluence. Multiple incomparable normal
> forms. The system settles into one of several states and there's no canonical choice."

> "When the player sends a message that creates a bypass chain, the universe has multiple
> possible settlements. The player's NEXT action determines which branch is taken. Not 'choose
> from a dialogue tree' — the algebra itself presents genuine forks where the future isn't
> determined."

> "And the forks are REAL — the alternative branches exist as bypass cones (F7). ... An oracle
> entity ... could query the alternative cones and report what the other timelines hold."

The "F6" and "F7" are not metaphors; they are theorems in the finite-voidmath document. There:

- the **bypass relation** `Act 3.1` is an asymmetric relation between two generators; the
  **bypass step** `Act F3.1` swaps the first adjacent bypass-ordered pair (one-step
  normalization); a **firable position** `Act F4.1` is where such a pair currently sits.
- a **bypass chain** (`Thing F6.1`) is three generators `g1→g2→g3`, bypass-related through the
  shared middle. Its grade-3 history (`Thing F6.2`) has **two incomparable normal forms**
  (`Thing F6.3`): firing the 1–2 position first versus the 2–3 position first lands in two
  settled histories from which neither reaches the other.
- the minimum matters: *"A bypass chain of at least 3 generators is required for non-confluence
  at finite depth. Two-generator histories are always confluent ... The minimal non-confluent
  finite configuration is exactly Thing F6.2."* (`Quality F6.4`)
- a **bypass cone** (`Thing F7.1`) is a set of histories closed under the bypass step — the
  carrier of "the alternative branch." *"In a confluent system, Act F7.2 collapses ... Here it
  does not collapse."*

And the kernel records where this lives relative to settling: *"`settle` is the confluent
floor"* — the non-confluence is in the upper coherences, above the fold, not a settle-time
event.

## What tab already has

tab already carries the apex these forks resolve onto. The four-value bilattice has **⊤**: a
state "the world can hold ... rather than crashing or silently picking a side." And `being`'s
fold accumulates evidence with a monotone `knowledgeJoin`, so a cell that two sources push in
incompatible directions lands on ⊤ — a contradiction-as-a-value, a situation, not a bug. The
cells that resolve **differently across the incomparable normal forms** are exactly the ones
that, joined, read ⊤. So tab does not need a new value to show a fork; it needs only to know
*which* ⊤ is a fork (real choice) rather than a converse-collision (N broken, in the fused
note's terms).

## Design proposal (separate from the facts above)

The confluent fold stays untouched — it is the floor. Non-confluence is a **read layered over
the settled fiber**, mirroring how the kernel keeps it above `settle`.

- **Declare the bypass relation as data**, the way converse predication is declared. A row
  `{e:p, a:"bypasses", v:q, t}` posits `Act 3.1(p,q)` (asymmetric, like `has-converse`). A
  world with no such rows is confluent — i.e. every world today.
- **`settleForks(root, subject, opts) -> { base, forks, seams }`**: `base` is the existing
  single `settle()` (unchanged); `forks` are the incomparable normal forms (`Thing F6.3`),
  one per resolution order of each bypass chain; `seams` are the `base` cells that read ⊤ as
  the residue of a fork. By `Quality F6.4`, only chains of length ≥3 produce forks, so `forks`
  is empty until someone files a chain — the read collapses to `settle` on every present world.
- **Nothing changes in `value.mjs`, `being.mjs`, or `supersede`.** ⊤ and `isTop` already
  exist; the fold and the latest-t rule remain the confluent floor.

Deferred, because thick-evidence-dependent: the **oracle** read — querying an alternative cone
to report "what the other timelines hold" — wants the cone residuation `Act F7.2`, an upper
coherence above the presence floor. It waits on thick evidence and the kernel's upper
coherences (see `thick-evidence`, a next-phase task). Which fork the world *takes* is a thin
`doing` extension (the player files the row that selects a branch); reading the forks is the
thin read above.

## Why this matters for tab

It tells us what "real choice" is without leaving the algebra: not a menu the designer wrote,
but a place where the settlement genuinely has more than one normal form and the world's own
geometry — not a script — presents the fork. tab already shows the seam (⊤); this note says how
to name it and how to enumerate the branches it opens, while keeping the tick confluent by
construction until a `bypasses` row says otherwise.

## Sources

- `development/lab/archive/predication-categories/bucket-4/.../predication-world-sim/predication-world-sim.md` §"Non-confluence means real choice", §"The history system"
- `development/lab/archive/archive-from-bare-cedar-fog/library/relationality/triage/relational-hyperverse/finite-voidmath.md` Steps F3, F4, F6 (Thing F6.1–F6.3, Quality F6.4), F7
- `development/lab/tab/being/library/value/scripts/value.mjs` (FOUR, ⊤ as a value; knowledgeJoin; isTop)
- `development/lab/tab/scripts/_substrate.mjs` (supersede — the confluence tab imposes; settle)
- `development/active/voidmath-kernel/.../settling/scripts/settle.mjs` ("settle is the confluent floor")
