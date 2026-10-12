---
name: mud-design-lineages
description: The four design lineages of text worlds — DikuMUD (hardcoded combat RPG), LPMud (driver + softcoded mudlib in LPC), TinyMUD/MOO (social worlds with in-world building & programming), and Discworld MUD (depth via learn-by-doing skills) — read as theory FACTS with citations, plus the cross-cutting lessons (persistence, agency vs authored content, the embodiment problem, griefing/governance, permadeath, the economy of attention, alive vs empty), then mapped to tab's architecture: the EAVT log as persistence, the planned DSL/behaviour system (roadmap EPIC F / Layer 5) as tab's softcode, "adding an entity = appending rows" as MOO-style in-world building, federation, and the planned server.
---

# MUD design lineages, and where tab sits among them

Persistent multiplayer text worlds are old, and their families are well-defined. This note records
the four main lineages as the sources describe them, draws out the cross-cutting craft lessons each
taught, and maps both onto `tab`'s architecture. The repo already holds primary historical material
(an org-roam encyclopedia under the archive) which is cited where it carries the fact; the rest is
from the standard literature.

THEORY (lineage facts) and PROPOSAL (tab choices) are kept apart.

## THEORY — the four lineages

### DikuMUD — hardcoded combat RPG (1990–91)

DikuMUD was announced 1990-03-27 by Hans Henrik Stærfeldt and released to its first public instance
1991-02-03; the name is the initials of Datalogisk Institut, Københavns Universitet (the repo's
archived `mud.org` encyclopedia records both dates and the etymology). Diku is the *hardcoded*
lineage: classes (fighter/healer/wizard/thief), levels, stats, and combat live in C, and content is
authored as flat text template files (areas, mobs, objects) parsed by the engine. Raph Koster's
"What is a Diku?" frames Diku as the origin of the conventions modern MMOs inherited wholesale —
"phase-based combat, combat states, cool-down based special attacks, tank-healer-nuker triad, and
basic aggro management." Its templates were "both strength and weakness": trivial to deploy and
populate, but to add a *mechanic* you patched C. Despite that, by the late 1990s Diku-derived MUDs
"accounted for around 60% of all muds running" — ease of deployment beat technical flexibility.

### LPMud — driver + softcoded mudlib in LPC (1989)

LPMud was developed in 1989 by Lars Pensjö at the University of Gothenburg (repo `lpmud.org` and
`mud.org`). Its innovation, in the repo encyclopedia's words, is the "[MUD engine] and [MUD library]
bifurcation": Pensjö split the system into **the driver** — a virtual machine / interpreter /
runtime written in C — and **the mudlib** — the game code, written in the object-oriented language
**LPC** and executed by the driver. This is the *softcoded* lineage: "the mudlib and the content
were made of the same code," so a wizard could add a new mechanic by writing LPC in-world, never
touching the driver. The barrier to invention drops from "edit and recompile the engine" to "write
a script the running engine loads." (The term *mudlib* was coined here.)

### TinyMUD and MOO — social worlds, in-world building and programming (1989–91)

TinyMUD (1989, Jim Aspnes) shifted the genre's centre of gravity from combat to *society* — a world
people convene in to "play-act society," with building, not killing, as the core verb. LambdaMOO
(Pavel Curtis, Xerox PARC, 1990–91) is the canonical descendant: "a blend of LPMUD's extensibility
and TinyMUD's social focus." Two affordances define this lineage. **In-world building**: any player
extends the world with `@dig` (new rooms) and friends, without needing treasure or wizard status.
**In-world programming**: the MOO language lets ordinary users "create complex new worlds," and —
crucially — "does not restrict this ability only to those with enough treasure." The world is built
*from inside itself* by its inhabitants, at runtime, as the normal mode of play.

### Discworld MUD — depth via learn-by-doing (LP lineage)

Discworld MUD (an LPMud, Terry Pratchett's setting) is the standing example of *depth* in the genre.
Its skill system runs to hundreds of skills in seven top-level trees (adventuring, covert, crafts,
faith, fighting, magic, people), each recursively subdivided (e.g. `magic.spells.offensive`).
Advancement is gated by *depth* — you can only advance a skill once you have `depth*5` levels in its
parent — and, distinctively, by the **TM (TaskMaster)** system: "practice makes perfect," where
"you have a chance of going up a skill level when you just use a skill," with the best odds around a
50% skillcheck, and the gain "free … with no XP or financial cost." Crafting draws on constellations
of skills at once. Depth here is not content volume but *system interlock*: skills, crafts, and
roleplay compose, and mastery is earned by doing rather than bought.

## THEORY — the cross-cutting craft lessons

- **Persistence & world consistency.** A virtual world is, in Bartle's framing (*Designing Virtual
  Worlds*, 2003), persistent — it "operates and evolves internally with minimal human interaction"
  and keeps running between sessions. The craft problem is keeping a mutable, save-file world
  *consistent* across crashes, concurrent writers, and edits.
- **Player agency vs authored content.** Diku is authored (designers write the world; players
  consume it); MOO is agentic (players write the world). Most design lives on this spectrum, and the
  softcode lineages discovered that letting inhabitants build is the cheapest way to keep a world
  growing — at the cost of consistency and control.
- **The embodiment / presence problem.** A text world must make a player *feel present* with only
  prose. The lineages answered with the room description, the "soul" emote commands, and consistent
  second-person rendering; the open problem is that text presence is thin and easily broken.
- **Griefing, moderation, social contract, governance.** Julian Dibbell's "A Rape in Cyberspace"
  (Village Voice, 1993) documented a LambdaMOO assault via a "voodoo doll" — "the ability to
  attribute actions to other characters that their users did not author." Pavel Curtis's prior "New
  Direction" had declared wizards mere technicians who "were not to make decisions which affect the
  social life of the MOO," which "forced the LambdaMOO community to invent their own self-governance
  from scratch"; by summer 1993 LambdaMOO had a petition/ballot system (eligible after a 30-day
  account). The lesson: a persistent shared world needs an explicit social contract and a governance
  mechanism, and the engine's *primitives* decide what griefing is even possible.
- **Permadeath & consequence.** Permadeath — a killed character is "obliterated, and you have to
  start from scratch" — is the strongest consequence lever. Bartle notes its advantages: it keeps
  early adopters out of "permanently held positions of power," recycles content, and embodies "the
  default fiction of real life." Its cost is that consequence must be *legible* and *fair*, or it
  reads as arbitrary.
- **The economy of attention.** In a text world, the scarce resource is attention; what the world
  spends a player's attention *on* is its real economy (this is the angle `economy-is-predicate-
  richness` develops for `tab`).
- **Alive vs empty.** A world feels alive when things happen without the player — NPCs with goals,
  an ecology, a clock — and consequences persist; it feels empty when it only reacts to input. This
  is the difference between a database and a world (the `the-self-running-world` note's framing).

## tab mapped onto the lineages

`tab` does not sit *in* one lineage; it relocates the hardcoded/softcoded distinction by making the
world a substrate rather than a program. "Every existing MUD engine is a mutable in-memory world
with a save file. TAB is the inverse: the world IS an append-only, content-addressed EAVT log,
folded through a bilattice" (`next-gen-engine-architecture`). Each lineage lesson lands on a
specific piece of that.

### Persistence — the EAVT log *is* the save (Diku's save-file problem dissolved)

The hardest engineering lesson of every prior lineage — keep a mutable world consistent across
crashes and concurrent writers — is answered structurally. "There is no world object in memory to
lose. The world IS the append-only log" (`the-self-running-world`): kill the process mid-tick and
restart, and the next tick reads the latest functional rows off disk; `--replay` re-folds the world
from scratch and gets the same answer. Consistency is not maintained by careful save logic; it is a
property of append-only-plus-deterministic-fold. The runtime the roadmap builds first (Layer 1) is
explicitly *derived, never authoritative* — `runtime.settle(e)` MUST equal `being(fold(log), e)` —
so even the optimisation can't drift from the log.

### Softcode — tab's DSL / behaviour system is its LPC, but over data not code (Layer 5)

LPMud's lesson was: split the engine from the world, and let the world be authored in a language the
running engine loads, so inventing a mechanic doesn't mean recompiling the engine. `tab`'s roadmap
Layer 5 carries exactly this split — "**An authoring DSL**. A declarative world-definition format —
areas, mobs, items, recipes, behaviours, factions — that compiles to EAVT," plus "a data-driven
behaviour/trigger system designers author without writing rows." The difference from LPC is that
`tab`'s softcode targets *data* (rows in the log) rather than *code* (objects in a VM): a behaviour
is `intends`-rules and recipes-as-data, not a method on a heap object. The LP win is kept — author a
mechanic without touching the driver — while the bilattice substrate keeps the result replayable and
forkable, which a live LPC heap is not.

### In-world building — "adding an entity = appending rows" is MOO's `@dig`, made durable

MOO's signature is that inhabitants build the world from inside it at runtime (`@dig`, in-world
programming). `tab` has the same shape but as the *native* operation rather than a privileged verb:
"Adding a system is a pure read or an append, not a hand-coded subsystem"
(`next-gen-engine-architecture`); adding an entity is appending rows
(`economy-is-predicate-richness`: a transfer "is one append," a new place is new rows). There is no
privileged builder class — `player-is-a-fiber` records that there is "no `player` machinery distinct
from `actor`," and promoting an item to an actor "is admissible later with no new machinery." So
MOO's "anyone can build, not just the treasure-rich" generalises: in `tab`, building is appending,
and the same operation that moves a sword creates a room. Unlike MOO, every such act is in an
append-only, content-addressed log, so in-world building is automatically versioned, diffable, and
forkable — the consistency cost MOO paid for openness is gone.

### Depth — Discworld's learn-by-doing is tab's skills-as-closure, already built

Discworld's depth comes from learn-by-doing (TM) and interlocking skill trees. `tab`'s `practice` /
`closure` system is the same idea derived from the substrate: a skill is "a predicate an actor HOLDS
AT A DEGREE," practising files reinforcing evidence and "the skill cell settles toward its fixed
point as evidence accrues," with "NO level number and NO designed gate" (`practice.mjs`). That is
TM's "practice makes perfect" without a TaskMaster module — advancement is the sub-fiber closing,
and `closure` reads the distance directly. Discworld's *interlock* (crafts drawing on constellations
of skills) is the `voice.mjs` chorus and `respond`'s computed affordances: more determined cells →
more channels compose → more the actor can do. The depth is emergent from richness, not authored as
a tree.

### Governance & griefing — the primitives decide what griefing is possible, and ⊤ records disputes

The "Rape in Cyberspace" lesson is that the engine's *primitives* set the griefing surface — the
voodoo doll was possible because MOO let one user attribute actions to another's character.
`tab`'s perception model closes much of that by construction: in the Umwelt frontier, "you know your
own cuts and the shared world, not other agents' private cuts until you perceive them"
(`perception-as-umwelt-filter`), and a move is *attributed* to its actor — the world records who
did what, privately until perceived. You cannot puppet another's fiber, because acting *as* an
entity means moving its log, which is its own. When conflict is genuinely contested, the bilattice
**⊤** holds it as a value ("contradiction as a VALUE, not a bug") and the renderer *shows* it rather
than silently resolving — so the log is itself the evidentiary record a governance process (a
petition/ballot in the LambdaMOO sense) would adjudicate over. Federation sharpens the social-
contract question: `federate.mjs` makes "a player walks from one server to another by their entity
file being sent as a message … No 'server transfer' — just a predication crossing a boundary," and
merging is "a G-Set union of the logs … conflict-free." Cross-server identity is content-addressed
(same SHA-256, same person), so a federated world inherits the governance question across instances
— who admits whom (`admit`) is the federation-era social contract.

### Server, presence, and alive-vs-empty

The lineages needed a server to be multiplayer; `tab`'s Layer 3 server is "the tick-owning daemon …
sole writer," draining a per-session input queue in "server-wide monotonic order so concurrent moves
settle deterministically within a tick," then routing output "through each player's frontier/Umwelt"
(`next-gen-engine-architecture`). That last clause is `tab`'s answer to the *embodiment/presence*
problem: presence is not a generic room description but the per-fiber Umwelt projection — what *your*
apparatus senses — so two players in one place are genuinely embodied differently
(`perception-as-umwelt-filter`). And the *alive-vs-empty* lesson is the whole point of
`the-self-running-world`: "A database waits to be asked. A world does not" — the tick advances tide,
ferry, fog, and NPC goals with no input, deterministically, so the world has its own life between
turns. `tab` already has the property the prior lineages had to bolt on; the open work is breadth
and a designed demo world (Layer 6), not the liveness mechanism.

## PROPOSAL — what tab should carry forward from each lineage

- **From Diku:** keep deployment trivial. Diku won on ease of standing up a world; `tab`'s DSL +
  generated breadth should preserve "clone, one command, a living world" (the roadmap's stated
  "done" bar).
- **From LPMud:** make the DSL/behaviour system (Layer 5) genuinely the place mechanics are
  invented, so the engine rarely needs editing — but target data, keeping replayability.
- **From MOO:** treat in-world building (append rows) as the normal verb for everyone, not a
  privileged mode; lean on content-addressing to make it versioned and safe.
- **From Discworld:** resist a level ladder; keep depth emergent from skills-as-closure and
  richness, and ship enough interlocking systems that mastery composes.
- **From the governance history:** before opening the server widely, decide the social contract and
  use ⊤ + attribution + the petition/ballot precedent as the substrate for moderation; let
  federation's `admit` be the explicit consent boundary between worlds.

## Sources

- Archived repo encyclopedia (org-roam, primary dates/etymology): `development/lab/archive/archive-from-bare-cedar-fog/operations/engineering/triage/archive/sloppyresearch/ref/enc/mud.org` (DikuMUD 1990-03-27 / 1991-02-03, DIKU etymology; LPMud 1989; engine/library bifurcation), `.../enc/lpmud.org`, `.../enc/multi-user-dungeon.org`.
- Koster, Raph. "What is a Diku?" (2009), <https://www.raphkoster.com/2009/01/09/what-is-a-diku/> — Diku as hardcoded class/level/combat lineage; the tank-healer-nuker / cooldown conventions; ~60% of MUDs Diku-derived; LPC "mudlib and content made of the same code."
- LPMud, Wikipedia, <https://en.wikipedia.org/wiki/LPMud> — driver (C VM) + mudlib (LPC) split; mudlib term coined here.
- LambdaMOO / TinyMUD: <https://mud.fandom.com/wiki/LambdaMOO> and Dourish/Smith "Introduction: The State of Play," <https://www.dourish.com/publications/mud-intro.html> — MOO as "a blend of LPMUD's extensibility and TinyMUD's social focus"; `@dig`; in-world programming "does not restrict this ability only to those with enough treasure."
- Dibbell, Julian. "A Rape in Cyberspace" (Village Voice, 1993), <http://www.juliandibbell.com/articles/a-rape-in-cyberspace/> and <https://en.wikipedia.org/wiki/A_Rape_in_Cyberspace> — the voodoo doll; Curtis's "New Direction"; LambdaMOO's 1993 petition/ballot self-governance.
- Discworld MUD docs/wiki: <https://dwwiki.mooo.com/wiki/Skills> and <http://discworld.atuin.net/lpc/playing/documentation.c?path=/concepts/skills> — seven skill trees, depth*5 gating, the TM (TaskMaster) learn-by-doing system; <http://discworld.atuin.net/lpc/playing/documentation.c?path=/concepts/crafting> (craft skill constellations).
- Bartle, Richard A. *Designing Virtual Worlds* (New Riders, 2003), <https://en.wikipedia.org/wiki/Designing_Virtual_Worlds> — persistence definition; permadeath advantages (no permanent early-adopter power, content reuse, "default fiction of real life"). Permadeath definition: <https://en.wikipedia.org/wiki/Permadeath>.
- tab notes: `next-gen-engine-architecture.md` (the inversion; Layers 1/3/5/6; DSL + behaviour system; ⊤ as content; federation), `the-self-running-world.md` (log-as-save, crash recovery, alive-vs-empty), `perception-as-umwelt-filter.md` (presence as Umwelt; attribution boundary), `economy-is-predicate-richness.md` (append = build; economy of attention), `player-is-a-fiber.md` (no privileged builder/player type).
- tab code: `being/doing/practicing/scripts/practice.mjs` (skills-as-closure), `being/library/value/library/closure/scripts/closure.mjs`, `being/doing/observing/voicing/scripts/voice.mjs` (interlocking voices), `being/doing/federating/scripts/federate.mjs` (G-Set union, `admit`, cross-server identity).
