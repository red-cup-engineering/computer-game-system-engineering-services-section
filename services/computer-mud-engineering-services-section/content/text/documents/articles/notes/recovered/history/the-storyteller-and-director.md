---
name: the-storyteller-and-director
description: A Storyteller/Director paces emergent incidents against world-state instead of authoring a plot. Records the theory (RimWorld's AI Storyteller and the wealth→threat pacing argument; why a storyteller beats a difficulty curve; Mateas & Stern's Façade drama manager and the Aristotelian beat-sequencing arc; Versu's social-practice simulation; Riedl & Bulitko's experience manager) separately from a concrete tab proposal: a Director that reads mood/scarcity/faction-tension off the settled fibers and shapes pacing by nudging the algebra's firable adjacencies and seeding tensions — it does NOT script events. Companion to `emergent-narrative` (the story log renders what the Director paces).
---

# The Storyteller and the Director

An emergent world generates incidents, but a run of pure emergence has no shape — long flat
stretches, then everything at once. The field's answer is a layer that *paces* the emergence
against the state of the world without scripting the events themselves. `next-gen-engine-
architecture` names it EPIC B / Layer 2: "the Storyteller/director." This note records the theory
of drama management, experience management, and the RimWorld storyteller, then designs a tab
Director that does its pacing through tab's own algebra. Theory-facts are kept apart from the tab
proposal.

## The theory (facts from the field)

**RimWorld's AI Storyteller, and why it beats a difficulty curve.** Tynan Sylvester's *RimWorld*
is explicitly "a story generator" whose events are chosen by a *storyteller* algorithm that, in
Sylvester's design, "analyze[s] the player's current situation and choose[s] events based on what
it assesses will make the most interesting narrative." There are three: **Cassandra Classic**
(traditional rising-and-falling tension), **Phoebe Chillax** (more downtime between events), and
**Randy Random** (forgoes narrative for raw randomness). The key mechanism is that the storyteller
paces *against world-state, not against a clock or a fixed curve*: Cassandra links threat to
**Colony Wealth** — as the player accumulates (more colonists, gold, buildings), "Storyteller
Wealth" rises and is converted into "Raid Points" that set the difficulty of incidents (community
figures cite roughly one raid point per ~160 wealth across the mid-range, so doubling wealth roughly
doubles threat intensity). Two design lessons follow. First, a **storyteller beats a static
difficulty curve** because a curve is open-loop (it ramps on elapsed time regardless of what the
player did), whereas a storyteller is closed-loop (it responds to the actual state the player
produced, so the pressure always *fits* the situation). Second, the storyteller is an **argument**:
linking threat to wealth makes the game *say something* (accumulated wealth is unsustainable; safety
is not buyable) without a line of authored dialogue. The storyteller paces; it does not write.

**Drama management — Façade.** Michael Mateas and Andrew Stern's *Façade* (2005) is the canonical
**drama manager**. Authored content is decomposed into **story beats** (in *Façade*, hierarchies of
reactive ABL behaviors plus discourse contexts); a global **drama manager** "sequences beats chosen
from a large pool in order to make story tension rise and fall to match an Aristotelian arc." The
selection rule: among beats whose preconditions hold, choose the one whose tension effect best
matches the near-term trajectory of an author-specified **story-tension arc**. The collection of
beats and sequencing rules implicitly defines a narrative graph too large to author explicitly. The
load-bearing idea for tab is *selection against a target arc*: the manager does not invent content;
it **orders** already-possible content so the run has a dramatic shape.

**Experience management — the general frame.** Riedl & Bulitko, "Interactive Narrative: An
Intelligent Systems Approach" (*AI Magazine*, 2013), generalize the drama manager to an **experience
manager (EM)**: "an integrated AI agent which controls non-player elements of the story world and
directs them in service of a particular narrative experience." Useful EM metrics integrate coherence
with player agency, dramatic arc, and surprise. The personalized branch (Thue & Bulitko's PaSSAGE;
Yu & Riedl) adds **player modeling** — pace against a *model of this player's preferences*, not a
fixed arc. The frame's lesson: the pacing agent reads state (world + player) and intervenes on
non-player elements; it does not seize authorship of the player's actions.

**Versu — pacing as emergence, not direction.** Richard Evans and Emily Short, "Versu—A
Simulationist Storytelling System" (*IEEE Trans. CIAIG* 6(2), 2014), take the opposite pole from a
centralized drama manager: drama arises from **autonomous agents** coordinated by **social
practices** (a "recurring social situation," a successor to the Schankian script) rather than a
global plot. The lesson for a simulation engine: you can get dramatic shape from *structuring the
situations agents fall into* — seeding the tensions — rather than from a manager picking beats. The
two poles (Façade's central manager vs. Versu's distributed practices) frame the design choice for
tab.

## What tab already has (facts about tab)

tab has the simulation half and the recording half already — it is missing only the pacing layer:

- **World-state is already legible as settled fibers.** Mood/closure, needs/utility-AI, social, and
  factions are folds over the trace; `economy-is-predicate-richness` records that scarcity is the
  functional/relational split (settled functional cells = scarce). So "Colony Wealth"-style signals
  — aggregate scarcity, mood, faction tension — are pure reads tab can already compute over the
  population of fibers.
- **Incidents are produced by the tick, not by a manager.** `the-self-running-world`: the tick emits
  the world's physics deterministically. The Director does not need to *generate* events; the tick
  does that.
- **Firable adjacencies are a real structural notion.** `non-confluence-is-choice` records the
  voidmath machinery: a **firable position** (`Act F4.1`) is where an adjacent bypass-ordered pair
  currently sits; firing it (`Act F3.1`) is one step of normalization. The settlement has *places
  where it could move next* — these are exactly the levers a pacing layer wants.
- **The story log renders the outcome.** Its companion (`emergent-narrative`) proposes the `storyLog`
  read that turns a recorded run into tellable anecdotes. The Director paces; the story log tells.

## The tab proposal (separate from the facts above)

The thesis, stated against the field: tab's Director should be **RimWorld's closed-loop, wealth-style
pacing** (read world-state, set pressure) realized through **Versu's seed-the-situation method
rather than Façade's pick-a-beat method** — because tab has no authored beats to pick. It nudges the
algebra's firable adjacencies and seeds tensions; it never scripts an event. Concretely:

1. **The state read (the "wealth" gauge, generalized).** A pure read `worldTension(root) ->
   { mood, scarcity, factionTension, ... }` folds the population of fibers into a small vector:
   - **scarcity** = aggregate settledness of contested functional resources (`economy-is-predicate-
     richness`) — tab's literal analogue of RimWorld Colony Wealth, but inverted (low supply, not
     high wealth, is the pressure source);
   - **mood** = the existing mood/closure fold over actors;
   - **factionTension** = the density of ⊤ cells on shared/contested predicates between faction
     members (`paracosm-and-world-sim-fused`: ⊤ is the contested fact). Faction tension is *already
     a value in the world* — the apex on disputed cells — not a number the Director invents.
   This vector is the closed-loop input. It is computed, never assigned.

2. **The target arc (Cassandra/Phoebe/Randy as policies, not content).** The Director carries a
   **pacing policy**: a target trajectory for `worldTension` over the dimension clock. Cassandra =
   rising-and-falling Aristotelian arc (Façade's tension target, RimWorld's classic); Phoebe = lower
   amplitude, longer troughs (more downtime); Randy = no target (let the tick run). Crucially the
   policy is a target over the *state vector*, not a list of events — it says "tension should be
   here now," and the Director closes the gap by intervention, not authorship.

3. **The intervention: nudge firable adjacencies and seed tensions — never script.** When measured
   tension is below the policy target, the Director may, *within the algebra*:
   - **bias which firable position fires next.** The tick already advances by normalization; where
     more than one firable position (`Act F4.1`) is available, the Director may weight the choice
     toward the one whose firing raises tension (e.g. exposes a scarcity, ripens a feud). This is
     Façade's beat-selection idea, but the "beats" are firable adjacencies the algebra already
     offers — the Director *orders* the world's own next steps, it does not insert new ones.
   - **seed a tension by appending a single ordinary row.** To raise pressure the Director appends
     the kind of row the world could itself emit — deplete a functional resource a step further,
     file a `bypasses` row that opens a genuine fork (`non-confluence-is-choice`), nudge an NPC's
     need. This is Versu's "structure the situation" method: the Director plants the precondition and
     lets autonomous NPC utility-AI produce the incident. Every Director append is a normal EAVT row,
     content-addressed, replayable, and indistinguishable in kind from the tick's own output — so the
     world stays a reproducible paracosm (`paracosm-and-world-sim-fused`).
   When tension is *above* target (Phoebe's downtime, Cassandra's falling action), the Director
   simply *withholds* — it seeds nothing and lets settlement relax the world toward its functional
   floor.

4. **The hard constraint — the Director never authors the player's actions, and never writes events
   out of the algebra.** It only (a) weights among already-firable positions and (b) appends rows the
   world's own physics could have appended. It may not append a row that the algebra could not
   itself produce, and it may not act on a player's fiber. This is the line between a *director* and
   a *puppeteer*, and it is enforceable precisely because every Director action is an EAVT append
   checkable against the world's rules (the runtime invariant of `next-gen-engine-architecture`:
   the materialized view must equal `being(fold(log))`, so a Director append is just more log).

5. **Director and story log are dual reads of one loop.** The Director reads `worldTension` *before*
   the tick and nudges; the tick runs; the `storyLog` (`emergent-narrative`) reads the resulting
   incidents *after*. Pacing and telling are the two faces of the same closed loop — one shapes the
   pressure, the other renders the residue — and both are pure functions of the same trace, so both
   are replayable and forkable like everything else.

### Why this design and not a difficulty curve or a beat-graph

A difficulty curve is open-loop and says nothing; tab's Director is closed-loop and says something
(the wealth→threat *argument* RimWorld makes falls out of pacing against tab's scarcity gauge). A
Façade beat-graph requires authored beats; tab has none — its content is the algebra's firable
adjacencies, so the Director sequences *those*. Versu shows the missing half: where there is no beat
to pick, you seed the situation and let agents make the beat. tab's Director is the union: read state
like Cassandra, intervene like Versu, render like the story log — all in EAVT, none of it scripted.

## Why this matters for tab

It completes the emergent-narrative story without compromising it. The fear with any "director" is
that pacing means scripting, which would collapse tab back to the embedded-narrative side of
Jenkins' fault line (`emergent-narrative`). This design keeps tab on the emergent side by
construction: the Director's only powers are *weighting the world's own next moves* and *appending
the world's own kind of rows*, both checkable, both replayable. It is the smallest possible thing
that turns a flat self-running world into one with dramatic shape — and it earns the
`next-gen-engine-architecture` definition of done (an hour of play, "a story they could tell, one
nobody scripted") because, quite literally, nobody scripted it: the Director only ever paced it.

## Sources

- Tynan Sylvester / Ludeon Studios, *RimWorld*; "AI Storytellers" (Cassandra Classic, Phoebe Chillax,
  Randy Random); Colony Wealth → Storyteller Wealth → Raid Points pacing.
  https://rimworldwiki.com/wiki/AI_Storytellers ;
  C-N, "Algorithmic Authors: RimWorld's AI Storytellers as Agents of Literary Genre" (the wealth→threat
  argument). https://en.wikipedia.org/wiki/RimWorld
- Tynan Sylvester, *Designing Games: A Guide to Engineering Experiences*, O'Reilly, 2013. (Games as
  experiences; the playtest-and-deepen loop the `next-gen-engine-architecture` demo plan cites.)
- Michael Mateas and Andrew Stern, "Structuring Content in the Façade Interactive Drama Architecture,"
  *AIIDE* 2005 (the drama manager; story beats; Aristotelian tension-arc beat sequencing).
  https://users.soe.ucsc.edu/~michaelm/publications/mateas-aiide2005.pdf ; also Mateas & Stern,
  "Façade: An Experiment in Building a Fully-Realized Interactive Drama," GDC 2003.
- Mark O. Riedl and Vadim Bulitko, "Interactive Narrative: An Intelligent Systems Approach,"
  *AI Magazine* 34(1), 2013 (the experience manager). https://faculty.cc.gatech.edu/~riedl/pubs/aimag.pdf ;
  David Thue, Vadim Bulitko et al., PaSSAGE (player modeling); Hong Yu & Mark Riedl (data-driven
  personalized drama management).
- Richard Evans and Emily Short, "Versu—A Simulationist Storytelling System," *IEEE Transactions on
  Computational Intelligence and AI in Games* 6(2):113–130, 2014 (autonomous agents; social practices
  as the unit of dramatic coordination).
- tab notes: `economy-is-predicate-richness.md` (scarcity = settledness, the "wealth" gauge),
  `the-self-running-world.md` (the tick as incident source), `non-confluence-is-choice.md` (firable
  positions `Act F4.1`; `bypasses` rows seed forks), `paracosm-and-world-sim-fused.md` (⊤ as contested
  fact = faction tension; Director appends keep the world a reproducible paracosm),
  `emergent-narrative.md` (the story log the Director's pacing feeds), `next-gen-engine-architecture.md`
  (EPIC B / Layer 2 "Storyteller/director"; runtime invariant; definition of done).
