---
title: Opponent Cast
description: "Audience: builders and reviewers implementing bots, matchmaking, and post-game feedback for the weiqi platform. Pillar 3 (opponents are teachers wearing masks) made operational: the doctrine, the eight designed opponents, and the tier at which each can actually be built."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
references:
  katagohumansl2024:
    authors:
      - "lightvector (KataGo project)"
    title: "KataGo Human SL Network and rank-conditioned HumanSLProfile settings"
cites:
  - katagohumansl2024
---


This document serves [Pillar 3 — Opponents are teachers wearing masks](./design-pillars.md), and touches [Pillar 1](./design-pillars.md), [Pillar 2](./design-pillars.md), and [Pillar 4](./design-pillars.md) at the seams noted below. It answers one question for each of eight designed opponents: what does losing to this one teach, and how, concretely, does its play make that lesson findable rather than merely true?

It does not spec the legibility layer's rendering grammar or the cause-chain post-mortem's data model — those are their own documents. What follows is the cast those instruments will speak about.

## Doctrine

### Difficulty as characters, not a slider

A slider says "harder." A character says "this one always answers the small threat" or "this one has never once connected two of its own groups." Both make games harder to win, but only the second gives the player something to *learn about the opponent* — and, per Pillar 1, vocabulary lands on lived experience: three games against a named opponent should teach the player to describe its flaw, in their own precise terms, before the app's post-mortem ever spells that flaw out for them in glossary vocabulary. (This is a claim about the *flaw's technical description*, not about the *opponent's name or mask* — see "Where Pillar 3 meets Pillar 4," below, for why those two are allowed different timing, and for the tension between them this document owes the reader per [design-pillars.md](./design-pillars.md)'s tie-break rule.)

This is why the cast is fixed and small, not procedurally generated or continuously scaled. A generated difficulty curve has no character to become fluent in. Eight opponents, each with one flaw stated precisely enough to test for, is the entire design surface — everything else about an opponent's play should be as strong as the tier allows, so the flaw reads as a *choice*, not a ceiling. An opponent that is weak everywhere is not a character; it is the slider wearing a name, which is exactly what Pillar 3 forbids ("uniformly weakened engines presented as levels").

### The boss teaches the mechanic that defeats it

Every entry below names its lesson before its defeat condition, and the two are the same fact stated twice: you beat this opponent by doing the thing it cannot do. This is stronger than "the opponent has a weakness" — a weakness is something you exploit once you've found it by luck or by tooling. A taught lesson is something the opponent's own consistency *teaches you to look for*, because the flaw fires the same way every game.

That consistency is the actual design constraint, not the flaw's cleverness. An opponent whose flaw only appears once in ten games is not a character, it's noise; the "How the lesson becomes findable" field for each opponent below states the behavioral rule as something a builder can check for firing on (close to) every eligible game, the same way `greedyCaptureBot`'s rank order in [`bots.mjs`](../../../../../apps/weiqi-learn/public/js/lib/bots.mjs) fires deterministically rather than probabilistically.

### Predict-and-punish as smuggled reading practice

Caillois's *agon* — play as contest under formal equality, decided by skill rather than chance — is the ludics curriculum's own [Theories of Play](../../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/social-theory-science-services-section/services/ludics-science-services-section/services/game-ludics-services-section/content/text/documents/articles/notes/theories-of-play.md) lesson's account of what this cast is doing structurally. The claim that follows is this document's own, not the source lesson's: *agon* only works as a *learning* structure, as opposed to a contest decided by whoever happens to read deepest that day, if the contestant's tendencies are legible enough to predict — Theories of Play defines agon, it does not make this argument about predictability, and this document should not have implied otherwise. That legibility is the entire point of naming and typing the cast: "predict what The Debtor will do, then punish it" is reading practice wearing a game's clothing, the same move the corpus's own life-and-death and tesuji material eventually asks for directly, arrived at here without the player noticing they've started reading ahead.

The doctrine test is that same lesson's account of Sutton-Smith's rhetorics of play, held up against this design. A cast built around dominance — beat it, gloat, move on — would be operating in his rhetoric of *power*, which Pillar 4 rules out (no ceremony around losses, no anxiety the player didn't bring). A cast built around noticing a pattern and getting better at seeing it operates in the rhetorics of *progress* and *self* — skill growth and the private satisfaction of having read someone correctly. The masks (mildly playful character sketches) and the post-mortems (flat, mechanical, event-anchored) are deliberately different registers for exactly this reason; see Character-voice rules below.

### Where Pillar 3 meets Pillar 4

The tension: Pillar 3 wants the player to lose to a flaw before they can name it — that's how the lesson gets taught by experience rather than by warning label (Pillar 1). Pillar 4 wants no anxiety the player didn't bring. The resolution, binding on every opponent below: losing to a named opponent is *never* framed as failure, because the opponent's name is itself the disclosure — matchmaking copy for The Believer says, in effect, "this one is stubborn about eye shape," in advance, in mask language. The player who loses anyway loses to a flaw they were told about, which is closer to losing a fair contest than to being ambushed. No opponent in this cast may ship without its mask's flavor line making the flaw guessable before the first game starts.

**A conflict this document owes the reader, per [design-pillars.md](./design-pillars.md)'s tie-break rule.** Read against the Doctrine section above, this paragraph states the opposite timing rule for what can look like the same event: Doctrine says the opponent's flaw is named only *after* lived experience teaches it; this section says the mask's flavor line makes the flaw guessable *before* the first game starts. An earlier draft of this document stated both without ever noticing they were in tension, which is exactly the failure the tie-break rule exists to catch. They are reconcilable, but only because they govern two different things, and the distinction has to be stated, not assumed: a mask's flavor line ("stubborn about eye shape") is playful, pre-technical character description — matchmaking copy, not a glossary utterance — and it never contains a glossary term or a mechanically precise account of the flaw. The Doctrine section's claim is narrower and later: that the player arrives at the *precise, technical* description — the one a post-mortem would state in glossary vocabulary — through lived play, not from being told it up front. Where the two would actually collide — a flavor line written precisely enough that it *is* the technical description, or one that uses a glossary term before the concept has been enacted — Pillar 1 wins, per the constitution's earlier-numbered-pillar rule, and the flavor line must be rewritten to stay in mask language until it no longer collides. This is a real constraint on authoring the fixed voice-line tables (Roadmap obligations, below), not a settled fact about the ones already sketched above — each mask's existing flavor line in "The cast" section should be re-checked against this line once written for ship, not assumed compliant because it reads casually.

### What a fixed, named-and-defeated roster refuses to become

A fixed roster of eight named characters, each with a stated defeat condition, has the same shape as a mobile-game boss ladder — that resemblance is real and worth naming rather than waving off, because sequential named-boss-with-defeat-state is exactly the structure that family of game uses to drive a collection/completion hook. The pedagogical case for each opponent's flaw (above and below) is sound on its own terms, but soundness of the individual lessons doesn't automatically neutralize the aggregate shape they're arranged into. Two things follow from taking that seriously instead of asserting it away:

1. **No completion badge, ever, for this roster.** Nothing in this application may render a "cast completion: 6/8 defeated" stat, a checklist of beaten opponents, or any other aggregate count derived from which cast members a player has beaten — on a profile, a dashboard, or anywhere else. This is the same refusal [Mastery Model](./mastery-model.md#ui-stance) states for its own tier-and-confidence data and [Lineage and Clubs](./lineage-and-clubs.md#14-where-a-teachers-lineage-is-visible--the-exact-list) states for teaching counts, stated here explicitly because this document's roster is exactly the kind of enumerable, completable set that pattern targets, and an earlier draft of this document left the gap open.
2. **The retention case for the cast is honestly a live tension with Pillar 4, not a settled one.** [Calm Technology](./calm-technology.md#part-3--the-honest-retention-theory) proposes measuring rematch-by-cast-member as evidence the cast is doing real motivational work — which is Pillar 4's own forbidden question ("would we still build this if we could not measure engagement?") answered empirically, after the fact, unless the measurement is built carefully. That document's prediction has been rewritten to compare a named-cast rematch against a same-difficulty *anonymous* rematch, specifically to test whether the character framing is doing anything beyond what any specific continuation action would already predict — see its Part 3 for the current form. This document's obligation is not to prove that comparison in advance; it's to not ship the completion badge that would make the answer irrelevant by turning the roster into a checklist regardless of what the KPI says.

## The cast

Ladder position follows the onboarding ladder in the [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md#the-onboarding-ladder): capture-go on 7×7/9×9, full rules on 9×9, 13×13, then 19×19 at single-digit kyu. Glossary links are this document's termRefs; cluster names are the three named in the [weiqi topic page](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/topics/weiqi.md#terms) (tactical, scoring, structural).

### 1. The Wanderer — capture-go, 7×7 · tactical

**Mask.** The Wanderer has never noticed a plan is possible. It places stones the way rain falls, and it is exactly as easy to out-think.

**Flaw.** Plays uniformly at random among legal points regardless of [liberty](../../../../../../../content/text/glossary/terms/liberty.md) count; does not recognize its own stones in [atari](../../../../../../../content/text/glossary/terms/atari.md) and will not move to escape a threatened group or complete a [capture](../../../../../../../content/text/glossary/terms/capture.md) available to it.

**Lesson.** Capture is not a threat to fear, it is a target to finish: removing a group's last liberty removes the group.

**How the lesson becomes findable.** Every legal point is equally likely, so any capture the player sets up is never contested — the player's *own* capturing move is what ends the game, every time, with total consistency. Nothing else in the opponent's behavior explains a win, which is exactly what makes the causal chain (fill the last liberty → stones vanish) legible on the first or second try.

**Defeat condition.** Session status reports `ended`/`capture` with the player's color as winner — reachable the moment the player completes any deliberate capture sequence, since The Wanderer never defends one.

**Post-mortem shape.** Losses to The Wanderer are rare and always self-inflicted. The post-mortem names the single move where the player's own group reached zero liberties, and states explicitly that the capturing reply was chosen at random, not read — crediting judgment where none existed would violate Pillar 4's honesty and would give the player a false read to carry into the next opponent.

### 2. The Miser — capture-go / early 9×9 full rules · tactical

**Mask.** The Miser has counted every stone you have ever offered it, and forgotten none. Dangle one stone and it will always reach for it, even past a door standing open behind it.

**Flaw.** Ranks candidate moves strictly by [capture](../../../../../../../content/text/glossary/terms/capture.md) available > escaping [atari](../../../../../../../content/text/glossary/terms/atari.md) > giving atari > any quiet move, with no judgment of a capture's size relative to the rest of the board.

**Lesson.** Not every capture is worth taking — a small sacrifice can be played to lure a capture-hungry opponent away from the group that actually matters.

**How the lesson becomes findable.** The priority order is deterministic (see `rank()` in [`bots.mjs`](../../../../../apps/weiqi-learn/public/js/lib/bots.mjs)): offer any legal capture and The Miser takes it, even with a larger uncaptured group sitting one move away. A player who deliberately offers a one- or two-stone sacrifice near an edge, while building strength around a bigger group elsewhere, watches the pattern hold every single game.

**Defeat condition.** Win the game (capture-go target, or score) with a game record containing at least one move where The Miser captured a group of size ≤ 2 while a larger opportunity — an unresolved atari against its own group, or a bigger enemy group — went untaken.

**Post-mortem shape.** When the player loses, the post-mortem points at the move where the group the player meant to save shared a liberty count with the group they offered as bait — the two plans collided instead of staying separate, phrased as one moment, not a running score.

### 3. The Neighbor — full rules, 9×9 (early) · scoring, with a structural note

**Mask.** The Neighbor has never played a stone it could not touch. Ask it to cross open ground and it will decline, in favor of one more stone against its own wall.

**Flaw.** Restricts its candidate moves to points within a short board-distance of an existing stone (its own or the opponent's) whenever such a candidate exists, so it systematically under-values open [territory](../../../../../../../content/text/glossary/terms/territory.md) far from any stone and rarely plays a [connection](../../../../../../../content/text/glossary/terms/connection.md)-neutral opening move onto empty ground.

**Lesson.** Efficient territory-taking beats clustering — a single move on open ground can outweigh several contact moves near stones that are already settled.

**How the lesson becomes findable.** The distance filter runs before any tactical ranking, so large regions of the board go untouched by The Neighbor until nothing near a stone remains legal. A player who claims the open points early builds a territory lead The Neighbor structurally cannot contest, and the lead is visible on the board the whole game, not only at the count.

**Defeat condition.** Win by a territory margin at least the size of one empty corner (roughly 9 points on 9×9) — large enough that the margin is legible as "you took the open ground," not as a marginal tactical edge.

**Post-mortem shape.** Names the single largest region still open at a given move number and states which player claimed it first (or that neither did yet), in territory vocabulary — not a point-swing chart.

### 4. The Straggler — 9×9 (late) to early 13×13 · scoring

**Mask.** The Straggler cannot tell when a gathering is over. It keeps playing stones long after the boundary lines are drawn, filling its own doorway rather than admit the room is finished.

**Flaw.** Never initiates a [pass](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/pass.md); it keeps playing into settled positions — including its own territory — until either no legal point remains or the opponent has passed.

**Lesson.** Recognize when a game is effectively decided, and understand why the same "extra" move costs nothing under one scoring convention and a full point under another.

**How the lesson becomes findable.** Play The Straggler once under [territory scoring](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/territory-scoring.md) and once under [area scoring](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/area-scoring.md): under the first, its habit of filling its own territory costs it points live, on the board, while the player watches; under the second, the same habit costs nothing, which is itself the worked example the corpus's Ending the Game lesson describes in prose. [Dead stones](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/dead-stones.md) never enter the picture, since The Straggler stops only at a forced end, not a negotiated one.

**Defeat condition.** Pass first once the boundaries are settled, forcing the two-pass end condition; win by the resulting score.

**Post-mortem shape.** Names the move where the player passed, lists any dame or own-territory points The Straggler subsequently filled, and states plainly what each one cost under the ruleset actually in play.

### 5. The Loner — 13×13 · structural, with a tactical note

**Mask.** The Loner has two names for every stone on the board: mine, and someone else's. It has never once played a move whose only purpose was making two of its own into one.

**Flaw.** Suppresses any candidate move whose sole effect is [connection](../../../../../../../content/text/glossary/terms/connection.md) of two otherwise-independent groups of its own color, unless that same move is also a capture or an atari-escape.

**Lesson.** Find the cutting point and play it — a group whose life depends on a connection its owner won't make is a group you can isolate and out-liberty on worse terms than the rest of the board offers.

**How the lesson becomes findable.** The suppression is unconditional, so two of The Loner's groups visibly never touch even when contact would obviously help. A player who has just learned to look for cutting points always finds one waiting, because this opponent never spends the one move that would remove it.

**Defeat condition.** Play the cut that separates two of The Loner's groups, then win the resulting local liberty race against the weaker of the two — the same liberty-counting skill from The Wanderer, rehearsed at a harder, two-group scale.

**Post-mortem shape.** Names the cutting point by coordinate, the two groups it separated, and each one's liberty count at the moment of the cut — one decisive shape, per Pillar 2, not a running tally.

### 6. The Believer — 13×13 to early 19×19 · structural

**Mask.** The Believer has already decided this group lives, and no amount of reading will change its mind. It spends its turns elsewhere, certain the eyes are already made.

**Flaw.** Once a group has two internal empty points that resemble eyes, The Believer stops reinforcing that group's shape — even when one of those points fails the requirements of a real [eye](../../../../../../../content/text/glossary/terms/eye.md) and is in fact a [false eye](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/false-eye.md), leaving [life-and-death](../../../../../../../content/text/glossary/terms/life-and-death.md) status unresolved in its own favor.

**Lesson.** Verify two eyes, not two eye-shaped spaces — a false eye is not a liberty you can rely on, and a group can be provably dead while its owner keeps defending elsewhere as though it were settled.

**How the lesson becomes findable.** The Believer never plays the one reinforcing move that would convert its false eye into a real one, and never runs the group once it has "settled" — so a player who applies the two-eyes test correctly finds a single vital point that kills a group The Believer has stopped worrying about, in one local reading exercise.

**Defeat condition.** Play the vital point that removes the group's second real eye (or exploits the false eye directly), then complete the capture, or have the group confirmed dead at dead-stone settlement.

**Post-mortem shape.** Names the false eye's coordinate, states which requirement of a real eye it failed, and traces the short vital-point sequence that killed the group.

### 7. The Contester — early single-digit kyu, 19×19 · structural, with a tactical note

**Mask.** The Contester cannot leave a standoff alone. Show it a shared liberty and it will spend the game trying to win it, certain one more stone will settle things.

**Flaw.** When a local position matches a [seki](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/seki.md) pattern — mutually shared liberties, neither side able to fill without self-endangering — The Contester keeps playing into those shared liberties instead of leaving the position alone.

**Lesson.** Recognize seki and leave it: some standoffs are a genuine third outcome, and forcing the issue costs tempo, or the group itself.

**How the lesson becomes findable.** Any seki that forms in the game becomes a small, repeated lesson, because The Contester returns to prod it on a fixed cadence rather than abandoning it once. A player who recognizes the pattern — and remembers that dead-stone settlement never applies to a seki — profits elsewhere every time The Contester spends a move there instead.

**The one honest exception to "fires on close to every eligible game."** A seki is a rarer board event than any other opponent's trigger — every other cast member's flaw fires on a condition ordinary play produces close to every game (any capture, any two separable groups, any eye-shaped point, some ko fight); a seki specifically has to form at all, which it will not do in most games, especially on smaller boards. This document does not have data establishing how often that happens at "early single-digit kyu, 19×19" specifically, and nothing in the Implementation ladder below manufactures a seki — GnuGo's seki-detection scoring only reacts once one exists. The honest scope of this opponent, stated plainly rather than glossed over: on a game where no seki forms, The Contester still plays a complete, legible game at its ladder rung, but does not teach its namesake lesson that session — the character exists to teach the lesson *when the position produces one*, not to guarantee one every game. A defeat by ordinary score in a sekiless game is still a fair win; it simply isn't the specific lesson this entry is built around.

**Defeat condition.** Decline to resolve the seki and take the largest available point elsewhere on each of The Contester's prodding moves; win by the resulting margin (or by The Contester eventually self-endangering its own group inside the standoff, a legal but losing local play its flaw permits).

**Post-mortem shape.** Names the seki's location, counts the moves both sides spent on it, and states directly what that count was worth elsewhere — one tempo loss translated to one consequence, not a board-wide percentage.

### 8. The Debtor — single-digit kyu, 19×19 · tactical, with a scoring note

**Mask.** The Debtor answers every knock at the door, however small. Offer it the meanest [ko](../../../../../../../content/text/glossary/terms/ko.md) threat on the board and it always comes running, and it always comes first.

**Flaw.** In any ko fight (including one governed by [superko](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/superko.md) at higher board sizes), always answers the opponent's ko threat rather than judging its size, and never plays a threat of its own before recapturing.

**Lesson.** Judge a ko threat's size before answering it — ignoring a small one and retaking is often correct, and playing your own threat before recapturing wins exchanges The Debtor always loses.

**How the lesson becomes findable.** The response rule is a strict priority with no size comparison, so a player who offers a large bait "threat" gets a free reply every time, while any threat they don't want answered can be safely ignored, since The Debtor never punishes a skipped threat by simply taking the whole ko back uncontested. On single-digit-kyu boards this is the cast's first genuinely quantitative lesson — a threat's worth has to be weighed against the ko's — which is why it sits at the top of the ladder.

**Defeat condition.** Win the largest ko in the game either by playing a threat bigger than the ko's value before recapturing, or by declining to answer one of The Debtor's own small threats; the final score margin is traceable to that specific exchange.

**Post-mortem shape.** Lists the ko's threats in the order played with a plain-language size judgment ("bigger than the ko," "smaller than the ko"), and marks the one moment the sizes crossed — the [komi](../../../../../../../content/text/glossary/terms/komi.md)-adjacent framing ("what is this worth") that the corpus's komi-and-handicap lesson already asks players to reason with, applied here to a single local fight instead of the whole board.

## Concept-cluster map

| Opponent | Primary cluster | Secondary | Terms taught |
|---|---|---|---|
| The Wanderer | Tactical | — | liberty, atari, capture |
| The Miser | Tactical | — | capture, atari, liberty |
| The Neighbor | Scoring | Structural | territory, connection |
| The Straggler | Scoring | — | pass, dead stones, territory scoring, area scoring |
| The Loner | Structural | Tactical | connection, liberty |
| The Believer | Structural | — | eye, false eye, life and death |
| The Contester | Structural | Tactical | seki, liberty, capture |
| The Debtor | Tactical | Scoring | ko, superko, komi |

All three clusters from the [weiqi topic page](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/topics/weiqi.md#terms) get at least three opponents each; no cluster is served by a single character, so a player who has beaten every opponent in one cluster has necessarily faced its concept from more than one angle.

## Implementation ladder

A cast entry is not "the flaw" alone — everything else about its play has to be at or above the level the ladder rung implies, or the flaw stops reading as a choice and reads as universal weakness, which Pillar 3 forbids outright. That is the deciding factor in the table below, not raw engine strength: scripted heuristics are the right substrate exactly where the *whole opponent* is meant to be weak (rungs 1–2), and the wrong substrate the moment the flaw needs to sit inside otherwise-competent play (rungs 3–8), per the [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md#engines-and-ai)'s own bot-ladder ordering (scripted → GnuGo → KataGo human-style).

| Opponent | Scripted heuristics (now) | Shaped GnuGo (Phase 2) | KataGo human-style + policy constraints (Phase 3) |
|---|---|---|---|
| The Wanderer | **Native.** Exactly `randomBot` in [`bots.mjs`](../../../../../apps/weiqi-learn/public/js/lib/bots.mjs). | Not used — GnuGo's weak settings play *badly*, which reads as "has a bad plan," not "has no plan." | Not used. |
| The Miser | **Native.** Exactly `greedyCaptureBot` in [`bots.mjs`](../../../../../apps/weiqi-learn/public/js/lib/bots.mjs). | Not used, same reason as above. | Not used. |
| The Neighbor | Realizable through 9×9: a distance filter over the greedy ranking (worked example below). | Needed at 13×13+: the filter must restrict GnuGo's own candidate list, since scripted fighting strength is too weak to make the flaw's cost legible past 9×9. | Not required — the flaw is structural (a candidate restriction), not stylistic. |
| The Straggler | Fully realizable — the pass policy is a session-level rule, independent of move quality, and composes with any engine underneath. | Compose with GnuGo once surrounding play needs to be 13×13/19×19-competent. | Compose with a human-style net once the ladder rung calls for single-digit-kyu surrounding strength. |
| The Loner | Partial — the connection-suppression filter works, but a scripted bot's own cutting and fighting strength is too weak to make "punish the cut" a real fight past 9×9. | **Native.** Candidate filter layered over GnuGo's move generation; GnuGo's tactical reading supplies the fight the flaw is supposed to create. | Not required. |
| The Believer | Not realizable — judging a false eye needs real eye-shape and life-and-death evaluation, which scripted heuristics don't compute. | **Native.** GnuGo's own life-and-death reading supplies the judgment; the flaw is a policy override ("stop defending once two eye-shaped points exist") on top of it. | Optional refinement once single-digit-kyu surrounding style matters more than GnuGo's own idiosyncrasies. |
| The Contester | Not realizable — seki detection needs board-wide group and liberty analysis outside the greedy ranking's scope. | **Native.** GnuGo can detect a seki-shaped local position; the flaw scores those points artificially high in its own move ranking. | Optional refinement, as with The Believer. |
| The Debtor | Not realizable — judging ko-threat size needs a score estimate scripted heuristics don't compute. | Partial — GnuGo can be forced to always answer threats, but its own non-ko play won't read as single-digit-kyu-legible without more style control. | **Native, architecture gap unresolved (see Roadmap obligations).** Policy constraints pin the ko-response rule exactly, while KataGo's rank-conditioned HumanSL profiles keep everything else reading as an actual single-digit-kyu player's game [@katagohumansl2024] — but this requires live, turn-by-turn move generation under a clock, a serving mode the platform's only specified KataGo architecture does not provide. |

### Worked example: The Neighbor as a scripted heuristic

This is the shape a scripted-tier character takes when its flaw is "restrict the candidate set," the same additive pattern `greedyCaptureBot` already uses — never a replacement of competence, only a restriction layered in front of it:

```js
// Sketch, following bots.mjs's own contract: pure functions of {session}.

function nearStoneCandidates({ session }, radius = 2) {
  const stonePts = session.stones().map((s) => s.pt);
  return session.legalMoves().filter((move) =>
    stonePts.some((pt) => chebyshevDistance(move, pt) <= radius)
  );
}

export function neighborBot({ session }) {
  const near = nearStoneCandidates({ session });
  const candidates = near.length > 0 ? near : session.legalMoves();
  // Re-run greedyCaptureBot's own rank() over the filtered set, so The
  // Neighbor is never tactically worse than The Miser — only worse at
  // opening. The flaw restricts the menu; it never lowers the cooking.
  return rankAndPick({ session, candidates });
}
```

A conforming test suite mirrors [`bots.test.mjs`](../../../../../apps/weiqi-learn/test/bots.test.mjs)'s existing pattern: one deterministic setup position where a far point is strictly better than every near point (asserting `neighborBot` still picks a near one), plus the same seeded-LCG legality fuzz already run against `randomBot` and `greedyCaptureBot`.

## Character-voice rules

Masks and post-mortems are different registers, and the boundary between them is where "no pretending sentience" actually gets enforced — not by refusing all personification, but by keeping it out of the analytical instrument.

1. **Two registers, never mixed.** Mask language (playful, literary, present in matchmaking and opponent-select copy) is allowed cognitive-sounding phrasing as an authored, up-front character sketch. Post-mortem language (the Pillar 2 instrument) reports only observed events, move numbers, and glossary terms — never mask language, never a claim about what the opponent wanted, felt, or believed.
2. **Voice lines are pre-authored, never generated.** Each opponent has a small, fixed set of lines tied to specific fired behavioral rules (for example, The Debtor has one line, shown only when it answered at least one ko threat that game). No per-game freeform text generation for character voice — a generated line could claim an emotion or intent the opponent never had; a fixed line cannot.
3. **Grammar: behavior, not reaction.** Voice lines are present-tense and third-person, and describe a standing rule ("The Debtor answers every threat"), never a past-tense reflective state ("The Debtor felt it had to answer"). No verbs of cognition — know, feel, want, decide, believe, think, realize — appear in voice-line copy, full stop.
4. **Placement is physically separate from the mechanical report.** A voice line sits beside the post-mortem as its own bounded UI element (a caption, not a paragraph inside the analysis), so nothing implies the mechanical explanation *came from* a persona.
5. **Same trigger, same line, every time.** A behavioral rule firing always produces the same fixed text, game after game — the repetition is what makes the character legible enough to predict, per Pillar 3's own decision test ("could the target player describe it after three games?"). Variability here would undermine both the honesty of register 1 and the predictability the whole doctrine depends on.
6. **Wins and losses get the same line.** The voice line describes the pattern that fired, not who won because of it — no gloating on a player loss, no consolation on a player win. This is Pillar 4's calm-by-construction oath applied at the sentence level.

## Roadmap obligations

- **Phase 2 (Play)** must ship the shaped-GnuGo integration this document commits to: a candidate-filter/policy-override layer over GnuGo's own move generation, realizing The Loner, The Believer, and The Contester natively, and composing with The Straggler's session-level pass policy. Matchmaking must present these eight named opponents (with mask copy, per the Pillar 3/4 resolution above) rather than a numeric difficulty control.
- **Phase 3 (Understand)** must integrate a KataGo HumanSL rank-conditioned profile with policy constraints sufficient to realize The Debtor natively — see the architecture gap named below, which this integration does not by itself resolve. It also inherits the obligation to render each opponent's post-mortem through [Legibility Layer](./legibility-layer.md#2-claim-types)'s assertion schema, keyed to this document's termRefs — but an earlier draft of this bullet overclaimed that obligation as already covered by that document's existing `ClaimType` enum, and it is not, for three of the eight opponents specifically:
  - **The Contester's post-mortem** (names the seki's location, counts moves spent on it) needs a claim type for a seki standoff, which did not exist in Legibility Layer's enum. This document's Phase 3 obligation now includes specifying that gap precisely enough for that document to close it — see Legibility Layer's own `seki-standoff` claim type, added to close this.
  - **The Debtor's post-mortem** (a plain-language ko-threat size judgment) needs a claim type for threat-size comparison, which also did not exist. See Legibility Layer's `ko-threat-size` claim type, added to close this — gated the same way The Debtor's own KataGo dependency is gated, since judging threat size needs the same score estimate.
  - **The Loner's post-mortem** (names the cutting point and the two groups it separated) needs `cut-exists`, which [Legibility Layer](./legibility-layer.md#2-claim-types) explicitly refuses to ship until `cut.md` exists in the glossary *and* the kernel implements a real cut detector — neither of which any document currently commits to a phase. This is a genuine, unscheduled gap this document does not resolve by asserting coverage: until both prerequisites land, The Loner's post-mortem ships using the nearest already-available claim type (`group-weak`, naming the isolated group's liberty count directly) as an honest approximation, not a cut-specific claim, and is upgraded once `cut-exists` ships.
- **Content authoring**, tracked against the education backlog: the fixed voice-line tables (rule 2 above) for all eight opponents need writing before any cast member ships past The Wanderer and The Miser, whose only voice is silence — appropriate, since a wanderer has nothing consistent to say yet. Every flavor line written for this backlog must be checked against the Pillar 1/Pillar 3–4 boundary named above ("Where Pillar 3 meets Pillar 4") before it ships, not assumed compliant because it reads casually.
- **Testing**, tracked against the kernel/bot test suite: every new opponent needs a `bots.test.mjs`-shaped pair of tests — one deterministic setup proving the flaw fires, one seeded-LCG fuzz proving every move it returns is legal — before it is added to matchmaking.
- **Architecture gap, named and not resolved here: The Debtor needs a second KataGo serving path.** The [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md#engines-and-ai)'s only specified KataGo architecture is "KataGo on owned hardware behind Caddy as a job queue (Workers enqueue, the box analyzes, results land in R2/D1)" — a batch, asynchronous pattern built for deep review, not turn-by-turn move generation against a human opponent inside a time control. Realizing The Debtor as a live opponent needs a second, persistent, low-latency serving mode on the same single box that Phase 3's own detection, review, and mistake-mining work ([Legibility Layer](./legibility-layer.md), [own-games-textbook.md](./own-games-textbook.md)) already competes for — a real capacity and architecture question, not a configuration detail. This document does not resolve it; it is named here as an open dependency the platform plan or a future kernel/infra design document must schedule before Phase 3 can actually ship The Debtor at the "Native" tier the table above claims.

## Open questions for the board

- **Pillar 3's own illustrative language names an archetype this roster doesn't deliver.** Design-pillars.md's Pillar 3 text describes "the one who clings to dead stones" falling to "the player who has just learned when a group cannot live" as a worked example of the doctrine. This cast's closest analog is The Believer, whose flaw is misjudging a false eye as real mid-game — a group whose status is genuinely contested, not a group that is already, provably dead and whose owner simply won't accept a settlement. No member of this roster embodies "refuses to accept a group is dead" specifically. Since this roster is the more carefully specified of the two documents, the board's cheaper fix is almost certainly to tighten the pillar's illustrative language to match the shipped roster rather than add a ninth opponent to match loose prose — but that edit belongs to design-pillars.md, not to this document, so it is recorded here rather than made unilaterally.
- **Pillar 4's forbids list and Pillar 5's forbids list, between them, do not name completion or collection tracking over an enumerable content set** — this document adds an explicit refusal condition against a "cast completion" badge above ("What a fixed, named-and-defeated roster refuses to become") precisely because neither pillar's own forbids list does, leaving canon-and-broadcast.md's seven-plus documentaries as the corpus's other enumerable, completable set with the same open question. Naming the guardrail once, at the pillar level, would be cheaper than three subordinate documents each independently reinventing it — or, as very nearly happened here, failing to.
