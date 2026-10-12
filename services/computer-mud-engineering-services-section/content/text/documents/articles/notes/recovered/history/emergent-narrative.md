---
name: emergent-narrative
description: Stories in a tab world are not authored and embedded; they emerge from the tick, scarcity, and the algebra. Records the theory (Jenkins' four narrative architectures; Juul's half-real and the dissolved ludology/narratology debate; Dwarf Fortress and the "anecdote factory"; what makes an emergent anecdote tellable — memory and consequence) separately from the tab proposal, then maps it: `#history` entangled pairs are the geometric record that makes consequence legible, non-confluence is the genuine plot fork, the tick + scarcity is the incident engine, and the story log is the read that renders an anecdote tellable.
---

# Emergent narrative

A scripted MUD ships a story and asks the player to walk through it. tab ships a world that
runs and asks nothing — the story is what the run leaves behind. This note records the theory of
emergent versus authored narrative, what makes an emergent event worth telling, and how tab's
existing machinery (the tick, scarcity, `#history`, non-confluence) is already the substrate that
produces and records tellable stories. The facts of the field are kept apart from the tab proposal.

## The theory (facts from the field)

**Two ways a game holds a story.** Henry Jenkins, *Game Design as Narrative Architecture* (2004),
reframes the designer as a "narrative architect" who "design[s] worlds and sculpt[s] spaces" rather
than telling stories, and names four ways game space carries narrative: **evocative** (it borrows
pre-existing narrative associations), **enacted** (the plot is "structured around the character's
movement through space"), **embedded** (the space is "a memory palace whose contents must be
deciphered" — authored narrative information hidden in the mise-en-scène for the player to
reconstruct), and **emergent** (spaces "designed to be rich with narrative potential," where the
story is produced by the activity of play rather than placed by the author). The fault line that
matters here is **embedded vs. emergent**: embedded narrative is information the author wrote and
the world stores beside play; emergent narrative is structure the author *enabled* and the run
produces.

**The ludology/narratology debate, and its dissolution.** After Aarseth's *Cybertext* (1997) and
Frasca's "Ludology Meets Narratology" (1999), one camp held that games are formal systems of rules
not reducible to story, the other that games are a narrative medium analyzable with the tools of
literature and film. Jesper Juul's contribution (*Half-Real*, 2005) located the real difference:
in a narrative, events "have to" follow one another; in a game the player controls what happens
next, so the sequence is not fixed in advance. Juul's "half-real" names the double nature — a game
is at once **real rules** and a **fictional world** the rules evoke. The debate is now generally
treated as dissolved: both sides wanted the same thing (that games offer meaningful experience),
and after 2005 the principals (Juul, Frasca) walked back the opposition. The settled position is
that a game does not *contain* a story so much as *afford* one — which is exactly the emergent
quadrant.

**The story generator / anecdote factory.** Two games are the canonical proof that an emergent
system out-tells an authored one. **Dwarf Fortress** (Tarn and Zach Adams) is built so that deep,
interacting simulation systems throw off unplanned events; its motto, *"Losing is Fun,"* is a
design thesis — failure is the richest source of story, because a fortress's collapse is a causal
chain the player can narrate. **Boatmurdered**, the community's most famous DF anecdote (a
collaborative succession game documenting a fortress's elephant-and-magma-driven downfall),
is the existence proof: nobody wrote that story; the systems produced it and the players *told* it.
This is the "anecdote factory" — the game's job is not to deliver a plot but to manufacture
raw incidents worth recounting afterward.

**What makes an anecdote tellable.** The field's working answer is that an emergent event becomes a
*story* (rather than noise) when it has **causal legibility** and **consequence**: the player can
reconstruct *why* it happened from a chain of prior states, and it *changes* the world durably so
that it mattered. Memory is load-bearing — an event the world forgets is an event that never
happened narratively. DF's generated histories and RimWorld's persistent colony are tellable because
the consequence persists and the cause is reconstructible. (Jenkins' embedded "memory palace" is the
authored version of this; the emergent version is a *recorded* causal trace the player reads back.)
The corollary, from Sicart's critique of overdetermined design, is that the meaningful anecdote
belongs to the player who narrates it — the system must leave room for the telling, not pre-tell it.

## What tab already has (facts about tab)

tab is, structurally, an emergent-narrative engine and not an embedded one — and it is so by
construction, not by feature:

- **The tick is the incident engine.** `ticking({root})` advances the world under its own volition:
  the tide turns, the ferry sails or is held by fog, the permit ages past its window and goes ⊤,
  the harbormaster tends the bell (`the-self-running-world`). These are deterministic functions of
  state — no RNG, no LLM — so the world produces events *between turns*, and the same log produces
  the same events on replay.
- **Scarcity produces the incidents.** The self-running world already shows NPCs pursuing needs and
  depleting resources. `economy-is-predicate-richness` records that scarcity in tab is *settledness*
  (the functional/relational split: scarce = settled functional cell, abundant = firable
  many-valued predicate). A world with depleting functional resources is a world that generates
  conflict over them — the raw incident the DF/RimWorld story generator runs on.
- **`#history` is the recorded causal trace, geometrically.** `history-is-geometric` records that an
  entity's past is not a quest log beside it but **entangled pairs** in its settled fiber (voidmath
  F8) — "the geometric record of what happened to this entity," read from its shape. The log is the
  complete history; the entanglement *is* the consequence. This is precisely the "memory" the field
  says makes events matter: tab's consequence is not stored separately and kept in sync, it is the
  world's own shape.
- **Non-confluence is the genuine fork.** `non-confluence-is-choice` records that bypass chains of
  length ≥3 force incomparable normal forms (voidmath F6): "the algebra itself presents genuine
  forks where the future isn't determined," not a dialogue tree. A real plot fork — a place where
  the story could have gone two incomparable ways — is a structural fact of the settlement, not an
  authored branch.
- **⊤ is the held-both-ways situation.** A contested fact, a disputed event, a rumor — the bilattice
  apex represents these as a value, not a bug (`paracosm-and-world-sim-fused`, `economy-is-predicate-richness`).
  The honest narrative ambiguity that authored systems fake is native here.

So the four things the theory says an anecdote factory needs — an event source, durable consequence,
reconstructible cause, and real forks — tab already realizes as the tick, the append-only log, the
entangled-pairs history, and non-confluence. The gap is not generation; it is **rendering**: the
world produces and records tellable stories but does not yet *surface* them as stories.

## The tab proposal (separate from the facts above)

The thesis: tab does not need a narrative subsystem. It needs a **read** that renders the causal
trace the world already keeps into something a player can tell. This is the "story log" named as a
cross-cutting differentiator in `next-gen-engine-architecture` (Observability/admin: "entity
inspector, fold visualizer, story log").

- **The story log is a read over the trace, not a new store.** An emergent anecdote is already
  fully present as rows: an incident is a cluster of `changing`/`doing` rows around a tick, its
  cause is the prior functional state those rows superseded, and its consequence is the entangled
  pairs (F8) it left in the affected fibers (`history-is-geometric`) plus any cell it drove to ⊤.
  A `storyLog(root, opts)` read folds the trace into **incidents** — coherent causal episodes —
  by grouping rows that share entities and a near-`t` window, ordering them by the dimension clock,
  and attaching, per incident, (a) the superseded prior value (the *cause*), (b) the entangled
  pairs it created (the *consequence*), and (c) the agents via the existing `enacted-by`
  reification (`thick-evidence`). Nothing in `value.mjs`/`being.mjs` changes; this consumes the
  settled fiber, the witness lists, and the trace.

- **Tellability = legibility of cause + durability of consequence, both already computable.** An
  incident is *tellable* exactly when it has a reconstructible cause (the superseded prior row is in
  the trace) and a durable consequence (it left entangled pairs or flipped a cell to ⊤). The story
  log can *rank* incidents by tellability: depth of the entangled-pair gap (F8's gap "is the residue
  ... a wider gap is a deeper past," `history-is-geometric`) measures how much a thing's shape was
  changed; a flip to ⊤ marks a contested outcome; an incident sitting on a non-confluent seam (a
  `bypasses`-induced ⊤, `non-confluence-is-choice`) marks a genuine fork that was taken. These are
  the field's tellability signals (consequence, causal legibility, real choice) read straight off
  the algebra.

- **Player-as-author, not author-as-author.** Following Sicart and the DF/Boatmurdered phenomenon,
  the story log *renders*, it does not *narrate*. It surfaces the causal skeleton (who, what
  superseded what, what it entangled) and leaves the telling to the player — the renderer-not-
  generator discipline tab already holds for perception (`perception-as-umwelt-filter`). The
  Umwelt projection (`observing`) means a story log can even be *per viewpoint*: the story you can
  tell is the story your fiber witnessed, which is the honest version of an unreliable narrator.

- **What it is not.** It is not embedded narrative — there is no authored plot hidden in the
  mise-en-scène to reconstruct (Jenkins' "memory palace"). It is not a quest log (`history-is-
  geometric` rejects that explicitly). And it does not generate events — the tick does that. The
  story log is purely the rendering layer that turns a recorded run into a tellable anecdote.

This sets up the companion note: the story log makes incidents *tellable*, but the field's other
half is **pacing** — when incidents should fire so the run has shape. That is the Storyteller /
Director (see `the-storyteller-and-director`), which reads world-state and nudges the algebra's
firable adjacencies without authoring the events the story log later renders.

## Why this matters for tab

It tells us tab is on the emergent side of Jenkins' fault line by its very substrate, and that the
work left is not to *write* stories but to *read* the ones the world keeps. The append-only log is
the perfect anecdote factory's memory: every cause is still on disk, every consequence is geometric
residue in a fiber, every fork is a structural seam. The "story they could tell — one nobody
scripted" that `next-gen-engine-architecture` names as the definition of done is, in this note's
terms, a `storyLog` read over a tick-driven run — the DF/RimWorld promise made out of an algebra
instead of a pile of special-cased systems.

## Sources

- Henry Jenkins, "Game Design as Narrative Architecture," in Wardrip-Fruin & Harrigan (eds.),
  *First Person: New Media as Story, Performance, and Game*, MIT Press, 2004. (Evocative / enacted /
  embedded / emergent; designer as narrative architect; environmental storytelling.)
  https://www.anabiosispress.org/VM606/1stPerson_hjenkins.pdf
- Espen Aarseth, *Cybertext: Perspectives on Ergodic Literature*, Johns Hopkins UP, 1997; Gonzalo
  Frasca, "Ludology Meets Narratology" (1999). (Origins of the ludology/narratology debate.)
- Jesper Juul, *Half-Real: Video Games between Real Rules and Fictional Worlds*, MIT Press, 2005.
  (The half-real double nature; events "have to" follow vs. player control; the debate's dissolution.)
- Tarn Adams / Bay 12 Games, *Dwarf Fortress*; "Losing is Fun"; the "Boatmurdered" community
  succession game. (The story generator / anecdote factory; failure as story; player-as-narrator.)
- Miguel Sicart, "Against Procedurality," *Game Studies* 11(3), 2011. (Meaning belongs to the player
  who narrates; the system should afford telling, not pre-tell.)
- tab notes: `the-self-running-world.md` (the tick as event source), `economy-is-predicate-richness.md`
  (scarcity as settledness), `history-is-geometric.md` (entangled pairs as the geometric record),
  `non-confluence-is-choice.md` (real forks), `perception-as-umwelt-filter.md` (renderer-not-
  generator), `thick-evidence.md` (`enacted-by` witnesses), `next-gen-engine-architecture.md`
  (the "story log" differentiator; "a story they could tell").
