---
name: bartle-player-types
description: Bartle's four player types (Achiever/Explorer/Socialiser/Killer), the two-axis interest graph, and the population-dynamics argument for designing for all four — read as theory FACTS, then mapped to tab's existing affordances (explorers ↔ worldgen + Umwelt, achievers ↔ skills-as-closure, socialisers ↔ voicing/comms/factions, killers ↔ the planned combat) and to the design choices that would serve every type without one driving the others out.
---

# Bartle's player types, and designing tab for all four

This note records Richard Bartle's taxonomy of MUD players as it stands in the source texts, then
maps each type onto machinery `tab` already has or has on its roadmap. The taxonomy is the oldest
and most cited frame for "who plays a persistent text world and what they want from it," so it is
the right lens for asking whether `tab`'s affordances reach everyone — and what happens to a world
when they don't.

THEORY (what Bartle's papers say) and PROPOSAL (what `tab` might do) are kept apart below.

## THEORY — the four types

Bartle's "Hearts, Clubs, Diamonds, Spades: Players Who Suit MUDs" (1996) identifies four playing
styles, "arising from the inter-relationship of two dimensions of playing style: action versus
interaction, and world-oriented versus player-oriented." They map onto the four card suits:

- **Achievers (Diamonds ♦)** — players who "give themselves game-related goals, and vigorously set
  out to achieve them": levels, treasure, the most powerful weapon, being rich. Achievement *within
  the game context* drives them; "points-gathering and rising in levels" is the main goal.
- **Explorers (Spades ♠)** — players who "delight in having the game expose its internal
  machinations," who prefer discovering areas and the world's physics; they "dig around," hence
  Spades. The map and the mechanics are the prize.
- **Socialisers (Hearts ♥)** — players "interested in people, and what they have to say. The game
  is merely a backdrop." Relationships, conversation, and role-play are the point.
- **Killers (Clubs ♣)** — players motivated by "imposing themselves on others," by powergaming and
  eclipsing others; in Bartle's sharpest phrasing, by "the knowledge that a real person, somewhere,
  is very upset" because of what they did.

## THEORY — the interest graph

The four types sit on a two-axis grid. In Bartle's own words: "The x-axis goes from an emphasis on
players (left) to an emphasis on the environment (right); the y-axis goes from acting with (bottom)
to acting on (top)." That yields the quadrants:

```
              ACTING (on)
                  |
   KILLERS  ♣     |    ♦  ACHIEVERS
                  |
  PLAYERS --------+-------- WORLD
                  |
 SOCIALISERS ♥    |    ♠  EXPLORERS
                  |
            INTERACTING (with)
```

The diagonals matter: "Achievers and Explorers prefer to act on the world, while Socialisers and
Killers prefer to interact with other entities." Achievers act *on the world* (top-right); Killers
act *on other players* (top-left); Explorers interact *with the world* (bottom-right); Socialisers
interact *with other players* (bottom-left). Bartle later added a third axis — *implicit vs
explicit* — splitting each type in two (Planner/Opportunist achievers, Scientist/Hacker explorers,
Networker/Friend socialisers, Politician/Griefer killers); the 8-type version is, in his words,
"3D; it's therefore much harder to draw," and *Designing Virtual Worlds* (2003) carries the
expanded model.

## THEORY — the dynamics (why you must design for all four)

The deepest point of the 1996 paper is not the four boxes but how their populations feed back on
one another, so that a world tends toward one of a few stable mixes:

- **Killers and achievers equilibrate.** "Increasing the number of achievers will increase the
  number of killers, which will in turn dampen down the increase in the number of achievers."
  Achievers are prey; killers follow the prey; the predation caps the achievers.
- **Socialisers amplify.** The socialiser population has "both positive and negative feedback on
  itself, which amplifies any changes" — a social world can boom or collapse fast.
- **Explorers stabilise, uniquely.** "Massively increasing the number of explorers is the *only*
  way to reduce the number of killers without also reducing the player numbers in other groups."
  Explorers don't feed killers (they're hard to upset and hard to find) and they don't flee them,
  so they dilute the killer-to-everyone-else ratio without scaring anyone off.
- **Three stable configurations emerge.** A killer/achiever equilibrium (a "gamelike" MUD), a
  socialiser-dominated one (a "social" MUD), and — Bartle's hardest to reach but most desirable —
  one "where all groups have a similar influence (although not necessarily similar numbers)," held
  in balance because the killer population is checked by explorers while the others coexist.

The design lesson: a world is not a static menu of features for four audiences; it is a dynamical
system whose feel is set by the *ratios* between the types, and those ratios are something a
designer steers by what the world makes easy. Serving only one type is how a world ends up "social"
or "gamelike" by accident — or empty, when killers run unchecked and the achievers and socialisers
they prey on leave.

## tab maps each type onto machinery it already has

`tab`'s thesis is "one algebra, no subsystems" (`next-gen-engine-architecture`): mood, combat,
crafting, dialogue, ecology are the same `respond`/fold arithmetic over fibers. That is an unusual
starting point for the Bartle frame, because it means the four types are not four feature-areas to
build but four *readings* of the same substrate. Each type's pleasure is a different projection of
fibers, perception, and settlement.

### Explorers ↔ worldgen + the Umwelt frontier

Explorers want the world to "expose its internal machinations." `tab` has two affordances aimed
squarely here. First, **worldgen** already lays down breadth — the roadmap records 40 generated
areas (`next-gen-engine-architecture`, "Where we are") — so there is territory to dig through.
Second, and more distinctive, the **Umwelt perception model** (`perception-as-umwelt-filter`)
makes the *machinations themselves* the discoverable content: "each entity's fiber determines what
it perceives, which determines its environment," so "two actors looking at the same harbor see
different things." Exploration in `tab` is not only "what rooms exist" but "what does this fiber let
me sense that another doesn't" — the world is layered by apparatus, and an explorer's project is to
widen their `perceives` set. The append-only log gives a second explorer affordance the roadmap
already names: forkable/replayable/diffable timelines (time-travel, ghost replays). For the
Scientist explorer, a world whose entire history is inspectable and re-foldable is the richest
possible object of study.

### Achievers ↔ skills-as-closure (no level number, no designed gate)

Achievers want goals and the measurable closing of them. `tab`'s **practice/closure** system is an
unusual achiever surface because it refuses the usual instrument. `practice.mjs` is explicit:
"there is NO level number and NO designed gate — 'advancement' is just the sub-fiber CLOSING." A
skill is "a predicate an actor HOLDS AT A DEGREE" (the cell `skill:<name>`), success files positive
evidence and failure files the converse, and the cell settles toward its fixed point as evidence
accrues. `closure.mjs` turns this into a quantity: a fiber is "CLOSED when every cell is determined
(not ⊥) and non-contradictory (not ⊤); at that fixed point its distance is 0," and `distance` is
"the count of cells holding it OFF that point." So an achiever's progress *is* closure distance
shrinking — a real, readable number — and "richness" (`economy-is-predicate-richness`) gives the
other achiever metric: value is "computed from fiber richness," so getting richer is accumulating
determined cells. The achiever gets goals and a scoreboard without `tab` ever hardcoding XP or
levels; both are reads over the same fibers everyone else uses.

### Socialisers ↔ voicing, comms, factions

Socialisers want people and what they say. Two layers serve them. The planned **comms** (roadmap:
say/tell/channel/mail) and **factions/memory** (Layer 2) are the literal social surface. But `tab`
also has a deeper, already-built socialiser affordance: **voicing** (`voice.mjs`), where "a skill
is its OWN actor — a being with a fiber," and an actor's skills `respond` to a situation as a
chorus of glyphs (assert / fail / argue-with-itself / stay-silent). This is the Disco-Elysium
re-reading, and it makes the *inner* social world legible — a player relates not only to other
players but to a population of voices inside their own fiber. For the Networker/Friend split,
`located-in` dual-filing and the converse-evidence machinery already record who was where with
whom; a relationship is a sub-fiber, not a separate friends-list subsystem.

### Killers ↔ combat (planned), and ⊤ as the honest record of conflict

Killers want to impose themselves on others. Combat is named as a Layer 2 engine system the roadmap
still has to "interlock," so this is the type `tab` serves least today — which, by Bartle's
dynamics, is a *safety* property as much as a gap: a world that ships breadth (explorers) and
social depth (socialisers) before it ships frictionless player-killing is biased toward the stable,
populated mixes rather than the killer-dominated collapse. When combat lands, the substrate already
has the right honesty about conflict: contradiction is a first-class value, the bilattice **⊤** is
"contradiction as a VALUE, not a bug" (`next-gen-engine-architecture`; `economy-is-predicate-
richness`). A contested fact about a fight — who struck first, whether a kill was fair — settles to
⊤ and is *shown*, not adjudicated away. That is exactly the material a moderation/governance layer
needs (see `mud-design-lineages` on griefing and the social contract).

## PROPOSAL — designing tab for all four, and steering the ratios

Reading Bartle's dynamics against `tab`'s affordances suggests concrete, additive choices (none of
these is built; each is a read or an append, in keeping with "one algebra, no subsystems"):

- **Lead with explorers to cap killers.** Bartle: explorers are "the *only* way to reduce the
  number of killers without also reducing the player numbers in other groups." `tab`'s strongest
  built affordance — worldgen breadth plus Umwelt-layered perception plus replayable timelines — is
  an explorer affordance. Shipping the demo world (Layer 6) as something genuinely deep to *dig
  through and re-fold* is, by the dynamics, also the cheapest griefing control the engine has.
- **Make achievement a read, never a gate.** Keep `closure`/`richness` as the achiever scoreboard
  and resist adding a hardcoded level ladder; a designed gate would re-introduce the very "level
  number" `practice.mjs` deliberately refuses, and would make achievers prey in a fixed, farmable
  way that feeds killers.
- **Give socialisers stakes, not just a chat channel.** Factions-with-memory plus dual-filed
  relationships turn "people" into a sub-fiber the world remembers; that is what keeps a socialiser
  world from being a featureless lobby (the "alive vs empty" question in `mud-design-lineages`).
- **Gate killers through the same algebra, and surface ⊤.** When combat ships, let conflict settle
  to ⊤ and be visible, so the world *records* who imposes on whom rather than silently overwriting
  it — the raw material for both permadeath-style consequence and community governance.
- **Measure the mix.** Because every type's pleasure is a read over fibers, `tab` can in principle
  *measure its own Bartle ratios* (how much closure-seeking vs. perception-widening vs. voicing vs.
  conflict each session does) directly off the log — a diagnostic no save-file engine can take
  cheaply. Steering the ratios Bartle describes becomes an observability feature, not guesswork.

## Sources

- Bartle, Richard A. "Hearts, Clubs, Diamonds, Spades: Players Who Suit MUDs" (1996), <https://mud.co.uk/richard/hcds.htm> — the four types; the x/y interest graph ("x-axis … players … to … environment; y-axis … acting with … to acting on"); the population dynamics (achiever↔killer equilibrium, socialiser amplification, explorers as the unique killer-reducer, the three stable configurations).
- Bartle, Richard A. *Designing Virtual Worlds*. New Riders, 2003 — the expanded model and the implicit/explicit third axis; <https://en.wikipedia.org/wiki/Designing_Virtual_Worlds>.
- "Bartle taxonomy of player types," Wikipedia, <https://en.wikipedia.org/wiki/Bartle_taxonomy_of_player_types> — suit mappings; the 8-type split (Planner/Opportunist, Scientist/Hacker, Networker/Friend, Politician/Griefer).
- tab notes: `next-gen-engine-architecture.md` (one-algebra thesis, worldgen breadth, ⊤ as content, roadmap combat/comms/factions); `perception-as-umwelt-filter.md` (per-fiber perception); `economy-is-predicate-richness.md` (value as richness); `player-is-a-fiber.md` (no privileged player type).
- tab code: `being/doing/practicing/scripts/practice.mjs` (skills, "NO level number and NO designed gate"); `being/library/value/library/closure/scripts/closure.mjs` (closure distance); `being/doing/observing/voicing/scripts/voice.mjs` (skills as arguing voices).
