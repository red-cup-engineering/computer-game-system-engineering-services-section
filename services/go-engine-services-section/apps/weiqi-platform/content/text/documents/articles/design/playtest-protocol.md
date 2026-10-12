---
title: Playtest Protocol
description: "Audience: whoever runs a playtest session, reads its results, or decides whether a release ships. The empirical arm for all five design pillars — what we measure, how we measure it honestly at solo-dev scale, and the ritual that ties evidence back to a falsifiable claim."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
references:
  nielsen2000five:
    authors:
      - Jakob Nielsen
    title: "Why You Only Need to Test with 5 Users"
  nielsenlandauer1993:
    authors:
      - Jakob Nielsen
      - Thomas K. Landauer
    title: "A Mathematical Model of the Finding of Usability Problems"
cites:
  - nielsen2000five
  - nielsenlandauer1993
---

Audience: whoever runs a playtest session, reads its results, or decides whether a release ships.

This document is the empirical arm of [Design Pillars](design-pillars.md). Every pillar makes a testable claim about player experience; this protocol says what we measure to find out whether the claim is true, how a single operator collects that evidence honestly, and what happens to the evidence once collected. A pillar without a falsification path is a slogan. This document exists so none of them stay slogans.

House posture, stated once so it doesn't need restating per metric: we are a local-first, solo-dev operation (see the [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md)). No growth team, no analytics budget, no server-side event pipeline by default. Every method below is chosen to work under that constraint, not despite it — a metric this document asks for that only a funded team could collect is a bug in the document, not an aspiration to grow into.

## Metrics

| Metric | Pillar | Target | Collection |
|---|---|---|---|
| Ten-second rule compliance | 1 | ≥95% of first-time sessions | Client-side timestamp, on-device only |
| TTFC (time-to-first-capture) | 1, 2 | Median ≤90s on 7×7 capture-go | Client-side timestamp, on-device only |
| Tutorial-stage completion / bounce | 1 | See beat table below | Client-side funnel counters, on-device |
| D7 warm return | 4 | ≥25% of new installs (directional, not a KPI target — see note) | Local install-ID timestamp pair, opt-in sync |
| Mechanism-specific return metrics (5 rows) | 4 | Directional trend per row; each gated to its own feature's ship phase | On-device entry-point tagging, opt-in sync — see below |
| Rank-anxiety pulse | 4 | Trend toward "not at all/a little" over releases, split by loss-streak threshold-crossing | 3-question survey, opt-in, rare |
| Next-game articulation | 2 | ≥60% non-empty; ≥80% of those glossary-grounded; recurrence check secondary | One-field prompt, on-device, optional; recurrence from mistake-mining log |

Each metric is expanded below with the reasoning a table cell can't hold.

### Ten-second rule compliance

**Definition.** The elapsed time from the onboarding screen's first paint to the player's first stone placement, measured only for sessions where no account, modal, or video preceded that placement (if any of those appeared, the session is a compliance failure regardless of timing — Pillar 1 forbids the precondition, not just the delay).

**Target.** ≥95% of first-time sessions place a stone within ten seconds. We expect this near ceiling by construction (Phase 1 ships with no account gate at all); the metric exists to catch regression, not to prove the target. A release that drops below 95% has smuggled in a gate somewhere and should be treated as a Pillar 1 violation, not a UX nit.

**Collection.** A single `performance.now()` delta captured client-side between first paint and the `placement` semantic event, written to an on-device log. No network round-trip is needed to collect this metric, which is the point — it is measurable in Phase 1 before any server exists.

### TTFC — time-to-first-capture

**Definition.** Elapsed time from the same first-paint mark to the player's first successful capture, as scripted in the onboarding screenplay (`onboarding-screenplay.md`, this directory) for the 7×7 capture-go opening beat. TTFC is a *further* beat than the ten-second rule: placing a stone proves the board is legible; capturing one proves the core mechanic — liberties running out — has been enacted, not just watched. Pillar 1's ten-second rule and TTFC are deliberately two separate numbers because they falsify two separate claims.

**Target.** Median TTFC ≤90 seconds on the 7×7 capture-go board. This is a starting target, not a physical constant — it should be recalibrated against the first cohort of true-beginner sessions (see Method, below) rather than defended past the evidence.

**Collection.** Same on-device event log, keyed off the kernel's `capture` semantic event (weiqi-platform-plan.md, "Glossary-linked play, concretely"). No PII, no server.

### Tutorial-stage completion / bounce beats

The Phase 1 onboarding ladder has four macro-stages (capture-go 7×7/9×9 → full rules 9×9 → 13×13 → 19×19); within capture-go itself the screenplay further breaks the first session into beats. This protocol tracks completion and bounce at each boundary, because a single "tutorial completion rate" number hides *where* the desert begins.

| Beat boundary | Completion = | Bounce = |
|---|---|---|
| Arrival → first placement | player places a stone | exits before placing |
| First placement → first atari understood | player's group survives or is captured *and* the player takes a next action | exits at or immediately after their first atari, no further action |
| First atari → first capture (TTFC) | capture event fires | exits with a live game still on board, no capture |
| First capture → session end | player starts a second game or advances a ladder stage | closes the tab after one game |

**Target.** No fixed target per beat yet — Phase 1 has no baseline. The decidable rule is procedural: every release records these four numbers, and a beat whose bounce rate *increases* release-over-release is a regression that blocks ship until explained, per Pillar 1's forbid on quizzing-before-acting (a common cause is an explanatory modal creeping back into a beat).

**Collection.** Funnel counters over the same on-device semantic event log; no additional instrumentation beyond what TTFC already requires.

### D7 warm return

**Definition.** The fraction of new installs that open the app again on any day 1–7 after first use, *without* any notification, email, or push prompting them to — because we send none (Pillar 4: "no engagement-bait notifications"). This is not a retention-funnel metric in the growth-team sense; it exists to answer one question honestly: does the app earn a second visit on its own, or does it need to be chased? If D7 requires chasing to look healthy, the honest fix is a better product, not a notification — that door is closed by Pillar 4, permanently, not provisionally.

**Target.** Reported as a trend, not a gate. A single-operator install base is too small and too self-selected (friends, forums, one Discord) for a percentage to mean what it would mean at scale — see N guidance below. Treat ≥25% as a rough sanity floor below which something is likely wrong, not as a number to optimize toward.

**Collection.** An anonymous, locally-generated install ID (a UUID in `localStorage`/IndexedDB, never derived from anything identifying) with a first-open and most-recent-open timestamp. The pair is computed *on-device*; it never leaves the device unless the player has explicitly opted in to share aggregate playtest data (see Instrumentation ethics). Phase 1 can compute this locally with zero server involvement; only the *aggregation across users* needs Phase 2's opt-in sync path, which is a roadmap obligation below, not a Phase 1 requirement.

### Mechanism-specific return metrics

D7 is one undifferentiated number: it can say the app earns a second visit, but it cannot say *which* honest motivator earned it. [Calm Technology](./calm-technology.md#part-3--the-honest-retention-theory) names five specific, falsifiable predictions about what pulls a player back — the mastery map, the cast, the player's own game history, a lineage edge, a canon entry — and this section is the addendum that document's own roadmap promised: the five predictions, wired to actual collection, each gated to the release in which its underlying surface ships rather than left open-ended.

**Definition, shared across all five.** Every session is tagged, on-device, with its *entry point* — the surface the player was on immediately before initiating the session or the action that closed it (`concept-graph-view`, `cast-rematch:<opponentId>`, `own-game-review`, `lineage-edge-confirmed`, `canon-entry`, or `none` for everything else) — plus whether the *next* session, if any, started within the prediction's own window (7 days, 48 hours, or same-day/next-day, per row). This is the same on-device timestamp-pair mechanism D7 already uses, extended with one tag field; it adds no new data collection surface.

| Prediction | Entry-point tag | Window | Gated to |
|---|---|---|---|
| Mastery-map view → return | `concept-graph-view` | 7 days | Phase 3, once the concept graph ships as a player-facing page ([Mastery Model](./mastery-model.md#ui-stance)) |
| Cast-rematch → return | `cast-rematch:<opponentId>` vs. a same-difficulty anonymous `play-again` control | Same-day-or-next-day | Phase 2, once named cast opponents ship in matchmaking ([Opponent Cast](./opponent-cast.md#roadmap-obligations)) |
| Own-game review → analysis board | `own-game-review` | 48 hours | Phase 2/3, once own-game review and the analysis sandbox both exist |
| Teaching edge → tenure | `lineage-edge-confirmed` (account-level flag, not a session tag) | Weeks-with-a-session, trailing | Phase 4, once `confirmed` lineage edges exist ([Lineage and Clubs](./lineage-and-clubs.md#1-lineage-as-a-graph)) |
| Canon entry → lapsed return | `canon-entry` | N/A — measured as: does this entry point disproportionately belong to accounts with a ≥7-day gap | Phase 1 partial (documentaries), Phase 3 full (once broadcast mode's canon second-consumer role is live) |

**Target.** Directional trend only, same posture as D7 and for the same reason: a solo-dev install base is too small for any one of these five to be a release-blocking number. A row with fewer than roughly 30 tagged sessions in a window is directional color, not a decision input — the same N-guidance rule below applies per-row, and applies harder here since five rows split an already-small population five ways.

**Collection.** Same on-device, opt-in-sync path as D7 (see Instrumentation ethics); no row is computed unless the player has opted in to aggregate sharing, and nothing here changes what's sent — still aggregate counts, never raw per-event logs.

**Honest limits.** These are correlational cohort comparisons, not randomized experiments — see [Calm Technology's Part 3](./calm-technology.md#part-3--the-honest-retention-theory) for the specific confound named per prediction. A null result on any row means that surface isn't doing the retention work Pillar 4 counts on it for, per that document's own instruction, and a release may not cite the corresponding Part 3 paragraph as validated until its row has at least one release-over-release comparison logged.

### Rank-anxiety pulse

**Definition.** A 3-question in-app survey measuring whether the player's rank/rating is producing anxiety Pillar 4 says the platform must not manufacture. It is shown rarely (see rarity rule) and only with explicit, revocable consent to be asked at all.

**Exact wording.**

> **We'd like to ask you three quick questions about your rank. This is optional and you can skip any question — nothing about your account changes either way.** [Ask me] [No thanks]
>
> 1. Thinking about your rank or rating right now, how much does it worry you?
>    `Not at all` · `A little` · `Somewhat` · `Quite a bit` · `A great deal`
> 2. In your last few games, has thinking about your rank made you play differently than you wanted to — for example, avoiding a move you thought was good, or quitting a game early?
>    `Yes` · `No` · `Not sure`
> 3. In one sentence, if anything: what would make your rank feel less stressful? *(optional, free text)*

**Rarity and consent rule.** Shown at most once per 30 days per install, never before the player has completed 5 rated games (ranks are hidden entirely for learners under Pillar 4, so the survey has nothing to ask about earlier), and only after the standalone consent banner above is accepted. Declining is itself a valid, logged local datum ("declined") — it is not a dismissed dialog to be retried later in the same window.

**Target.** No numeric target for question 1–2 in isolation; the decidable signal is the *release-over-release trend* on question 1 skewing toward "Not at all"/"A little." A release that pushes the distribution the other way is a Pillar 4 violation regardless of what it did for engagement metrics — per Pillar 4's own decision test, we would not ship it even if we couldn't measure the engagement gain at all.

**Event-linked split (loss-streak protection).** The population-wide trend above is an ambient number: it can drift for reasons that have nothing to do with [Calm Technology](./calm-technology.md#loss-streak-protection)'s 3-loss/5-loss matchmaking intervention — a changed player mix, an unrelated UX change, a seasonal cohort. To give that specific mechanism its own falsification path rather than borrowing the whole population's, every pulse response is tagged, on-device, with one additional boolean: did the respondent cross the 3-loss or 5-loss threshold in the 7 days before being shown the pulse. A release's evidence for loss-streak protection is the *difference* between threshold-crossers' question-1 distribution and non-crossers' in the same release window, not the blended trend line. This is still not a randomized comparison — a player who strings together three losses is not a random draw from the population, and that self-selection is a real, named limit on what the split can prove — but it is a real improvement over an untagged trend that has no way to point at this mechanism specifically. Below roughly 30 tagged responses in either half of the split in a release window, treat the comparison as directional color only, per the N guidance below — five-way and now two-way splits of an already-small solo-dev install base shrink fast.

**Collection.** Responses aggregate on-device by default; only ship in aggregate (never per-response, never with the install ID attached) if the player has separately opted in to share playtest data. See Instrumentation ethics.

### Next-game articulation test (Pillar 2)

**Definition.** Immediately after a cause-chain post-mortem (Pillar 2's canonical instrument), an optional one-field prompt:

> **One thing I'll try differently next game:** `________________________` [Done] [Skip]

Success is not "the player wrote something" — it's whether what they wrote is an *actionable, glossary-grounded* statement rather than a mood ("that was rough") or a generality ("play better"). This directly instruments Pillar 2's decision test: "Can the learner state, in glossary vocabulary, one thing this feedback tells them to do differently next game?"

**Target.** ≥60% of post-mortems shown result in a non-empty field (the floor signal: is the post-mortem itself landing, or being bounced off). Of the non-empty responses, ≥80% judged glossary-grounded on qualitative review — automatable as a first pass (does the text contain or paraphrase a glossary term the post-mortem itself surfaced?), but the automated pass is a triage filter, not the verdict; a solo operator should actually read the free text periodically, because a field can contain a glossary word and still be gibberish, or omit the word and still be exactly right.

**Honest limit: this measures articulation, not behavior.** Writing "extend the group next time" into an optional field is a self-reported intention, and the intention-behavior gap is a well-documented measurement trap — nothing above checks whether the player's *next* game actually differs. Pillar 2's decision test asks whether the learner *can act* differently, not merely *say* they will, and this metric alone can't answer the harder question.

**Recurrence check (the harder claim, secondary).** [Your Games Become Your Textbook](./own-games-textbook.md#stage-1--candidate-detection) already runs a `MistakeCandidate` detector, client-side, over every local or bot game — the same infrastructure the articulation prompt sits downstream of. This document adds one more on-device computation over that same log, no new instrumentation surface: for a player who wrote a non-empty, glossary-grounded response naming mistake kind *K* (self-atari, ignored-atari-given, ko-violation-attempted, avoidable-group-death), check whether *K* recurs as a new `MistakeCandidate` in that player's next 3 games of the same mode. **Recurrence rate** = the fraction of articulated post-mortems where it does not recur. This is still not proof the articulation *caused* the improvement — a player who was already about to stop making that mistake would score the same way — but unlike the write-in field alone, it is evidence about the player's subsequent games rather than their subsequent typing, which is the actual gap Pillar 2's decision test is pointing at. Report it as a directional trend alongside the articulation-rate numbers above, same N-guidance caveats as everywhere else in this document.

**Collection.** On-device only; the field is never required to dismiss the post-mortem screen (an optional field that blocks progress isn't optional — Pillar 4's calm oath applies to instrumentation, not just to game mechanics). The recurrence check reads the mistake-mining log that already exists locally for [own-games-textbook.md](./own-games-textbook.md)'s own scheduler; it adds no new collection, only a second pass over data already on-device.

## Method: moderated think-aloud with true beginners

Every metric above except D7 can, in principle, be inferred from aggregate logs. But logs tell you *that* someone bounced at a beat, not *why* — and a solo operator building an onboarding ladder for people who have literally never seen a Go board cannot afford to guess. The primary instrument for Phase 1 validation is therefore a small number of moderated, in-person or video-call, think-aloud sessions with **true beginners**: people who have never played Go, Baduk, or Weiqi under any name, in any form, ever.

### Recruiting script

Screening question, asked before scheduling anything:

> "Have you ever played Go — also called Weiqi or Baduk, the board game with black and white stones on a grid? I'm looking specifically for people who *haven't*, even if you've heard of it or seen it played."

Anyone who answers "I tried it once" or "I know the rules but never played" is disqualified for this instrument — they are not a true beginner, and their prior exposure will silently correct for gaps the tutorial should be catching on its own. Recruit through channels that don't require a marketing budget: friends and their households, a local library or coffee-shop bulletin, one general-purpose Discord or forum post. Five to eight true beginners is enough for a full round (see N guidance).

Ask-to-participate line:

> "I'm building a Go teaching app and I want to watch someone who's never played it try it cold, for about 15–20 minutes, on a video call or in person. You don't need to know anything or prepare anything — the whole point is that you don't. I'll ask you to think out loud while you try it. Nothing you say can be 'wrong.'"

### Session script

1. **Consent and framing (2 min).** "I'm testing the app, not you — if something is confusing, that's the app's fault and exactly what I need to see. Please think out loud: say what you're looking at, what you expect to happen, what confuses you, even if it seems obvious."
2. **Cold open (up to 10 min, unguided).** Hand over the device or share the link. Say only: "Go ahead and do whatever feels natural. I'll stay quiet unless you ask me something directly." Do not narrate the screen. Let silence sit.
3. **First-session task, if not reached organically by minute 6:** "Try to get to the point where you've captured a stone." (This line exists only as a backstop — if the tutorial is doing its job, no one needs to hear it.)
4. **Debrief (5 min).** "What was the moment you felt most confident? Least confident? Was there a word on screen you didn't recognize, and did you find out what it meant before you needed to?"
5. **Log immediately after, not during:** TTFC, ten-second-rule compliance, each beat boundary reached/bounced, and a verbatim note of the first moment the participant asked "what do I do" (a Pillar 1 failure signal by definition — the app should have made that unnecessary).

### What the moderator may not say

This list is not etiquette; each line is a specific way to contaminate the exact thing being measured.

- **May not say any glossary term** (atari, liberty, capture, ko, territory, eye, connection…) **before the participant has said it or the app has surfaced it.** Saying it first is the moderator doing Pillar 1's job instead of the app.
- **May not answer "what should I do?"** Redirect only: "What are you thinking? What would you try?" Answering directly erases the exact friction the session exists to find.
- **May not confirm correctness mid-task** ("good," "yes, that's it," "nice move"). Praise or correction changes subsequent behavior and contaminates the rest of the session.
- **May not explain a UI element** ("that's the pass button"). If a participant can't find or understand a control unaided, that is the finding, not an obstacle to it.
- **May not apologize for or excuse the app** ("sorry, that part's a bit rough"). It primes the participant to be generous in the debrief instead of honest during the task.

## N guidance for a solo operator

Jakob Nielsen's discount-usability doctrine holds that a small number of participants finds most of a design's usability problems: the underlying model estimates that the *n*-th user reveals a cumulative fraction of problems of `1 − (1 − p)ⁿ`, where *p* is the average per-user problem-detection rate (empirically often around 0.31); at that rate, five users surface roughly 85% of usability problems, and each additional user mostly re-finds what earlier users already surfaced [@nielsenlandauer1993] [@nielsen2000five]. This is the doctrine to lean on for a solo operator, because it was derived for exactly this situation — no team, no budget for forty-person studies, and a design that changes fast enough that a study finished six weeks from now answers a question the current build no longer asks.

Two different uses of N follow from this, and they should not be conflated:

- **Qualitative, think-aloud rounds (the method above): N = 5 true beginners per round.** Run a round, fix what it surfaces, run another round on the next milestone rather than one large study. This is the direct application of the doctrine and is where it's strong.
- **Quantitative metrics (TTFC medians, D7 percentages, bounce rates): N = 5 is not enough, and this document does not pretend otherwise.** These are population statistics, not usability-problem discovery, and the discount-usability math does not transfer to them. The honest solo-dev posture is: report these as *descriptive trends across the cumulative install base*, release over release, not as single-release significance tests. Below roughly 30 sessions in a release window, treat any quantitative metric here as directional color for the review ritual below, not as a number a decision should hinge on alone.

## Instrumentation ethics

This section is binding, not aspirational, and it has a real refusal condition at the end.

- **Local-first by default.** Every metric above is computed by aggregating events *on the player's own device*. The default state of every install is: nothing about this player's play has left their device.
- **Explicit, informed, opt-in sharing only.** If a player chooses to help the project by sharing playtest data, the opt-in screen states plainly what is sent (which aggregate counts, never raw per-event logs, never free-text survey answers with any identifier attached), and the choice is revocable — turning it off stops future sharing and does not require deleting the app.
- **No third-party analytics, ever.** Not Google Analytics, not Mixpanel, not Amplitude, not a "privacy-friendly" alternative, not an error-reporting SDK that phones a vendor with device fingerprints attached, not an ad-network SDK for any reason. This is a refusal condition: if a future contributor or agent proposes adding a third-party analytics dependency to any part of this platform, this document is sufficient standing to refuse the change outright — no exception process, no board vote required, because Pillar 4 already answered the underlying question ("would we still build this if we could not measure engagement?") and third-party analytics exists specifically to answer engagement questions we've already declined to optimize for.
- **Operational logging is not exempt from scrutiny.** Phase 2's Durable Objects will necessarily log *something* to keep a live game connection alive (connection state, reconnection timestamps). That logging must stay scoped to what the game room needs to function, must not be joined against play-history to build a behavioral profile, and must not outlive its operational purpose. If it starts answering playtest questions this document already answers a more honest way, that's scope creep, not a bonus.

## The review ritual

Each release names exactly one pillar-derived hypothesis, stated so that it can be wrong, and the specific playtest evidence that would prove it wrong. This is the mechanism that keeps the pillars from being read as vibes: a release note that can't be falsified by anything in this document hasn't actually made a claim.

**Template.**

> **Release vX.Y hypothesis (Pillar N):** [one sentence, phrased as a claim the release makes about player experience]
> **Falsifying evidence:** [the specific metric, threshold, or think-aloud observation that, if seen, means the hypothesis was wrong]

**Worked example, Pillar 1.**

> **Release v0.3 hypothesis (Pillar 1):** The capture-go onboarding lets a true beginner place a first stone within ten seconds, with no explanatory text read first.
> **Falsifying evidence:** In a round of N=5 true-beginner think-aloud sessions, any participant either asks "what do I do?" before placing a stone, takes longer than ten seconds from first paint to placement, or the moderator is forced to break the no-hint rule to get them started.

**Worked example, Pillar 2.**

> **Release v0.7 hypothesis (Pillar 2):** The cause-chain post-mortem lets a learner act differently in their very next relevant game, not just say they will.
> **Falsifying evidence:** The next-game articulation field is left empty by more than 40% of learners who view a post-mortem in the release window, or qualitative review of the non-empty responses finds most are mood statements rather than actionable claims, **or** the recurrence check finds that the articulated mistake kind recurs in a player's next 3 games of the same mode at a rate no better than the population's overall recurrence rate for that mistake kind — evidence that stating the lesson isn't moving the play.

This worked example is written to Pillar 2's actual promise ("act differently," not "can state") on purpose, after an earlier draft of this document phrased it to match only the easy half of what the next-game articulation metric collects. The recurrence check above exists specifically so this hypothesis has a falsifying condition that isn't just the write-in field failing to get typed into.

A release that ships without a stated hypothesis has skipped this ritual, not satisfied it trivially — "no hypothesis" is not a valid entry in the template.

## Roadmap obligations

This document commits later phases to specific work; recording that here so it doesn't get renegotiated per feature later.

- **Phase 1 (Learn)** must ship the on-device event log that ten-second-rule compliance, TTFC, and the tutorial-stage beats all depend on — this is a Phase 1 requirement, not deferred, because all three are measurable with zero server and the whole point of Phase 1 is that it needs none.
- **Phase 2 (Play)** must implement the opt-in aggregate-sync path referenced under D7 warm return and Instrumentation ethics before D7 can be reported across more than one device's local storage; Phase 2's Durable Object connection logging must be scoped per the operational-logging clause above from its first design sketch, not retrofitted.
- **Phase 3 (Understand)** must wire the next-game articulation prompt (and its recurrence check, reading the mistake-mining log [own-games-textbook.md](./own-games-textbook.md) already ships in Phase 1) into the cause-chain post-mortem screen as that instrument ships, and must implement the rank-anxiety pulse's consent banner, 30-day rarity gate, and threshold-crosser tagging as ratings go live — the pulse has nothing to ask about before ranks exist, so it cannot be built early, but it must not lag ranked play's launch by more than one release. It also owns the mastery-map-view→return and canon-entry→lapsed-return rows of Mechanism-specific return metrics, per their gates in that section.
- **Phase 2 (Play)** additionally owns the cast-rematch→return row of Mechanism-specific return metrics, gated to named cast opponents shipping in matchmaking, and the own-game-review→analysis-board row once both surfaces exist.
- **Phase 4 (Belong)** owns the teaching-edge→tenure row of Mechanism-specific return metrics, gated to `confirmed` lineage edges existing. This resolves what an earlier draft of this document left as an unaddressed gap ("does the teacher gain standing, not points" with no metric defined) — the metric is now defined in Mechanism-specific return metrics, above; Phase 4 owes only the build, not the design.
