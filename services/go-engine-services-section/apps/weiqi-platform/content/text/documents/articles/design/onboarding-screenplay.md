---
title: Onboarding Screenplay
description: "Audience: whoever builds or reviews the first five minutes of the Learn face — the tutorial-ladder UI, the identity/storage layer, and anyone measuring whether onboarding is working. The first five minutes, beat by beat, with exact copy, failure branches, and the two commitments (the ten-second rule, time-to-first-capture) that make onboarding decidable rather than a vibe."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
---


Serves [Pillar 1 — Do first, name after](./design-pillars.md) and [Pillar 4 — Calm by construction](./design-pillars.md). Scope is the first five minutes only: page load through first capture through first session end, for a visitor who has never opened this app before. Everything here is a beat in that window, described the way a screenplay describes a scene — what's on screen, what the actor (the player) can do, what the other character (the app) says, and what happens if the scene stalls.

Grounding: the beats below are the shipped five-stage capture-go ladder — `DEFAULT_STAGES` in [`apps/weiqi-learn/public/js/lib/tutorial-flow.mjs`](../../../../../apps/weiqi-learn/public/js/lib/tutorial-flow.mjs) — not an invented alternative. Its capture-first ordering (place stones → watch one run out of liberties → capture → a whole game built from nothing but that) is the same ordering [Weiqi Overview](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/teaching-articles/tutorials/weiqi-overview.md) teaches in prose ("Once Black's stone has no remaining liberties, White removes it from the board. That is a capture.") and the same ordering the [Weiqi Platform Plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md)'s onboarding ladder specifies (capture-go before full rules before 13×13 before 19×19). Two beats — the identity ramp's name offer and the session-end screen — are not yet built; they're marked **(proposed)** and are what Phase 1 owes the ladder to make it a complete onboarding, not just a complete tutorial.

One deliberate absence: Pillar 5's ritual (nigiri, the bow) is not in this document. Ceremony that slows the first ten seconds down is a Pillar 1/Pillar 4 violation before it is anything else — earlier-numbered pillar wins, per the constitution's own tie-break rule. Ritual belongs to the beat where a game against another person begins, which is out of scope here.

## The two commitments

### The ten-second rule

**Claim tested:** a first-time visitor acts on the board within ten seconds of arrival, with no account, no modal, no video, gating that action.

**"Acts" is defined precisely, because "arrives" and "acts" are each a real event, not a feeling:**

| Term | Event |
|---|---|
| t0 (arrival) | the tutorial player's first `render()` completes for stage index 0 — the board is painted, mounted, and its hit-target layer is live |
| t1 (act) | `attemptMove()` returns `outcome.ok === true` for the player's first placement — i.e. the stone is actually on the board, not just previewed |

The ten seconds must cover the board component's own tap-then-confirm sequence (first tap sets a pending ghost stone and announces "`{pt}`, pending"; a second tap on the same point fires the placement — see [`board.mjs`](../../../../../apps/weiqi-learn/public/js/ui/board.mjs)), not just a single click. That two-step interaction is the risk this rule actually watches: a newcomer who taps once, is unsure what the ghost means, and hesitates past ten seconds has failed the rule even though nothing blocked them.

**Decision test:** t1 − t0 ≤ 10s, measured in a cold-cache first load, on the median device class the audience actually uses (not a developer's fibre connection). Anything that inserts a screen between t0 and t1 — a name prompt, a rules modal, a "how to play" video, a loading spinner past ~2s — fails this test regardless of how good the screen is.

### Time-to-first-capture (TTFC)

TTFC is the primary onboarding metric. It is not "time to understand Go" — it is the narrowest, most decidable proxy available: the first moment the app can prove the player did the one thing that makes everything else in weiqi legible (Pillar 1's whole thesis: name the word only after the experience).

**Naming the mechanism, per [Calm Technology](./calm-technology.md#part-1--the-anti-patterns-register)'s own house discipline.** Time-to-first-win is the headline KPI free-to-play onboarding funnels are explicitly built around, for the structurally identical reason given above — a fast first success predicts retention. This document should say so plainly rather than let the metric's lineage go unremarked while insisting on naming mechanisms everywhere else in this corpus. What keeps this instance from being the pattern Pillar 4 refuses is execution, not framing: nothing about hitting or missing 90 seconds triggers a modal, a forced sound, a confetti burst, or any comparison the player sees (Beat 4's "Refuses" line below is explicit about this). The metric is used here to tune the ladder's own pacing against a cohort median, never surfaced to an individual player as a score, streak, or pressure — a F2P funnel uses the identical number to manufacture urgency at the individual level; this document is refusing that use, not the metric.

| Term | Event |
|---|---|
| t0 | same as the ten-second rule's t0 — page-visible / board-mounted |
| t2 (first capture) | the first kernel `capture` semantic event in the session with `detail.by === "black"` and `!detail.selfCapture` — concretely, the moment the Atari stage's `capture-white` win-check resolves (see `tutorial-flow.mjs`) |

**TTFC = t2 − t0. Target: ≤ 90 seconds, median, across first-time sessions.**

**Instrumentation is a roadmap obligation, not something this document can ship today.** Phase 1 is static assets only — no server, no D1 (see the platform plan's Phase 1 scope) — so there is nowhere to aggregate TTFC across real users yet. Until Phase 2's D1 exists, TTFC can only be measured by hand, in moderated usability sessions, timing t0→t2 with a stopwatch against the two events above. **Refuses:** no per-player TTFC tracking tied to identity, ever — the metric is a cohort median for tuning the ladder, not a performance score attached to a person, which would itself be a Pillar 4 violation (surveillance-flavored engagement pressure by another name).

**Decision test for a design review:** if a change to Beats 1–4 (below) moves the measured median TTFC above 90s, that change does not ship as designed — either the change is wrong, or the target is, and the latter requires rewriting this section, not silently missing it.

## The identity ramp

Three rungs, each strictly additive over the one before it. No rung is required to reach the next content beat; every rung is offered, never forced, and never blocks bot play.

| Rung | Storage | What the player has done | Offered when | What it unlocks |
|---|---|---|---|---|
| 0 — Anonymous | `localStorage["weiqi-learn:progress"]`: `{ sessionId (client-generated uuid, never transmitted in Phase 1), ladderIndex, ladderStatus, stagesCompleted[], createdAt, lastSeenAt }` | Nothing yet, or the whole ladder | Automatic, on first `render()` — no prompt, no consent screen | The entire capture-go ladder, tsumego, lessons, glossary — everything Phase 1 has |
| 1 — Chosen name | adds `localStorage["weiqi-learn:displayName"]` | Just took their first capture | Once, right after the Atari stage's onWin text (Beat 5, below) | A name on their own board announcements and (later, Phase 4) on any teaching-lineage record — nothing gated behind it |
| 2 — Account | Phase 2's D1 `users` table | Wants progress to survive a lost device, or wants to play another person | At session end (Beat 9), and again anywhere the app is about to ask for something an anonymous session structurally cannot do (rated play, cross-device sync) | Persistence across devices; eligibility for Phase 2 matchmaking |

**Merge rule (decidable, additive-only):** creating or signing into an account never truncates. `ladderIndex` becomes `max(local, account)`. Every array field (`stagesCompleted`, and later concept-graph evidence) becomes the set union of local and account, not a client overwrite. `localStorage` is never cleared on merge — only stamped `mergedToAccount: true` — so a later sign-out still shows the player their own history rather than a blank slate.

**Worked example.** A player reaches `capture-go-greedy` (ladder index 3) anonymously on a phone, closes the tab, and two days later creates an account on a laptop that has never opened the app (`ladderIndex` 0 there). Post-merge: `ladderIndex = max(3, 0) = 3` on the account; the laptop's tutorial player opens directly on `capture-go-greedy`. The phone's `localStorage` still independently claims `ladderIndex = 3` — nothing on it was rewritten, only superseded going forward. That is what "nothing lost" is required to mean in this document: not a promise, a specific, testable arithmetic rule.

**What we refuse at every rung (Pillar 4):** no email verification gate before play continues; no password-strength theater; no "sign in to save your progress!" banner before the player has anything worth saving (i.e., never at Beat 1); no account requirement for solo or bot play, ever, at any rank — that door stays open permanently, not just through onboarding.

## Format key

Each beat below has the same five fields. **Sees** and **Can do** describe the screen; **App says** is exact shipped copy from `DEFAULT_STAGES` where the beat corresponds to a live stage, and marked **(proposed)** where it is this document's own draft; glossary-linked terms are marked as they would render — a hover-card in the app (`hover-card.mjs`), a plain corpus link here. **Failure branch** is what happens if the player stalls or bounces at exactly this beat — the honest answer, not "they'll come back." **Refuses** is this beat's own Pillar 4 checklist line, not a repeat of the identity ramp's.

## The screenplay

### Beat 1 — Page load · t = 0:00

**Sees:** the tutorial player's Stage 1 render, complete, on first paint: "Stage 1 of 5," title "First Stones," the intro paragraph below, and a live 7×7 board already showing its focus-ring and hit-target layer. No landing page, no hero image, no "Start" button — the root URL *is* the first stage.

**Can do:** tap or click any empty intersection immediately; tab to the board and use arrow keys + Enter (the board is keyboard-navigable from mount, per `board.mjs`'s `role="application"` group).

**App says (revised — supersedes shipped copy, see Roadmap obligations):** "A weiqi board is a grid of lines, and stones go on the points where lines cross, not inside the squares. Place a stone on the board below. Place three stones to continue."

**Corrected against this document's own audit.** The shipped copy that this beat quoted in an earlier draft went on to explain [liberties](../../../../../../../content/text/glossary/terms/liberty.md) as an abstract, position-dependent count — "as many open neighboring points... as it has open lines running from it: four in the open middle, fewer on an edge, fewer still in a corner" — before the player had placed a single stone. That is a direct failure of this beat's own "Refuses" line below (Pillar 1's test: "does this feature introduce any term before the player has enacted the thing it names?"), on a board with zero stones on it, and this document's audit missed it despite checking every other beat against exactly that test. The revised copy above defers the liberties explanation entirely — it says what to do, not what a stone's neighbors mean — and the explanation moves to Beat 3's close, below, where the player has already placed three stones and the concept is live on the board in front of them, which is where Pillar 1 says a name belongs.

**Failure branch:** if the board is not interactive within ~2 seconds of navigation (asset stall, slow device), the ten-second rule's ten-second budget is already half spent before the player has done anything — this is an infrastructure requirement on this beat, not a copy or layout one: Phase 1's static-asset, no-framework, no-build-step delivery (see the weiqi-learn README) is what keeps this achievable, and any future dependency added to the load path must re-clear this budget before it ships.

**Refuses:** no marketing splash, no cookie-consent modal in front of the board, no autoplay video, no forced account screen. Pillar 1's decision test — "can a first-time visitor act on the board within ten seconds, no account, no modal, no video" — is this beat's entire job.

### Beat 2 — First placement · t ≈ 0:00–0:10 (ten-second-rule checkpoint)

**Sees:** a tap produces a ghost stone at that point and an aria-live announcement ("`{pt}`, pending"); a second tap on the same point resolves it to a solid stone.

**Can do:** confirm the pending stone, tap elsewhere to move the ghost instead, or press Escape to clear it.

**App says:** nothing new — the Beat 1 intro persists as the status line's hint until three stones are down.

**Failure branch:** the player taps once, is unsure what the translucent ghost means, and does not tap again before t1 = 10s. This is the rule's single sharpest risk (see "The ten-second rule," above) — the two-step gesture, not the concept of placing a stone, is what a newcomer can stall on. **This is a design-review flag, not a spec gap:** if usability sessions show hesitation here, the fix is a clearer ghost affordance or a one-tap-to-place fallback, not a rewrite of this document's ten-second target.

**Refuses:** no confirmation dialog ("place stone at D4?"); the tap-then-confirm gesture *is* the confirmation, deliberately lighter than a modal.

### Beat 3 — First Stones complete → Atari begins · t ≈ 0:10–0:45

**Sees:** on the third placement, the status line becomes the onWin text; the board holds its final position; a single inline "Continue" button appears — no modal, no animation, the board simply stays as it ended (per `finish()` in `tutorial.mjs`). On click, Stage 2 renders: "Stage 2 of 5," title "Atari," a 7×7 board already set up (six scripted moves replayed, alternating colors, before the player's turn — `setup: ["D3","D4","D5","A1","C4","A2"]`) so White's D4 stone visibly has one liberty left, at E4.

**Can do:** click Continue; then act on the new board immediately.

**App says (Beat-3-close, revised):** "Three stones down. Each one has as many open neighboring points — its [liberties](../../../../../../../content/text/glossary/terms/liberty.md) — as it has open lines running from it: four in the open middle, fewer on an edge, fewer still in a corner. Look at the stones you just placed and count theirs. Next: watching a stone run out of liberties entirely." This is where the geometric detail Beat 1 no longer carries belongs — the player has three real stones on the board to count against, not an abstract rule to hold in their head before touching one.

**App says (Stage 2 intro):** "White's stone at D4 is down to one [liberty](../../../../../../../content/text/glossary/terms/liberty.md) — the empty point at E4. A stone or group with exactly one liberty left is in [atari](../../../../../../../content/text/glossary/terms/atari.md). Play the point that removes its last liberty to [capture](../../../../../../../content/text/glossary/terms/capture.md) it."

**Failure branch:** the player never clicks Continue. Nothing forces them to — the finished board is a legitimate stopping point, not a stall, and Beat 9's session-end handling (below) is exactly what covers it. If they do continue but play an illegal point, the app says: "`{move}` isn't legal here," and the hint reappears: "White's D4 stone has only one open point left, at E4 — play there to capture it."

**Refuses:** no quiz ("what is a liberty?") between the two stages — Pillar 1 forbids tutorials that test before they let the player act, and this transition is pure "next thing to do," not an assessment.

### Beat 4 — First capture · t ≈ 0:10–1:30 (TTFC checkpoint)

**Sees:** on the capturing move, White's stone is marked and removed; the status line becomes the onWin text; the same quiet inline-button pattern as Beat 3.

**Can do:** nothing further in this stage — this is the win.

**App says:** "Captured. That's the whole rhythm of the game in miniature: reduce a group's liberties to zero and it comes off the board. Next: a real game, shrunk down to just that."

**Failure branch:** the scripted setup makes an accidental miss here unusual (the target stone is highlighted by having exactly one open point), but a player who plays elsewhere gets the same "isn't legal" or hint text as Beat 3 and stays on the stage indefinitely — there is no move limit, no timer, no penalty for taking longer than the 90-second TTFC target. TTFC is a design metric for tuning Beats 1–3, never a countdown the player sees or feels.

**Refuses:** no fanfare — no modal "You captured your first stone!", no confetti, no sound cue forced on. The onWin line *is* the celebration, at the same visual register as every other status update, per Pillar 4's "no ceremony" posture for ordinary events (ceremony is reserved, deliberately, for the ritual beats Pillar 5 owns elsewhere — not this one).

### Beat 5 — Name offer · t ≈ 1:20–1:35 **(proposed)**

**Sees:** a single inline field beneath the onWin text, not a modal: "What should we call you here? (You can change this anytime, or skip it.)" with a text input and a "Skip" link at equal visual weight.

**Can do:** type a name and confirm, or skip — skipping is a single tap, not a buried option.

**App says (proposed):** "What should we call you here? Nothing else changes — you keep playing exactly as you are."

**Failure branch:** the player skips, or ignores the field entirely and taps Continue. Rung 0 (anonymous) persists unchanged; the field reappears, unobtrusively, at the next natural pause (Beat 9) rather than being re-pushed mid-stage.

**Refuses:** no "claim your name before someone else does" urgency copy; no required field; no email or password requested at this rung — a name is decoration on an already-earned localStorage record, not a login.

### Beat 6 — Capture Go: First Blood · t ≈ 1:30–2:20

**Sees:** "Stage 3 of 5," 7×7 board, empty, player is Black; White plays randomly after each of the player's moves.

**Can do:** place anywhere legal; watch White's reply; the win condition is one capture, either direction.

**App says (intro, revised — supersedes shipped copy, see Roadmap obligations):** "A real game, simplified to its core: [capture](../../../../../../../content/text/glossary/terms/capture.md) one stone and you win — no territory, no scoring, just liberties and captures. You're Black; White today is **The Wanderer** — it plays at random, with no plan at all. Watch for a stone you can put in [atari](../../../../../../../content/text/glossary/terms/atari.md), and finish it."

**Corrected against this document's own audit.** An earlier draft of this beat's shipped copy wrapped "territory" in the same live glossary hover-card span used everywhere the concept is actually on the board — `TERM("territory", "territory")` — inside the very clause declaring territory absent from this stage. Pillar 1's third decision test asks whether a name is "uttered at the moment the concept is live on the board"; naming a concept at the exact moment it's declared *not* live fails that test on its face, and territory isn't enacted until Stage 5 (Beat 8), three stages later. The revised copy above keeps the word — it's useful contrastive framing, telling the player what this stage isn't — but as plain text, not a hover-card: using the common English word "territory" in a sentence that says it doesn't apply yet is not itself a Pillar 1 violation; wrapping it in the app's own glossary-linking treatment, which says "this is live, learn it now," is.

**Failure branch:** if White's random play captures the player's stone first, the app says: "White got there first this time. Random play lands a capture by accident sometimes — try again and look for the same opening before it does," and a "Try again" button restarts the stage — losing here has zero cost (no rating, no penalty, the stage simply resets).

**Refuses:** no loss screen styled as a failure state (no red, no "you lost" framing) — a restart button at the same visual weight as a continue button, per Pillar 4's "no ceremony around losses."

### Beat 7 — Capture Go: Greedy Opponent · t ≈ 2:20–4:00

**Sees:** "Stage 4 of 5," 9×9 board; White now plays `greedyCaptureBot` — captures when it can, escapes atari when it must, otherwise plays a legal move at random (see [`bots.mjs`](../../../../../apps/weiqi-learn/public/js/lib/bots.mjs)). Target: three captures.

**Can do:** the same placements as Beat 6, now against an opponent whose behavior is legible and, per Pillar 3, predictable after a few exchanges — out of this document's scope to spec fully, but its presence here is the first place "reading one move ahead" becomes necessary rather than optional.

**App says (intro, revised — supersedes shipped copy, see Roadmap obligations):** "Bigger board, sharper opponent, higher target: first to three captures wins. White today is **The Miser** — it never turns down a capture, even a small one, so dangling a stone can work in your favor. It takes a capture when it can, escapes [atari](../../../../../../../content/text/glossary/terms/atari.md) when it must, and only plays quietly when neither applies. Reading one move ahead starts to matter."

**Failure branch:** on a loss, the app says: "White reached three captures first. A greedy opponent punishes a stone left in atari immediately — defend your own groups before you reach for one of White's," with the same no-cost restart as Beat 6.

**Refuses:** no difficulty slider exposed here — the opponent's behavior is fixed and named, not tuned per-player, so what the player learns to predict this beat is stable across retries. **Corrected against this document's own audit:** an earlier draft of this line claimed Pillar 3 compliance ("the opponent's behavior is fixed and named") while the shipped copy for both this beat and Beat 6 only ever said "White" — the player never read "The Wanderer" or "The Miser" anywhere, so [Opponent Cast](./opponent-cast.md)'s promised advance disclosure (a mask's flavor line making the flaw guessable before the loss, per that document's Pillar-3/Pillar-4 resolution) existed in one document and never reached the player in this one. Beat 6 and Beat 7's intro copy above now carry the mask names for exactly that reason — the claim is true once the copy above ships, and was not true before.

### Beat 8 — A Full Game begins · t ≈ 4:00–5:00+

**Sees:** "Stage 5 of 5," 9×9 board, full rules, a visible Pass button (the only stage with one). Most first-time players are still inside this stage at the five-minute mark — this document does not require ladder completion inside five minutes, only that the player is still inside a legible, winnable game, not lost or blocked.

**Can do:** place stones, or pass; two consecutive passes end the game and score it.

**App says (intro):** "The training wheels are off: full rules, 9×9, [area scoring](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/area-scoring.md). Captures still matter, but so does surrounding empty [territory](../../../../../../../content/text/glossary/terms/territory.md). When neither side has a move left worth making, pass — two passes in a row ends the game, and it's scored as it sits."

**Failure branch:** a player unsure when to pass keeps playing past the point of any real gain — there is no timer or move-count nudge; the hint line ("No move gains anything for either side? Passing is legal too — but only once you're sure there's nothing left worth fighting for") is the only guidance offered, repeated, never escalated into a forced pass.

**Refuses:** no auto-pass, no "are you sure?" confirmation on passing, no game clock in this stage — clocks belong to Phase 2's rated play, not to a first game.

### Beat 9 — Session end · t = wherever the player actually stops

Session end is not tied to ladder completion — it is whatever moment the player closes the tab, switches away, or simply stops. Two concrete cases:

| Case | Where they stopped | What happens |
|---|---|---|
| Early bounce | Mid-Beat 2 or 3, before any capture | `localStorage` already holds `ladderIndex` and `stagesCompleted` as of their last completed stage transition — nothing is lost because nothing was ever held only in memory (see the identity ramp's storage column). No name was offered yet; none is missed. |
| Five-minute pause | Mid-Beat 8, full game in progress | The in-progress board position is not currently persisted mid-stage (a real gap — see Roadmap obligations, below); on return the player resumes at the *start* of Stage 5, not their exact position. |

**Sees (proposed), on return:** the ladder opens on the player's saved `ladderIndex`, not Stage 1 — "Welcome back. Stage 5 of 5: A Full Game" — with progress list showing prior stages as done.

**App says (proposed):** "Welcome back. Pick up where you left off, or replay an earlier stage from the list above." No "we missed you," no urgency, no reference to elapsed time.

**Failure branch:** the player never returns. Nothing degrades — no expiring progress, no "your streak is broken" message, because there was never a streak to break. This is the beat where Pillar 4's decision test is most directly load-bearing: "can the player put the app down for a month and return to warmth rather than penalty?" — the honest answer for this beat, today, is yes for anything already saved, and "not yet" for an in-progress Stage 5 position, which is exactly what the roadmap obligation below commits to closing.

**Refuses:** no re-engagement email, no push notification, no countdown to "your progress will expire." None of these are deferred to a later phase — they are permanently out of scope, per Pillar 4's forbidding of "notification strategies designed around loss aversion."

## Roadmap obligations

This document commits future phases to specific, testable work:

- **Phase 1 (now), copy sync owed against three confirmed Pillar 1 violations in shipped copy.** Beat 1, Beat 6, and Beat 7's "App says" text above are marked "(revised — supersedes shipped copy)" because the actual shipped strings in `DEFAULT_STAGES` (`apps/weiqi-learn/public/js/lib/tutorial-flow.mjs`) still carry the violations this document's own audit missed in an earlier draft: Beat 1 explains liberties abstractly before the first stone is placed; Beat 6 glossary-links "territory" inside the clause declaring it absent; Beat 6 and Beat 7 never name their opponents, so Beat 7's Pillar 3 compliance claim was false as shipped. This document is the spec; `tutorial-flow.mjs` is not yet in spec, and syncing the four changed strings (Beat 1's intro, Beat 3's close, Beat 6's intro, Beat 7's intro) into that file is a Phase 1 launch requirement, not a follow-up — the same standard this document already applies to Beats 5 and 9's (proposed) status.
- **Phase 1 (now):** build the two beats marked (proposed) above — the name offer (Beat 5) and the session-end / resume screen (Beat 9) — including a `lastSeenStage` write on every stage transition (not just on stage completion) so a mid-Beat-8 pause resumes at the correct *stage*, even though not the exact board position. Board-position-level resume inside a single stage is explicitly deferred, and is named here so it isn't silently forgotten: closing that gap requires persisting `session.history()`'s move list per stage, replayable through the same `kernel-bridge.mjs` session factory already used for `preview()`.
- **Phase 2 (Play):** the account rung of the identity ramp requires D1's `users` table (already scoped in the platform plan's Phase 2). The merge rule specified above — `max()` on `ladderIndex`, set-union on evidence arrays, `localStorage` never cleared — is the contract Phase 2's account-creation endpoint must implement exactly; a Phase 2 implementation that overwrites instead of unions breaks this document's "nothing lost" claim and should be treated as a regression against this spec, not a new design decision.
- **Phase 2 (Play), instrumentation:** an aggregate-only, anonymous TTFC event pipe (client emits `{t0, t2, sessionId}` once per first-time session; server stores only the delta and a coarse device class, never `sessionId` past dedup) becomes possible once D1 exists. Until then, the ≤90s target is verified by hand, per the "Instrumentation" note above.
- **Phase 3 (Understand):** once concept-graph mastery tracking exists, Beat 9's resume screen is the natural place to surface it ("3 of 10 tactical terms evidenced") — but only as the visible-mastery motivation Pillar 4 already names as legitimate, never as a score or a gap framed as a deficit.
