---
name: player-motivation
description: What makes a player keep playing, read through the empirical psychology of game engagement (Self-Determination Theory; Csikszentmihalyi's flow; Nick Yee's achievement/social/immersion factors; presence & the magic circle) and mapped onto concrete tab systems. SDT's three needs land on real morphisms — autonomy ↔ non-confluence + play-as-any-fiber, competence ↔ practice/closure, relatedness ↔ socialize/factions. Extends ludics-grounding (flow = the potential bilattice) and perception-as-umwelt-filter (presence = the Umwelt projection), not repeating them. FACTS from the literature kept separate from tab PROPOSALS.
---

# Player motivation, mapped to tab

`ludics-grounding` already reads tab's algebra through play *theory* — Caillois, Huizinga, Sutton-Smith — and lands flow on the potential bilattice.
This note sits next to it and reads the algebra through the empirical *psychology* of why a player keeps playing: what the measurement literature (not the philosophy of play) says drives engagement, and where each finding already has a home in tab's running morphisms.
The two notes share a spine — flow — but approach it from opposite ends: ludics-grounding from Csikszentmihalyi-via-Caillois, this one from Deci-&-Ryan-via-Rigby-&-Ryan.
Where they touch I point across rather than repeat.

Throughout, **theory-facts** (what the cited researchers found) are kept apart from **tab-proposals** (what I, reasoning from those facts, claim about tab's systems).
The proposals are mine; the facts are the papers'.

## Theory: four research traditions on what holds a player

### Self-Determination Theory (the engine of intrinsic motivation)

**Fact.** Deci & Ryan's Self-Determination Theory holds that intrinsic motivation — doing a thing for its own sake — is sustained by the satisfaction of three innate psychological needs: **autonomy** (acting from one's own volition, being the origin of one's behaviour, not controlled), **competence** (feeling effective, meeting optimal challenge, mastering), and **relatedness** (feeling connected to and mattering to others) (Ryan & Deci, 2000, *American Psychologist*).
Crucially the theory is about *intrinsic* motivation: extrinsic rewards (points, prizes) can *undermine* it — the over-justification effect — when they shift the perceived locus of causality from internal ("I do this because I want to") to external ("I do this for the reward").

**Fact.** Rigby & Ryan carried SDT into games directly.
In four studies, Ryan, Rigby & Przybylski (2006, *Motivation and Emotion* 30, 344–360) found that **in-game autonomy and competence predict enjoyment, preference, and short-term changes in well-being** before-to-after play — and that these need-satisfactions, not graphics or violence or genre, are the motivational "pull."
Their book *Glued to Games* (Rigby & Ryan, 2011, Praeger/ABC-CLIO) generalises this: a game holds players to the degree it *satisfies* autonomy, competence, and relatedness, and the same lens explains both healthy engagement and the unhealthy kind (see `engagement-ethics`).
Their slogan is that games are "virtual proving grounds" for the basic needs — the medium is unusually good at delivering competence and autonomy on demand, which is exactly why it pulls so hard.

### Flow (the channel between anxiety and boredom)

**Fact.** Csikszentmihalyi's flow is the state of complete absorption in an activity whose challenge is matched to the actor's skill: too much challenge for the skill yields **anxiety**, too little yields **boredom**, and flow is the narrow channel between them, requiring clear goals, immediate feedback, and a sense of control (Csikszentmihalyi, *Flow: The Psychology of Optimal Experience*, 1990).
It is the experiential counterpart of SDT's competence-at-optimal-challenge.

`ludics-grounding` already grounds flow in tab as *the potential bilattice* — "enough predicates on both sides that ⊙/⇒ produces a MIX of t, f, and ⊤ … ⊥ alone is boring. t alone is trivial. f alone is defeat. ⊤ alone is chaos.
Flow is the mix" — and notes it is a readable histogram over the glyphs `respond` already emits. **I do not repeat that here.** I only add the SDT bridge: the anxiety/boredom axis Csikszentmihalyi names is the *competence* need under- or over-supplied, so tab's glyph-histogram (a competence-supply meter) and SDT's competence need are two readings of one quantity — see the competence mapping below.

### Yee's empirical motivation factors (achievement / social / immersion)

**Fact.** Nick Yee, factor-analysing surveys of thousands of MMORPG players, derived an empirical model of *why* people play online worlds: ten subcomponents loading onto **three** overarching components — **Achievement** (advancement, mechanics/optimisation, competition), **Social** (socialising, relationship, teamwork), and **Immersion** (discovery, role-play, customisation, escapism) (Yee, "Motivations for Play in Online Games," *CyberPsychology & Behavior* 9(6), 2006, 772–775).
These are *not mutually exclusive types* — a player carries all three at varying strength — and they cross-cut demographics and in-game behaviour.
(This is the empirical successor to Bartle's a-priori player taxonomy; the dedicated Bartle reading lives elsewhere and is **cross-referenced, not duplicated** — Yee's contribution is that the dimensions were *measured*, not posited, and that they are graded, not categorical.)

### Presence, immersion, and the magic circle

**Fact.** Huizinga's *Homo Ludens* (1938) names the **magic circle**: "a temporary world within the ordinary world, dedicated to the performance of an act apart" — the bounded space inside which play's rules hold.
Salen & Zimmerman (*Rules of Play*, MIT Press, 2004) carry it into game design as the boundary across which ordinary objects take on game-meaning. **Fact.** Brown & Cairns ("A Grounded Investigation of Game Immersion," CHI '04 Extended Abstracts, 1297–1300), interviewing players, found immersion is *graded in three levels*: **engagement** (you invest attention), **engrossment** (the game's world emotionally absorbs you), and **total immersion / presence** (you cease to attend to your surroundings and feel *in* the world).
Presence is the deep end of that ladder. **Fact.** In *text* worlds specifically, embodiment is supplied by the reader: a MUD has no rendered avatar, so presence rests entirely on the consistency and responsiveness of the described world — the prose has to behave like a place.

## tab-proposals: the three SDT needs land on three tab morphisms

Here is the claim of this note.
SDT's three needs are not a checklist to bolt onto tab; each already names the felt experience of one of tab's *built* systems.
I argue the mapping need-by-need.

### Autonomy ↔ non-confluence + play-as-any-fiber (genuine choice, no privileged self)

**Proposal.** Autonomy in SDT is being the *origin* of one's action with a genuine alternative — not picking from a menu someone wrote. tab supplies this at two depths, both already noted:

- **Genuine choice is non-confluence, not a dialogue tree.** `non-confluence-is-choice` records that real choice in a tab world is a place where the settlement algebra has *more than one incomparable normal form* (voidmath F6, bypass chains ≥3) — "the algebra itself presents genuine forks where the future isn't determined," not a branch the designer authored.
  This is the strongest possible substrate for autonomy: the fork is a property of the world's geometry, so the player is *actually* the origin of which timeline obtains, not the chooser of a pre-written outcome.
  (tab's tick is confluent today; the fork-read is a next-phase morphism — so this is the autonomy tab is *built to support*, not yet to deliver in full.)
- **No privileged player.** `player-is-a-fiber` records that a player is just an `actor` whose `mover` is a session — "you act by choosing which messages to send, what happens is what respond() computes" — and that one can in principle play *any* closed fiber (the wind, a debt, a rumour).
  Autonomy is maximised when even *what you are* is unconstrained: the engine imposes no fixed self, only a fiber you steer.

The over-justification warning from SDT (extrinsic rewards crowding out intrinsic motivation) is why this matters structurally and not just thematically — see `engagement-ethics` for the claim that tab's honest log makes the *autonomy-supportive* path the natural one.

### Competence ↔ practice + closure (mastery as settlement, not a designed gate)

**Proposal.** Competence in SDT is feeling effective against optimal challenge; flow is its experiential channel. tab measures *both* with morphisms already built:

- **Skill is closure convergence, not a level number.** `practice.mjs` defines a skill as the predicate `skill:<name>` an actor holds at a *degree* — its bilattice value plus supporting cells — and practising files reinforcing evidence so "the skill cell settles toward its fixed point as evidence accrues.
  There is NO level number and NO designed gate."
  Success files a positive row (→ t), failure the declared converse `unskill:<name>` (→ f), and a succeeded-then-failed skill settles to **⊤** ("a contested skill — a real situation, e.g. learned-then-regressed").
  Competence here is *earned settlement*, the felt-effective need met by the player's own accruing evidence rather than a number the designer hands out — exactly the intrinsic-not-extrinsic shape SDT prescribes.
- **Progression *is* closure distance.** `closure.mjs` reads "mood / experience off a settled being as CLOSURE DISTANCE … A fiber is CLOSED when every cell is determined (not ⊥) and non-contradictory (not ⊤); at that fixed point its distance is 0."
  Meaningful progression is the fiber closing — open ⊥ cells (honest ignorance) and contested ⊤ cells shrinking toward a settled whole.
  This is a competence *gauge* the engine already computes, and it is the same `closed` predicate the tower-fold growth step uses, lifted to a quantity.
- **Flow is the optimal-challenge band on that gauge.** Tie this to `ludics-grounding`'s glyph-histogram: a fiber producing *only* t against its situation is trivial (boredom, challenge under-supplied); *only* f is defeat (anxiety, challenge over-supplied); the flow channel is the *mix*.
  So Csikszentmihalyi's channel and SDT's competence-at-optimal-challenge are, in tab, one readable distribution over the glyphs `respond` emits — the competence need has an instrument.

### Relatedness ↔ socialize + factions (opinion as composing fibers)

**Proposal.** Relatedness in SDT is feeling connected to and mattering to others. tab computes relationship the same way it computes every interaction — by composing fibers, never by rolling dice:

- **An opinion is a composed fiber.** `socialize.mjs` reads "relationships as COMPOSING fibers … A's stance toward B is a function of how their social make-up AGREES or OPPOSES — shared traits pull toward friendship, opposed traits toward rivalry, and a fiber that supplies BOTH warm and cold evidence settles to ⊤ (ambivalent — a real, contested relationship, not a bug)."
  Stance (`friend / rival / neutral / ambivalent`) is *derived from who the two parties are*, and the recorded `opinion-of:<other>` cell is the connection made durable.
  Relatedness here is not a reputation bar; it is a settled, inspectable, *reasoned* relationship — you can read why B is warm to you (the `basis`: shared traits, opposed traits, dispositions).
- **Mattering is mutual perception.** `perception-as-umwelt-filter` records that another actor's cuts stay private "until you perceive them" — so being *seen* by another fiber (your moves entering their frontier, their opinion folding your traits) is the engine's literal model of mattering-to-others.
  Relatedness is two Umwelten overlapping.
- **Factions are shared social signal at scale.** The same `socialize` machinery — shared disposition/traits pulling warm, opposed pulling cold — *is* the seed of factions: a faction is a cluster of fibers whose composed opinions co-warm.
  (The engine-systems layer's factions/memory is the scaled form; see `next-gen-engine-architecture` L2.)
  Relatedness at the group scale is the same composition, summed.

### Presence ↔ the Umwelt projection (the world behaves like a place)

**Proposal.** Brown & Cairns' total-immersion / presence — feeling *in* the world — rests, in a text MUD, on the world behaving consistently like a place. tab's `observing` is built for exactly this and `perception-as-umwelt-filter` already records it: perception is a *fiber filter*, not a query, so "two actors in the same place experience different worlds," and the renderer is "a formatter, not a generator" — "every line is a settled predication." **I do not repeat that note.** The presence-specific addition is: a rendered avatar is *replaced* by the Umwelt — your presence in a tab world is precisely the non-⊥ region your fiber picks out, and the world's consistency (which underwrites total immersion) is guaranteed by the world *being* a deterministic log rather than a bag of mutable state.
The magic circle, in tab, is the boundary of the log: step inside and every described thing is a settled row that will behave the same way on replay.

## What this buys, and what is deferred

The throughline matching `ludics-grounding`: the motivation psychology is not a layer to design *onto* tab — each of SDT's three needs already names the felt side of a morphism tab runs. **Already built and load-bearing:** `practice`/`closure` (competence as earned settlement), `socialize` (relatedness as composed opinion), the Umwelt projection (presence), and the glyph-histogram substrate for flow. **Deferred** (and flagged as such in the noted morphisms): the non-confluence fork-read that makes autonomy *fully* genuine (next-phase; tick is confluent today), session-binding to non-person fibers (the full play-as-anything closure), and scaled factions/memory (engine-systems layer).
The needs are mapped; some of the instruments are next phase.

## Sources

### Theory (the empirical psychology of engagement)

- Ryan, R.M. & Deci, E.L. (2000).
  "Self-Determination Theory and the Facilitation of Intrinsic Motivation, Social Development, and Well-Being." *American Psychologist* 55(1), 68–78.
  (autonomy, competence, relatedness; the over-justification effect)
- Ryan, R.M., Rigby, C.S. & Przybylski, A.
  (2006).
  "The Motivational Pull of Video Games: A Self-Determination Theory Approach." *Motivation and Emotion* 30, 344–360.
  (in-game autonomy & competence predict enjoyment and well-being)
- Rigby, S. & Ryan, R.M. (2011). *Glued to Games: How Video Games Draw Us In and Hold Us Spellbound*.
  Praeger / ABC-CLIO.
  (games as virtual proving grounds for the three needs)
- Csikszentmihalyi, M.
  (1990). *Flow: The Psychology of Optimal Experience*.
  Harper & Row.
  (the channel between anxiety and boredom)
- Yee, N.
  (2006).
  "Motivations for Play in Online Games." *CyberPsychology & Behavior* 9(6), 772–775.
  (achievement / social / immersion, measured by factor analysis)
- Huizinga, J.
  (1938/1949). *Homo Ludens: A Study of the Play-Element in Culture*.
  (the magic circle)
- Salen, K. & Zimmerman, E.
  (2004). *Rules of Play: Game Design Fundamentals*.
  MIT Press.
  (the magic circle in game design)
- Brown, E. & Cairns, P.
  (2004).
  "A Grounded Investigation of Game Immersion." *CHI '04 Extended Abstracts on Human Factors in Computing Systems*, 1297–1300.
  (engagement → engrossment → total immersion/presence)

### tab (the systems the needs map onto)

- `development/lab/tab/being/doing/practicing/scripts/practice.mjs` (skill as closure convergence; no level number, no gate)
- `development/lab/tab/being/library/value/library/closure/scripts/closure.mjs` (progression as closure distance)
- `development/lab/tab/being/doing/responding/socializing/scripts/socialize.mjs` (opinion as composing fibers; friend/rival/ambivalent ⊤)
- `development/lab/tab/being/doing/observing/needing/scripts/needs.mjs` (needs/mood/pressing)
- `docs/dev/notes/ludics-grounding.md` (flow = the potential bilattice — the glyph-histogram; not repeated here)
- `docs/dev/notes/perception-as-umwelt-filter.md` (perception = fiber filter; renderer-not-generator — the presence substrate)
- `docs/dev/notes/non-confluence-is-choice.md` (genuine choice = non-confluence, not a dialogue tree — the autonomy substrate)
- `docs/dev/notes/player-is-a-fiber.md` (no privileged player; play as any fiber — autonomy's ceiling)
- `docs/dev/notes/engagement-ethics.md` (the companion: why tab's substrate makes the autonomy-supportive path the natural one)
