---
title: Design Pillars
description: "Audience: everyone who designs, builds, or reviews any part of the weiqi platform. The five commitments every feature must satisfy, each with decision tests. Subordinate design documents in this directory derive from these pillars and cite them."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
---


These five pillars are the platform's design constitution. A feature that fails a pillar's decision test does not ship, whatever its engagement numbers promise. Where pillars conflict in a particular design, the earlier-numbered pillar wins, and the conflict gets written down in the relevant design document.

The pillars presuppose the board-approved [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md) and the ludics corpus (magic circle, paidia–ludus, the rhetorics of play). They are the plan's product thesis — *the game explains itself* — worked out into enforceable commitments.

## Pillar 1 — Do first, name after

A newcomer places a stone within seconds of arriving. Vocabulary lands on lived experience: the app never explains a concept the player hasn't already enacted, and when it names one, the name is the glossary's, linked at the moment of relevance. The glossary is not a reference the player visits; it is the voice the app speaks in, and it speaks about things the player just did.

This inverts the usual tutorial contract. We do not teach-then-test; we arrange for the experience, then hand over the word for it. The kernel's semantic event layer exists precisely so the app knows *when the experience happened*.

**Decision tests.**
- Can a first-time visitor act on the board within ten seconds, with no account, no modal, no video?
- Does this feature introduce any term before the player has enacted the thing it names?
- When this feature names a concept, does the name link to the glossary term, and is it uttered at the moment the concept is live on the board?

**Forbids:** walls of rules text before play; tutorials that quiz before they let you act; app-invented vocabulary that shadows the glossary.

## Pillar 2 — Feedback while the decision is still warm

Go's pedagogical curse is the feedback desert: consequences arrive fifty moves after causes, diffused across the whole board. Every system we build works to compress that distance. A win-rate graph is not feedback; it is an autopsy without a finding. Feedback here means: the player can act differently *in the very next game* because of what we showed them.

Three canonical instruments (each specced in its own document): the **cause-chain post-mortem**, which tells a group's death as a short story of its decisive moments rather than a percentage dip; **counterfactual replay**, which lets the player branch into the move they didn't play and play it out, so the lesson is enacted rather than recited (Pillar 1 applies to feedback too); and the **legibility layer**, which translates engine judgment into glossary-vocabulary assertions sized to the player's rank.

**Decision tests.**
- Can the learner state, in glossary vocabulary, one thing this feedback tells them to do differently next game?
- Is the feedback anchored to a specific decision of theirs, at a specific moment, on a board they can see?
- Could they *enact* the alternative rather than merely read it?

**Forbids:** raw win-rate deltas or point swings shown to players below the rank where those are actionable; feedback that arrives only at game end when it was knowable mid-game (for learning modes); analysis screens with no path back onto the board.

## Pillar 3 — Opponents are teachers wearing masks

Difficulty is a cast of characters, not a slider. Every designed opponent has a legible style, a named flaw, and a lesson it exists to teach — and it teaches by *losing to that lesson*. The boss teaches the mechanic that defeats it: the overconcentrated opponent falls to the player who has just learned efficiency; the one who clings to dead stones falls to the player who has just learned when a group cannot live. An opponent whose defeat teaches nothing is not content; it is filler.

Strength calibration serves the flow channel — challenge held just above skill — but character serves comprehension: the player should be able to say what their opponent tends to do, predict it, and punish it. Predict-and-punish is the beginning of reading, smuggled in as personality.

**Decision tests.**
- What, in glossary vocabulary, does beating this opponent teach — and does the opponent's play make that lesson findable by the player it's aimed at?
- Is the opponent's flaw legible enough that the target player could describe it after three games?
- When the player loses, does this opponent's play produce post-mortems (Pillar 2) that point at one thing, not everything?

**Forbids:** uniformly weakened engines presented as levels; opponents that win by exploiting reading depth the target rank cannot have; a difficulty ladder whose rungs differ only in number.

## Pillar 4 — Calm by construction

The platform manufactures no urgency and no guilt. No streaks, no lives, no expiring rewards, no variable-ratio reward boxes, no engagement-bait notifications. Ratings whisper: hidden by default for learners, surfaced as trends in plain language, with learning games that never count and no ceremony around losses. Losing near half your games is presented — truthfully — as the healthy state of a person who is learning, which our own rank lesson already teaches.

Motivation comes from three honest sources: visible mastery (the concept graph filling in with evidence), story (the canon, the cast, your own games retold), and belonging (Pillar 5). If a feature's retention case rests on discomfort — fear of loss, fear of falling behind, fear of breaking a chain — it is rejected regardless of its numbers.

**Decision tests.**
- Would we still build this feature if we could not measure engagement?
- Does it create any anxiety the player didn't bring with them?
- Can the player put the app down for a month and return to warmth rather than penalty?

**Forbids:** streak mechanics; daily-quest guilt; rating changes as spectacle; leaderboards as default surfaces; notification strategies designed around loss aversion.

## Pillar 5 — A place in the lineage

Weiqi is a four-thousand-year-old culture, and the platform's job is to induct players into *that*, not into a proprietary substitute. Teaching lineage is a first-class object: who taught you, whom you teach, visible as a tree — because that is how Go's real history is structured, and because teaching is the highest tier of mastery evidence. Clubs outrank lobbies. Ritual is designed, not skipped: the nigiri, the bow at start and end, the quiet room that strips every interface element but the board — the magic circle drawn deliberately. The canon is playable: classic games as documentaries you step into and try yourself.

Everything here should deepen the player's membership in the actual Go world — its clubs, its literature, its etiquette, its history — so that a player who outgrows us walks into any Go club on earth already at home.

**Decision tests.**
- Does this deepen membership in the real, historical Go culture, or only in our app?
- Does it create an occasion for one player to teach another — and does the teacher gain standing (lineage), not points?
- Would a traditional Go teacher recognize the practice this feature encodes?

**Forbids:** gamification currencies that displace Go's own forms of standing; social features that reward volume over care; stripping ritual for the sake of a funnel metric.

## How the pillars bind the roadmap

Phase 1 (Learn) already embodies Pillars 1 and 4 and carries the seeds of 2 and 3 (semantic events; the scripted bot pair as the cast's first two masks). Phase 2 (Play) must arrive with Pillar 4's rating posture built in, not retrofitted. Phase 3 (Understand) is Pillar 2's full instrument set and inherits the legibility layer's assertion schema. Phase 4 (Belong) is Pillar 5 made operational, and its social systems are constrained by Pillar 4's calm oath from their first design sketch.

Subordinate design documents in this directory each cite the pillars they serve and record any tension they resolve.
