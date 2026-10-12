---
title: "Your Games Become Your Textbook"
description: "Audience: implementing agents building the mistake-mining pipeline, and reviewers checking it against Pillars 2 and 4. Specifies the four-stage pipeline that turns a player's own games into scheduled, glossary-tagged puzzles, with a worked example and an emitted puzzle JSON."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
references:
  supermemo2:
    title: '[@supermemo2]'
    authors:
      - "Woźniak, P.A."
cites:
  - supermemo2
---

# "Your Games Become Your Textbook"

Audience: implementing agents building the mistake-mining pipeline, and reviewers checking it against [Design Pillars](./design-pillars.md) 2 and 4.

The best tsumego collection for a given player is that player's own losses. Pillar 2 asks for feedback "while the decision is still warm" and names the legibility layer that "translates engine judgment into glossary-vocabulary assertions"; Pillar 4 asks that review never manufacture guilt. This document specifies the pipeline that satisfies both: a moment where a player's own group died is not filed away as a percentage on an autopsy screen — it becomes a small, playable problem, tagged with the glossary term it exercises, scheduled to resurface exactly when memory would otherwise let it go, and then dropped without ceremony if it doesn't.

Four stages, each specced below: **candidate detection**, **concept tagging**, **puzzle-ification**, and **scheduling**. A worked example walks one realistic 9×9 mistake through all four.

## Pipeline at a glance

| Stage | Input | Output | Runs |
|---|---|---|---|
| 1. Candidate detection | A finished (or in-progress) game's move sequence | `MistakeCandidate[]` | Client-side, kernel-only, after any local or bot game (Phase 1); server-side engine pass on stored games (Phase 3) |
| 2. Concept tagging | A `MistakeCandidate` | The same candidate + `concepts: ConceptTag[]` | Client-side, pure |
| 3. Puzzle-ification | A tagged candidate | A puzzle object in the `tsumego.json` shape | Client-side, kernel replay to verify |
| 4. Scheduling | The daily puzzle store | Today's queue (≤ 5 items) | Client-side, on each app open |

Everything through Stage 3 needs nothing but the rules kernel (`@lenticule-science/weiqi-kernel`, `apps/weiqi-kernel`) and the position that was just played. No engine call is required to ship Stages 1–4 for Phase 1; Phase 3 upgrades Stage 1's detection and Stage 3's verification, never replaces them.

## Stage 1 — Candidate detection

A `MistakeCandidate` is the pipeline's common currency from here on:

```json
{
  "gameId": "string",
  "ply": 0,
  "color": "black | white",
  "point": "string | \"pass\"",
  "kind": "self-atari | ignored-atari-given | ko-violation-attempted | avoidable-group-death",
  "groupRef": ["A1", "..."],
  "evidence": { "events": ["kernel SemanticEvent, by ply"], "note": "string" },
  "source": "phase1-kernel-heuristic | phase3-engine-delta"
}
```

### Phase 1 — kernel-only heuristics

These run over the kernel's own [semantic event stream](../../../../../../../apps/weiqi-kernel/src/events.mts) (`atari-given`, `atari-escaped`, `capture`, `ko-started`, `ko-resolved`, `connection`, `eye-formed`, `group-killed`) plus direct liberty/group queries the kernel already exposes for computing that stream. No strength judgment is required — every check below is a decidable fact about the position, not an opinion about the move's quality.

| Kind | Trigger (decidable check) | Guard against false positives |
|---|---|---|
| **self-atari** | After a legal, non-capturing move, the mover's own resulting group has exactly 1 liberty. | Exclude if that stone is captured and then recaptured within 2 plies netting ≥2 opponent stones removed (snapback shape) — the kernel's own capture-event sequence detects this mechanically. |
| **ignored-atari-given** | `atari-given` fires for group *G* at ply *N*; *G*'s owner's move at ply *N+2* is not adjacent to *G*'s sole remaining liberty and is not a capture of the attacking stone; `group-killed` later fires for a group containing *G*. | Require the eventual `group-killed` — an atari that was ignored and never punished is not a mistake, it's a correct read that the group had another way out, and Phase 1 cannot tell those apart without the punishment actually happening. |
| **ko-violation-attempted** | The live client submits a move the kernel's legality check refuses specifically for a ko/superko reason (per the [kernel constitution](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-kernel-constitution.md)'s refusal conditions). | Client-telemetry-only by construction — the move never enters the SGF record, so this candidate kind cannot be mined from an imported game, only from the player's own live session. |
| **avoidable-group-death** | `group-killed` fires for group *G*; at least two `eye-formed` events fired for points adjacent to *G* earlier in the game and were later filled by the opponent without a defending move from *G*'s owner in between. | The kernel's `eye-formed` is explicitly a *simple-eye* approximation (no diagonal check; see the kernel's own deferred-events note on `false-eye`/`seki`). This heuristic must never assert the group *would* have lived — see Stage 2's hedging rule below. |

**Refusal condition for Stage 1 itself:** a heuristic that requires reading depth the kernel cannot supply (predicting what *would* have happened on an unplayed line) does not run in Phase 1. `self-atari`, `ignored-atari-given`, and `avoidable-group-death` are all built to be verifiable against what the game *actually did next* — the punishment is evidence, not inference.

### Phase 3 — engine delta mining (deferred)

Once the KataGo review service (Phase 3, per the [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md)'s "Engines and AI") exists, every stored move gets a win-rate delta against the engine's top choice. A candidate fires when the delta exceeds a rank-tiered threshold (looser for stronger players, tighter for weaker ones, so a beginner's puzzle set isn't full of subtleties only a dan player would call a mistake). This produces candidates Phase 1 structurally cannot see — quiet positional errors with no local tactical shape — but the raw delta itself is never surfaced to the player; it only ever enters the pipeline as a `MistakeCandidate`, which Stage 2 must translate into glossary vocabulary before anything is shown, honoring Pillar 2's forbid on raw win-rate deltas below the rank where they're actionable.

## Stage 2 — Concept tagging

Each candidate gets one or more `ConceptTag`s, keyed to the glossary term(s) the mistake exercises — the same `term`/`termRef` shape the kernel already stamps on its own events, so a puzzle's tag and a live-game hover-card point at the identical file:

```json
{
  "term": "atari",
  "termRef": "../../content/text/glossary/terms/atari.md",
  "claim": "This group had one liberty left and nothing was played there.",
  "hedge": "confirmed | probable"
}
```

**Naming note.** An earlier draft of this document called this shape `Assertion[]`, the same name [Legibility Layer](./legibility-layer.md#1-the-assertion-atomic-unit) uses for its own, structurally incompatible interface — a fixed `ClaimType` enum keyed to a board `Subject`, categorical `confidence`, and a typed `evidence` bag, versus this pipeline's free-text `claim` string keyed to a mined puzzle and a two-value `hedge`. The two serve different needs (a natural-language tag for a puzzle card here; an enum-typed claim about a live board subject there) and this document does not attempt to unify them — `ConceptTag` is the name going forward, chosen specifically so the collision stops implying a shared shape that was never real. A future consumer that wants to render mined-puzzle tags and live legibility-layer assertions through one UI component needs a translation layer neither document specifies; that translation is owed work, tracked in Roadmap obligations, not a problem this rename solves by itself.

| Mistake kind | termRef(s) | hedge |
|---|---|---|
| self-atari | `atari` | confirmed |
| ignored-atari-given | `atari`, `capture` | confirmed |
| ko-violation-attempted | `ko` | confirmed |
| avoidable-group-death | `eye`, `life-and-death` | **probable**, until Phase 3 confirms |

`hedge: probable` is a load-bearing distinction, not decoration: `avoidable-group-death` is built on the kernel's conservative simple-eye check, and Stage 2's claim template for it must read as an invitation to look ("this group's shape was worth a second look when...") rather than a verdict ("this group could have lived"). Only a Phase 3 engine confirmation may upgrade the hedge to `confirmed`, at which point the assertion text may state the outcome plainly.

**Open corpus gap.** `self-atari` has no glossary term yet (`content/text/glossary/terms/` currently has no `self-atari.md`). Per the kernel's own change-authority clause — "the kernel does not originate rules content; it executes what the corpus already defines" — the same rule binds this pipeline: Stage 2 tags self-atari candidates under the generic `atari` term until `self-atari.md` exists, and does not invent a termRef the corpus hasn't authored. Authoring that term is corpus debt, not a blocker for shipping this pipeline — tracked in Roadmap obligations below.

## Stage 3 — Puzzle-ification

### Trimming algorithm

1. Let *G* be the candidate's `groupRef` (the affected group's points at the mistake ply).
2. Compute `box`: the bounding rectangle of *G*.
3. Compute `frame`: `box` expanded by 2 lines on every side, clipped to the real board's edges.
4. Collect every stone standing inside `frame` at the candidate ply, unchanged.
5. For each stone inside `frame` whose full-board liberty count (computed by the kernel against the *actual* board) exceeds its liberty count computed against `frame` alone, and whose group is not *G*: mark it `outside_liberties: true` in the puzzle's construction metadata, rather than expanding `frame` to visually prove it. This is the [R4](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/teaching-articles/references/regression-positions.md#r4--suicide-illegal-under-standard-rulesets) doctrine trick — R4's own diagram tells the solver to "treat the Black ring shown as having additional liberties outside this diagram," and puzzle-ification applies the identical permission to any wall the trim frame cuts through that isn't the group under examination.
6. Re-map `frame`'s coordinates into the app's existing local puzzle coordinate space (see `tsumego.json`'s convention below), with the frame's top-left corner as the new `A1`.
7. **Correctness check:** replay the candidate's intended solution against `frame` alone via the kernel, and separately against the full board. If the two replays disagree on the outcome that matters (liberty count, capture, life status of *G*), expand `frame` by one more line and retry, up to a cap of 7 total lines in either dimension — the ceiling the existing tsumego player already renders at (every entry in `apps/weiqi-learn/public/data/tsumego.json` uses `"size": 7`). If the frames still disagree at the cap, **refuse puzzle-ification**: the candidate is kept as a full-board-flagged record for manual review, never shipped as a miniaturized puzzle whose diagram silently misrepresents the position.

### toPlay and solution

`toPlay` is set to the color that made the mistake; the puzzle position is the board exactly as it stood at the mistake ply, before the mistake move — the player is handed back the decision, not the aftermath. The accepted solution is the move Stage 1's heuristic identified as the fix (the group's sole remaining liberty for `self-atari`/`ignored-atari-given`; the ko-legal alternative point for `ko-violation-attempted`).

**Verification.** Phase 1 verifies by kernel replay only: apply the proposed solution and confirm the kernel's own resulting event/liberty state matches the claimed fix (e.g., the group's liberty count is now > 1). Because the fix point is, by construction, the group's one remaining liberty, uniqueness is automatic and needs no search — there is exactly one point that escapes a 1-liberty group. Phase 3 adds an engine check for the harder candidate kinds (`avoidable-group-death`, and anything Phase 3 itself mined): the solution's win-rate must lead the second-best legal move by a rank-tiered margin, so a beginner's puzzle is never subtle enough to be ambiguous at their level. This is the same threshold table Stage 1's Phase 3 detector uses — one config, not two.

### Refutation line

Every mined puzzle carries a `refutation` block, shaped exactly like `tsumego.json`'s existing `lines` entries (`{ move, reply, note }`), but holding what actually happened rather than a hypothetical try: `move` is the real mistake, `reply` is the opponent's real punishing move from the source game. This is the one field with no equivalent in an authored tsumego — authored puzzles show a plausible wrong try; mined puzzles show the actual one. The existing `lines` renderer already understands this triple shape and needs only a second label ("what really happened") to display it.

## Stage 4 — Scheduling

Each shipped puzzle becomes a scheduler item: `{ puzzleId, repetitions: 0, intervalDays: 0, ef: 2.5, due: minedDate }` — first review is due immediately, since Pillar 2's whole case is reviewing while the decision is warm.

**Say the mechanism out loud first.** [Calm Technology](./calm-technology.md#part-1--the-anti-patterns-register) insists on naming a mechanism's real psychology before keeping it, then saying why it doesn't buy what it costs — a discipline this section owes SM-2 itself, not just the guilt UI that usually surrounds it. SM-2 and its Anki/Duolingo-family descendants are popular specifically because spacing a review just before the forgetting curve predicts a lapse reliably produces daily-return habits; that is the algorithm's designed function, independent of what content sits inside it, and it would be dishonest to describe it here as a neutral pedagogical tool that happens to also be good at retention.

What's kept and what's stripped, stated plainly: the scheduling math — spacing reviews to land just before forgetting — is retained because it is also the best-documented way to make a specific correction actually stick, which is Pillar 2's own goal for this instrument independent of any retention motive; the pedagogical case stands on its own, and would still justify building this feature even with no way to measure whether it changed how long anyone kept using the app. What's refused is everything the mechanism is usually paired with to convert that stickiness into engagement pressure: no streak counter over review completion, no "you're behind" framing (the silent-drop rule below), no cap that grows into an obligation (the 5-item cap does not compound — a month of missed days still shows 5 puzzles, never 35), and no badge for consistency. A scheduler that reliably improves retention of a specific, real correction the player already made is doing Pillar 2's job; the version of it that would fail Pillar 4 is the one wearing the guilt UI this document strips out below.

**Algorithm: SM-2 family** [@supermemo2]. On each attempt, map the outcome to a quality grade `q` (0–5), then apply Woźniak's original update unmodified:

| Outcome | q |
|---|---|
| Solved, no hint, first try | 5 |
| Solved, explored a branch first, still first try | 4 |
| Solved after one hint | 3 |
| Failed, then recognized the idea on reveal | 2 |
| Failed, replayed the exact original mistake | 0 |

```
EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
EF' = max(EF', 1.3)
if q < 3:
    repetitions = 0; intervalDays = 1
else:
    repetitions += 1
    intervalDays = 1               if repetitions == 1
                  = 6               if repetitions == 2
                  = round(intervalDays * EF')  otherwise
due = today + intervalDays
```

**Daily queue, capped, silent-drop.** The queue a player sees is never larger than **5** items — small enough that a player returning after a month off sees five puzzles, not a mountain (Pillar 4's decision test: "can the player put the app down for a month and return to warmth rather than penalty?"). Each day: gather every item with `due <= today`; if that set is larger than 5, show the 5 with the lowest `ef` (weakest-held first); every due item *not* shown today has its `due` silently advanced by one day, with no missed-review count, no red badge, no "you have 47 overdue cards" banner anywhere in the product. The due-set can grow arbitrarily large behind the scenes; the number the player ever sees is bounded at 5, forever. That is the whole mechanism — no separate "catch-up mode" exists to punish a return, because building one would be exactly the streak-shaped feature Pillar 4 forbids.

**Boundary with mastery tracking.** This scheduler decides *when one specific mined puzzle resurfaces*. It is not the same model as `./mastery-model.md`, which is expected to decide *whether a glossary concept counts as demonstrated* on the skill tree, aggregating evidence across live play, lessons, and puzzles alike. The seam: every attempt on a mined puzzle emits one evidence sample per tagged `concepts[].termRef` (Stage 2's output) into whatever evidence stream `mastery-model.md` consumes — the same shape a live-game semantic event already produces. The scheduler does not compute a mastery score, and the mastery model does not decide review timing; each owns its own state. This document depends on `mastery-model.md` presenting a per-`termRef` evidence-intake interface — nothing more specific than that is assumed here.

## UI stance

Every other stage in this pipeline is specced down to schemas and algorithms; this section exists because an earlier draft of this document never specified the one thing a player actually experiences — the copy that introduces the feature, and how it avoids colliding with the calm return experience [onboarding-screenplay.md](./onboarding-screenplay.md) already promises. [Mastery Model](./mastery-model.md#ui-stance) has a section by this name for the same reason: a mechanically correct pipeline still needs a stated stance on how it reads to the player, or it defaults to whatever a builder improvises under deadline.

**The collision this section closes.** Beat 6 of the onboarding ladder (`onboarding-screenplay.md`, this directory — "Capture Go: First Blood") is precisely the stage where a first-time player, still learning atari, is expected to sometimes lose the "ignored-atari-given" way this pipeline's own worked example mines. Beat 9 ("Session end") promises the player who returns after a pause a screen that says "Welcome back... no reference to elapsed time" — calm, warm, no penalty framing. Without an explicit rule, the very next open of the app could instead surface a puzzle titled "Answer the Atari," rebuilt from the loss that already discouraged them, with no warning it was coming and no distinction from an authored tsumego. That is not what Beat 9 promises, and this pipeline must not be the thing that quietly breaks that promise.

**First-fire introduction, once, before the first mined puzzle ever shows.** Not a modal — an inline card at the top of wherever the daily queue first renders, in the same register as onboarding's own inline copy, dismissible with one tap and never shown again after the first dismissal:

> **These are puzzles built from your own games — a shape that once cost you something, handed back as a position to solve.** You can turn this off any time in settings. [Got it] [Turn off]

**Framing rule for individual puzzle titles.** A mined puzzle's title and prompt describe the *position*, in the same neutral register `tsumego.json`'s authored puzzles already use ("Save the group," not "Answer the Atari, Again" or anything that names the loss). The `refutation` block (Stage 3) is where the source game's actual outcome is narrated, and only after the player has already attempted the puzzle — never in the title, never as the first thing the player reads, so a player who doesn't want the reminder of the specific loss can still solve the position on its own terms.

**No collision with Beat 9's "no reference to elapsed time."** The daily queue never leads a return session — it renders in its normal place in the app's navigation, the same as any day, never as an interstitial the returning player is routed through first. A player who has been away for a month sees the same ≤5-item cap (Stage 4) and the same warm, generic Beat 9 copy as anyone else; the mined-puzzle queue does not get its own "welcome back" language layered on top of it, because that would be this pipeline inventing a second re-engagement surface Pillar 4 didn't ask for.

**Opt-out.** A single settings toggle, `mistake-mining: "on" | "off"`, defaulting to on. Turning it off stops new candidates from being mined going forward; it does not delete puzzles already scheduled, which the player can still finish or let silently drop per Stage 4's own no-penalty rule. This lives alongside `RitualPreference` and the atari-sound preference in the same local settings object [Ritual and Atmosphere](./ritual-and-atmosphere.md#sound-design) already establishes as the pattern for this kind of low-stakes, remembered-once toggle.

## Privacy and local-first stance

- Stages 1–4's Phase 1 forms run entirely against the kernel, which is a pure, dependency-free package that "runs identically in Workers, Node, and the browser." Mined puzzles and the scheduler's item state are computed and stored client-side by default (local storage in the browser); no game, candidate, or puzzle is transmitted anywhere as a side effect of playing, reviewing, or scheduling.
- Phase 3's engine delta mining is the one stage that necessarily leaves the device — the game record goes to the KataGo review service and the resulting candidates come back — but the output still lands in client-side storage, not a server-side profile, unless the player takes a separate, explicit action.
- **Refusal condition:** the pipeline must never upload a mined puzzle, a candidate, or the scheduler's state as part of routine sync, account creation, ratings, or analytics. The only path that copies a mined puzzle off-device is a player-initiated share (for instance, to a mentor, per Pillar 5's teaching-lineage material) — one puzzle, one action, visibly consented to, never a default.

## Worked example

A 9×9 game, Black to move in a small local shape.

**What happened (source game, ply 33–36).** White's move at ply 33 (`E5`) reduces Black's two-stone group `{D5, D6}` to one liberty (`D4`) — the kernel fires `atari-given`. At ply 35, Black plays elsewhere (tenuki) instead of extending. At ply 36, White plays `D4`, capturing both Black stones — the kernel fires `capture` and `group-killed`.

**Stage 1.** `atari-given` at ply 33 on `{D5,D6}`; Black's ply-35 move is not `D4` and not a capture of the White stone at `E5`; `group-killed` fires at ply 36 for `{D5,D6}`. All three conditions for `ignored-atari-given` are met:

```json
{
  "gameId": "g-2026-08-14-0091", "ply": 33, "color": "white", "point": "E5",
  "kind": "ignored-atari-given", "groupRef": ["D5", "D6"],
  "evidence": { "events": ["atari-given@33", "group-killed@36"], "note": "sole liberty D4 never played" },
  "source": "phase1-kernel-heuristic"
}
```

**Stage 2.** Tagged `atari` (confirmed) and `capture` (confirmed) — both terms already exist, no hedging needed.

**Stage 3.** `groupRef` bounding box is `D5–D6`; frame expands to `B3–F8` (5×6, well inside the 7×7 cap). Remapped to local coordinates with the frame's corner as `A1`: Black `C3, C4`; White `B3, B4, C5, D3, D4`; sole liberty at `C2`. `toPlay: black`. Kernel replay confirms `C2` takes the group from 1 liberty to 3 — the unique escaping move.

**Stage 4.** New item: `{ repetitions: 0, intervalDays: 0, ef: 2.5, due: "2026-08-14" }` — due today.

**Emitted puzzle** (`tsumego.json` shape, with the two mined-only fields, `refutation` and `mined`):

```json
{
  "id": "mined-g-2026-08-14-0091-p33",
  "set": "mined",
  "title": "Answer the Atari",
  "size": 7,
  "toPlay": "black",
  "stones": [
    { "pt": "C3", "color": "black" },
    { "pt": "C4", "color": "black" },
    { "pt": "B3", "color": "white" },
    { "pt": "B4", "color": "white" },
    { "pt": "C5", "color": "white" },
    { "pt": "D3", "color": "white" },
    { "pt": "D4", "color": "white" }
  ],
  "goal": "Black's two stones are down to one liberty. Save them.",
  "accept": ["C2"],
  "lines": { "C2": [] },
  "failNote": "Any move but C2 leaves this group at one liberty; White takes it next.",
  "refutation": {
    "move": "elsewhere",
    "reply": "C2",
    "note": "In the source game, Black played away from this group instead of extending. White answered by taking the last liberty, capturing both stones outright."
  },
  "mined": {
    "sourceGameId": "g-2026-08-14-0091",
    "sourcePly": 33,
    "mistakeKind": "ignored-atari-given",
    "concepts": [
      { "term": "atari", "termRef": "../../content/text/glossary/terms/atari.md" },
      { "term": "capture", "termRef": "../../content/text/glossary/terms/capture.md" }
    ],
    "verifiedBy": "kernel-replay",
    "minedAt": "2026-08-14"
  }
}
```

## Roadmap obligations

- **Phase 1 (Learn)** ships all four stages in Phase 1 form: kernel-only Stage 1 heuristics running over the bot-ladder's local games, Stage 2 tagging, Stage 3 trimming with kernel-only verification, and the Stage 4 scheduler — all client-side, no account, no server dependency, consistent with Phase 1's existing scope. It extends the Learn app's tsumego player (same JSON shape, `mined` set alongside the authored sets) rather than replacing it. It also ships the `self-atari` detector tagged generically under `atari`, per Stage 2's open-gap note; authoring `self-atari.md` is tracked as corpus debt against the glossary, not a code blocker. Phase 1 also ships everything in UI stance, above — the first-fire introduction card, the neutral-title framing rule, and the `mistake-mining` opt-out toggle — as launch requirements for the feature, not follow-ups; a Phase 1 build that ships the pipeline without them ships a feature this document does not consider complete.
- **Phase 2 (Play)** extends candidate detection from local bot games to the player's own stored game archive once D1 accounts exist; the scheduler's local item store gains an optional server-side backup, local-first by default and synced only on explicit account opt-in — never a routine upload.
- **Phase 3 (Understand)** delivers the Phase 3 engine-delta detector in Stage 1, the engine-verified uniqueness threshold table in Stage 3, and the `hedge: probable → confirmed` upgrade path for `avoidable-group-death` concept tags in Stage 2. It is also where this document's dependency on `mastery-model.md`'s per-`termRef` evidence-intake interface must be checked against that document's actual shape, once it exists. It also owns the translation layer named in Stage 2's naming note above, if a consumer surface is built that needs to render `ConceptTag`s and [Legibility Layer](./legibility-layer.md#1-the-assertion-atomic-unit)'s `Assertion`s side by side — not owed before then, since nothing in this corpus currently needs that unified rendering.
- **Phase 4 (Belong)** builds the explicit-share surface referenced in the privacy section — sending a mined puzzle to a mentor as a review anchor — since the mentor ladder itself is Phase 4 scope.
