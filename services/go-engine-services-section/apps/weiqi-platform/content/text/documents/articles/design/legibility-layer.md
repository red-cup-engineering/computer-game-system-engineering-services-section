---
title: Legibility Layer
description: "Audience: engineers building Pillar 2's feedback instruments (group-status ledger, cause-chain post-mortem, counterfactual replay) and reviewers checking a proposed assertion against kernel signals before it ships. Defines the assertion schema, the three instruments over it, the rank-gated disclosure table, and an honest Phase-1-vs-Phase-3 computability boundary."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
---


[Pillar 2](./design-pillars.md#pillar-2--feedback-while-the-decision-is-still-warm) names the legibility layer as one of three canonical feedback instruments, and the [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md#the-rules-kernel) commits it to Phase 3: "concept-language review synthesis" over the kernel's semantic events joined with engine output. This document is that commitment written down precisely enough to build against. It defines the **assertion** — the one atomic unit every feedback surface in Pillar 2 is made of — and specifies the three instruments that consume assertions: the group-status ledger, the cause-chain post-mortem, and counterfactual replay.

The governing discipline is the plan's build motto applied to judgment, not just rules: an assertion is never prose invented to sound helpful. Every assertion traces to a number the kernel or the analysis engine actually computed, and every claim type has a stated computability boundary — what Phase 1 (kernel-only) can honestly assert today, and what waits on KataGo in Phase 3. Section 6 states that boundary as a table; nothing in Sections 2–5 should be read as already running.

## 1. The assertion: atomic unit

An assertion is a single, falsifiable claim about one subject on the board, backed by evidence, linked to the glossary term that names it, and gated to the rank at which surfacing it helps rather than overwhelms.

```typescript
interface Assertion {
  subject: Subject;
  claim: ClaimType;
  confidence: "certain" | "likely" | "heuristic";
  termRefs: string[];       // glossary paths, kernel TERM_PATH format
  evidence: Record<string, number | number[] | string | boolean>;
  rankGate: "25k" | "15k" | "5k";
}

type Subject =
  | { kind: "group"; id: string }   // "<color>:<anchor-coord>", e.g. "B:C3"
  | { kind: "region"; id: string }  // "<size>:<macro-cell>", e.g. "9x9:upper-right"
  | { kind: "move"; id: string };   // "move:<ply>", e.g. "move:47"

type ClaimType =
  | "group-weak"
  | "group-settled"
  | "base-missing"
  | "cut-exists"
  | "territory-lead"
  | "urgent-area"
  | "seki-standoff"
  | "ko-threat-size";
```

**Field notes, each one a decision a builder would otherwise have to invent:**

- **subject.id for a group** is the coordinate of the group's *anchor stone* — the earliest-played stone in the group's current composition — not a UUID and not the stone count. When two tracked groups merge, the merged group keeps the earlier-born anchor; the later anchor is retired with a `merged-into` pointer in the ledger (Section 3), not deleted, so a post-mortem can still say "the group born at C3 absorbed the one born at C5 on move 12." Groups are re-resolved by flood fill at query time (same algorithm as the kernel's `findGroup`); the anchor is bookkeeping the legibility layer adds on top, since the kernel itself carries no persistent group identity across moves.
- **subject.id for a region** divides the board into a 3×3 macro-grid (corner/side/center × two axes) and names cells with the conventional Go vocabulary — `upper-right`, `right-side`, `center`, and so on. This is a fixed, decidable partition, not a clustering heuristic: for a 9×9 board the macro-cells are 3×3 point blocks; the same fractional split applies at 13×13 and 19×19.
- **confidence** is categorical, not a raw probability, because Pillar 4 forbids surfacing precision the player can't act on. Bucketing rule (applies whether the source is a kernel rule or an engine number): `certain` = the kernel fired the corresponding semantic event this move, no reading required; `likely` = an engine evidence number crossed a stated threshold band and held for ≥2 consecutive analyses; `heuristic` = a Phase-1 proxy computed from liberties/eye-shape with no life-and-death reading behind it. An assertion whose evidence doesn't clear one of these three definitions is not emitted.
- **termRefs** use exactly the kernel's `TERM_PATH` convention (path relative to the kernel package root — see [`events.mts`](../../../../../../../apps/weiqi-kernel/src/events.mts)), so a consuming UI component that already resolves kernel `termRef`s for live-play hover-cards resolves assertion `termRef`s the same way, with no second code path.
- **evidence** is claim-shaped, not one universal bag: Sections 2–4 give the concrete fields per claim type as they're introduced. The type above is the envelope; the per-claim shapes are the contract.
- **rankGate** is the *weakest* rank tier permitted to see this assertion, using the platform's three-tier simplification of the kyu/dan ladder (Section 6 justifies the tier boundaries against the plan's onboarding ladder). Tiers order weakest-to-strongest as `25k < 15k < 5k`; a player is eligible for a gate if their tier is at least as strong. A `5k`-and-stronger player (including all dan ranks) sees everything a `15k` player sees, plus more.

## 2. Claim types

| Claim | What it asserts | Closest existing glossary anchor | Content gap |
|---|---|---|---|
| `group-weak` | This group's life is presently in doubt. | [atari](../../../../../../../content/text/glossary/terms/atari.md), [liberty](../../../../../../../content/text/glossary/terms/liberty.md) | none — well covered |
| `group-settled` | This group's fate is no longer in doubt (alive or dead). | [life-and-death](../../../../../../../content/text/glossary/terms/life-and-death.md), [dead-stones](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/dead-stones.md) | none |
| `base-missing` | This group has no local room to make two eyes. | [eye](../../../../../../../content/text/glossary/terms/eye.md), [false-eye](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/false-eye.md) | no `base.md` term yet; eye.md covers the concept substantially, so this claim ships on the existing anchor rather than waiting |
| `cut-exists` | This point would separate two enemy groups whose separation matters. | [connection](../../../../../../../content/text/glossary/terms/connection.md) (as the named opposite) | **no `cut.md` term exists at all** — the kernel's own `events.mts` defers cut detection for exactly this reason (see its "Deferred events" note); this claim type has no glossary anchor to link to until that term is authored |
| `territory-lead` | One side leads the board-wide score estimate by N points. | [territory](../../../../../../../content/text/glossary/terms/territory.md), [area-scoring](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/area-scoring.md), [komi](../../../../../../../content/text/glossary/terms/komi.md) | none |
| `urgent-area` | Of everything live right now, this region carries the largest swing. | [liberty](../../../../../../../content/text/glossary/terms/liberty.md), [atari](../../../../../../../content/text/glossary/terms/atari.md) (nearest existing anchors) | the natural terms — *tesuji*, *vital point* — are on the plan's unauthored-content backlog; `urgent-area` borrows the nearest shipped anchors until they exist |
| `seki-standoff` | This position is a seki: a mutual standoff neither side can profitably resolve. | [seki](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/seki.md) | none — the term exists in the glossary today |
| `ko-threat-size` | This ko threat is smaller/larger than the ko itself. | [ko](../../../../../../../content/text/glossary/terms/ko.md), [komi](../../../../../../../content/text/glossary/terms/komi.md) (the "what is this worth" framing) | none — both anchors exist today |

**Where these two came from.** `seki-standoff` and `ko-threat-size` were added to close a gap [Opponent Cast](./opponent-cast.md#roadmap-obligations) named against an earlier version of this enum: The Contester's and The Debtor's post-mortems need claim types this document didn't have. Both anchors already exist in the glossary, unlike `cut-exists` below, so neither is blocked on corpus authorship — only on the detector work Section 7 tracks.

**Refusal condition.** `cut-exists` is not emitted by any Phase 1, 2, or 3 build until `cut.md` exists in the glossary *and* the kernel's own cut detector is implemented against it (the algorithmic blocker events.mts already names: knowing the two groups were actually connectable, a life-and-death-shaped question). Shipping `cut-exists` assertions off a raw board-adjacency heuristic, ahead of either prerequisite, produces exactly the unsound-detector failure mode `events.mts` already refused once; this document refuses it a second time, for the same reason.

## 3. Instrument 1 — group-status ledger

The ledger is the substrate the other two instruments read from: a per-group timeline of state, not a single verdict.

```typescript
interface GroupLedgerEntry {
  groupId: string;          // anchor-coordinate id, Section 1
  moveNumber: number;
  state: "forming" | "alive" | "weak" | "settling" | "dead";
  assertionRefs: string[];  // ids of assertions that justified this state transition
}
```

**State transitions and what backs them:**

- `forming → alive`: the group has stones on the board and no assertion currently claims it weak. Default state; asserted implicitly, not explicitly (Pillar 4 — no news is not itself news).
- `→ weak`: a `group-weak` assertion fires for this group (Section 2). Phase 1 evidence: `{ libertyCount, libertyCountTrend: number[] }` — heuristic confidence, since liberty count is a proxy, not a life-and-death verdict. Phase 3 evidence: `{ ownership, ownershipDelta }` from KataGo's per-point ownership output — `likely` or `certain` confidence per the Section 1 bucketing rule.
- `→ settling`: a `group-settled` assertion fires with `heuristic`-or-weaker confidence — the group looks resolved but the claim hasn't cleared the `certain`/`likely` bar yet. This state only exists in the Phase 3 ledger; Phase 1 has no signal that produces it (Section 6).
- `→ dead`: either the kernel's `group-killed` event fires (capture — `certain`, Phase 1 available today), or a Phase-3 `group-settled` assertion crosses to dead-side confidence at game end via the dead-stone-marking protocol ([dead-stones.md](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/dead-stones.md)).
- `merged-into`: not a state but a pointer, written when this group's anchor is absorbed into another (Section 1). The ledger keeps the entry rather than deleting it so a post-mortem can still narrate the merge.

The ledger's job is narrow: record *when* a group's status changed and *what evidence said so*, per move, so the instruments in Sections 4 and 5 have a timeline to mine instead of a single end-of-game number.

## 4. Instrument 2 — cause-chain post-mortem

The post-mortem takes a group that reached `dead` in the ledger and tells its death as a short story of ≤3 decisive moments, per Pillar 2's forbidding of "an autopsy without a finding."

**Algorithm sketch (Phase 3; requires ownership curves — see Section 6):**

1. **Input.** A dead group `G`, its ledger entries from `forming` to `dead`, and its ownership curve `o(m)` — KataGo's per-move average ownership of `G`'s stones, for every move `m` from `G`'s birth to the move it died.
2. **Band the curve.** Three fixed bands, not a learned threshold: `SAFE` (`o ≥ 0.7`), `CONTESTED` (`0.3 ≤ o < 0.7`), `LOST` (`o < 0.3`).
3. **Find crossings.** A crossing is any move where `o(m)`'s band differs from `o(m-1)`'s band. Keep only *downward* crossings (toward `LOST`) — the moments that cost the group ground, since those are the ones a player can act differently on next game.
4. **Rank and select.** Order downward crossings by `|o(m) - o(m-1)|` (the size of the drop), take the top ≤3, then re-sort those chronologically for narration. Capping at 3 is a Pillar 2 discipline, not a technical limit: a post-mortem that names ten moments teaches nothing in particular.
5. **Attach an assertion to each selected moment.** Pick the claim type the evidence actually supports at that move — typically `base-missing` or `group-weak` for a mid-curve crossing, `cut-exists` (once available, Section 2) for a moment where two friendly groups needed to connect and didn't. Pull `termRefs` from any kernel semantic event that fired at the same move (e.g. `atari-given`) plus the claim's own anchor (Section 2).
6. **Narrate.** A fixed template stitches the ≤3 assertions into prose, chronological, each sentence naming the move number, the claim in glossary vocabulary (via `termRefs`, so every technical word in the sentence is a live link), and the evidence numbers that backed it. The last sentence is always the "next time" clause Pillar 2's decision test requires.

### Worked example — a 9×9 group death

*(Invented for illustration; move numbers and ownership values are plausible, not drawn from a real game record.)*

Black's upper-right group, anchored at G7, is built moves 4–14, drawn into a fight from move 20, and captured at move 33.

Ownership curve for the group (selected moves, Black's perspective):

| Move | 4 | 14 | 19 | 20 | 24 | 25 | 29 | 30 | 33 |
|---|---|---|---|---|---|---|---|---|---|
| o(m) | 0.55 | 0.81 | 0.79 | 0.52 | 0.48 | 0.24 | 0.21 | 0.09 | 0.00 |

Band sequence: `SAFE`(14) → `SAFE`(19) → `CONTESTED`(20) → `CONTESTED`(24) → `LOST`(25) → `LOST`(29) → `LOST`(30, deeper) → dead(33). Downward crossings: move 20 (`SAFE→CONTESTED`, drop 0.27), move 25 (`CONTESTED→LOST`, drop 0.24). Only two crossings clear the band boundaries in this curve, so the algorithm returns both — under the ≤3 cap, not padded to it.

Emitted assertion chain:

```json
[
  {
    "subject": { "kind": "group", "id": "B:G7" },
    "claim": "group-weak",
    "confidence": "likely",
    "termRefs": ["../../content/text/glossary/terms/atari.md", "../../content/text/glossary/terms/liberty.md"],
    "evidence": { "ownership": 0.52, "ownershipDelta": -0.27, "moveNumber": 20 },
    "rankGate": "15k"
  },
  {
    "subject": { "kind": "group", "id": "B:G7" },
    "claim": "base-missing",
    "confidence": "likely",
    "termRefs": ["../../content/text/glossary/terms/eye.md", "../../content/text/glossary/terms/false-eye.md"],
    "evidence": { "ownership": 0.24, "ownershipDelta": -0.24, "moveNumber": 25, "eyeCandidates": 1 },
    "rankGate": "15k"
  }
]
```

Final prose (as rendered to a 15k-or-stronger player; a 25k player never sees this post-mortem — Section 6):

> Your upper-right group (born move 4 at G7) came under real pressure at **move 20**, when White's push cost it half its safety margin — it went from settled to contested in one move. It never recovered: by **move 25** it had one eye candidate and no second, the shape a group needs to survive a fight without needing to run. It died at move 33.
>
> Next game, the move to look for is the one *before* move 20 — the group's shape wanted a second eye space while it still had the liberties to make one, not after the fight arrived.

Both sentences point at one thing each, per Pillar 2's decision test ("could they enact the alternative"), and every technical term (`group`, `eye`, `liberty`) is a live glossary link via the assertions' `termRefs`.

## 5. Instrument 3 — counterfactual replay

Where the post-mortem is read, counterfactual replay is *enacted* — Pillar 1's discipline applied to feedback, per Pillar 2's third decision test.

**Branch spec.**

- **Trigger.** The player opens a decisive moment from a cause-chain post-mortem (Section 4) or any move in game review, and chooses "play it differently."
- **Creation.** The branch forks the game at the position *after* move `N-1` — i.e., right before the decisive move — carrying forward the full kernel `Position` (board, captures, active ko point, ruleset, komi). The branch is a new game record with a `parentGameId` and `forkMove: N`; it is never entered into the ladder, rating history, or game-count statistics (Pillar 4 — no stakes attach to a rehearsal).
- **Opponent.** The branch plays against a scripted bot chosen to keep punishing the *same* flaw class the triggering claim named, not a random or strongest-available opponent — Pillar 3's "opponents are teachers wearing masks" applies to rehearsal exactly as it does to first play. Concretely: each claim type maps to a bot capability tag (`group-weak`/`base-missing` → *captures unsettled groups*, matched today by the plan's Phase 1 `greedy-capture` scripted bot; `cut-exists` → *punishes disconnection*, a Phase 3 persona once that claim ships). The branch opponent is the roster's bot carrying the matching tag, at or just above the player's own rank tier — never strong enough to win the branch by reading the player can't yet do, per Pillar 3's own forbid.
- **Termination.** The branch ends at the first of: (a) the resurrected group's ledger entry (Section 3) reaches a terminal state again (`alive`/`settled` or `dead`) — the natural end, since the lesson is "did it live this time"; (b) a fixed move cap past the fork (20 moves on 9×9, 30 on 13×13, 40 on 19×19 — capped larger on a bigger board because fights take longer to resolve there); or (c) the player exits. On termination the branch writes its own one-line ledger comparison against the original line ("this time the group lived because move 20 went to the second eye space instead"), which is itself an assertion (`group-settled`, evidence citing both curves) rather than free-text summary.
- **Storage.** Branches persist under the plan's D1 game-archive schema, keyed by `(parentGameId, forkMove)`, retained the same way any other game record is — available to revisit, never surfaced as a stat.

## 6. Rank-gated disclosure

Gating follows the plan's own onboarding ladder (capture-go → full 9×9 rules → 13×13 → 19×19), not an arbitrary numeric cutoff: a claim surfaces once the player has plausibly *enacted* the concept it names, per Pillar 1. `25k` maps to the capture-go/first-full-rules stages; `15k` to 13×13 and joseki-shaped play; `5k` (and everyone stronger) to 19×19 competence.

| Claim | 25k | 15k | 5k | Why |
|---|---|---|---|---|
| `group-weak` | ✓ certain-only (a kernel `atari-given` fired this move) | ✓ + heuristic liberty-trend | ✓ + engine ownership | A 25k player has enacted "one liberty left" (capture-go is built entirely on it); trend and engine grading assume more reading than that stage has. |
| `group-settled` | — | ✓ post-game only, from dead-stone agreement | ✓ mid-game, engine-graded | Settlement is a scoring-time fact in Phase 1/2 (Section 3); it cannot be asserted live before Phase 3. |
| `base-missing` | — | ✓ heuristic (no simple eye + falling liberties) | ✓ engine-graded | Eye shape is a stage-3 idea on the onboarding ladder — a 25k player hasn't enacted it yet, so naming it would violate Pillar 1. |
| `cut-exists` | — | — | ✓ once shipped (Section 2 refusal condition) | Needs a life-and-death-shaped connectivity judgment no rank below dan-adjacent play reliably reasons about, and needs `cut.md` to exist first. |
| `territory-lead` | — | ✓ end-of-game estimate only (last ~10 moves) | ✓ full-game engine estimate | Pillar 2 explicitly forbids raw score/point swings below the rank where they're actionable; mid-game territory is mostly undecided flood-fill regions anyway (Section 7). |
| `urgent-area` | — | — | ✓ engine-only | Ranking board-wide swing requires a policy/value signal; no kernel-only proxy for "biggest fight right now" exists (Section 7). |
| `seki-standoff` | — | — | ✓ once shipped | Seki reading is a single-digit-kyu-and-above concept on the onboarding ladder ([Opponent Cast](./opponent-cast.md)'s The Contester sits at "early single-digit kyu, 19×19"); gated to `5k` to match where the corpus already places it. |
| `ko-threat-size` | — | — | ✓ once shipped | Judging a threat's size against a ko's value needs a score estimate; same rank placement as The Debtor, the opponent this claim type exists to narrate. |

A cell of "—" is a refusal, not an oversight: the corresponding claim is withheld at that tier by design, per Pillar 4's "hidden by default for learners."

## 7. What Phase 1 can compute vs. what waits on KataGo

| Signal or claim | Phase 1 (kernel-only: semantic events, liberty counts, territory flood-fill) | Needs KataGo (Phase 3) |
|---|---|---|
| Kernel semantic events (`atari-given/escaped`, `capture`, `ko-started/resolved`, `connection`, `eye-formed`, `group-killed`, `pass`) | Yes — these are the kernel's own `SemanticEvent`s, computed today, per-move, deterministic | — |
| `group-weak` | Heuristic only, from live liberty count and its recent trend; no life-and-death reading behind it | `likely`/`certain` grading from ownership and ownership delta |
| `group-settled` | Only post-game, only via dead-stone *agreement* (a procedural fact, not a computed judgment — see [dead-stones.md](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/terms/dead-stones.md)) | Mid-game, from sustained ownership crossing the `SAFE`/`LOST` bands (Section 4) |
| `base-missing` | Heuristic only, from the kernel's existing `isSimpleEye` check (no diagonal-control test — a documented limitation of that function) plus liberty count | Graded from ownership of the group's local eye space |
| `cut-exists` | Not available — the kernel's own `events.mts` deliberately does not implement cut detection; see the "Deferred events" note in [`events.mts`](../../../../../../../apps/weiqi-kernel/src/events.mts) | Requires exactly the life-and-death reading ("were these two groups actually connectable") the kernel refuses to fake |
| `territory-lead` | Only meaningfully late-game: the kernel's `computeTerritory` flood-fill scores an empty region only when *every* bordering stone is one color, so most of the board scores as neither side's until the position is nearly settled | Full-game score estimate from the engine's value head, meaningful from the opening |
| `urgent-area` | Not available — no kernel signal ranks regions by stakes; the closest proxy (a live atari) only flags what's *already* urgent, not what's about to become urgent | Requires the engine's policy/value output to rank candidate regions by swing |
| Ownership curves (the substrate for Section 3's ledger transitions and Section 4's crossing detection) | Not available | Yes — this is KataGo's native per-point, per-move output |
| `seki-standoff` | Not available at `heuristic` confidence — the kernel has no group/liberty-sharing analysis a scripted heuristic can trust | **Available earlier than the rest of this table, via Phase 2's shaped GnuGo, not only Phase 3's KataGo:** [Opponent Cast](./opponent-cast.md)'s own Implementation ladder notes GnuGo can already detect a seki-shaped local position once Phase 2's shaped-GnuGo integration ships for The Contester. This claim type should be sourced from that detector once it exists, ahead of the KataGo-gated claims above it, rather than waiting on Phase 3 for no real reason. |
| `ko-threat-size` | Not available — judging a threat's size against a ko's value needs a score estimate scripted heuristics don't compute | Requires KataGo's value head, the same dependency The Debtor's "Native" tier carries in [Opponent Cast](./opponent-cast.md#implementation-ladder)'s own table — gated together, not separately. |

The honest summary: Phase 1 ships the semantic-event layer and two heuristic claim types (`group-weak`, `base-missing`) at `heuristic` confidence only, gated no lower than `15k` since neither clears the bar for the gentler `25k` treatment without engine backing. Every ledger-and-post-mortem instrument in Sections 3–4 that narrates a *trajectory* — not just a single live-move fact — is a Phase 3 deliverable, exactly as the [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md#roadmap) already schedules it ("Phase 3 — Understand ... concept-language review synthesis").

## Roadmap obligations

This document commits later phases to specific, checkable work:

- **Phase 1** ships the `SemanticEvent` layer unchanged (already true) and may ship `group-weak`/`base-missing` at `heuristic` confidence, `15k`-and-stronger gate only, with no ledger trajectory and no post-mortem — a single live-move fact, nothing narrated.
- **Phase 0/3 content debt**: author `cut.md` in the glossary before any `cut-exists` detector is written, kernel or legibility-layer side — this document's Section 2 refusal condition binds both. Author `base.md` when capacity allows; `eye.md`/`false-eye.md` are an adequate anchor in the meantime, not a permanent substitute.
- **Phase 3** implements: the ownership-curve ingestion pipeline (KataGo → per-move, per-group ownership, joined to the kernel's own move sequence and semantic events); the group-status ledger's `weak`/`settling` states and the crossing-detection algorithm of Section 4 exactly as specced (fixed bands, ≤3 crossings, downward-only selection); the counterfactual-replay branch mechanics of Section 5, including the D1 `(parentGameId, forkMove)` schema and the bot-capability-tag mapping; and the `cut-exists`, `urgent-area`, and `ko-threat-size` claim types, contingent on the content and detector prerequisites above.
- **Phase 2** may implement `seki-standoff` ahead of the rest of Section 2's newer claim types, sourced from shaped GnuGo's seki detection once [Opponent Cast](./opponent-cast.md)'s Phase 2 GnuGo integration ships — see Section 7's note on why this one claim type doesn't have to wait for Phase 3.
- **Phase 3** also owns re-verifying this document's rank-tier-to-onboarding-ladder mapping (Section 6) against real player data once enough games exist to check it — the mapping here is a principled starting guess, not a calibrated one, and should be revised in place (this file updated, not forked) if play data disagrees.
- **Phase 3** additionally owns re-verifying Section 4's `SAFE`/`CONTESTED`/`LOST` ownership bands (`o ≥ 0.7`, `0.3 ≤ o < 0.7`, `o < 0.3`) against real KataGo output once enough graded game data exists — these cut points ship with no prior calibration or worked justification, unlike Section 6's rank-tier mapping, which at least carries the re-verification obligation above; this bullet closes that gap by giving the bands the same standing commitment. "Fixed, not learned" describes how the bands are implemented, not a claim that they're already correct — a fixed band that turns out to mis-locate the moments a post-mortem calls decisive is exactly the kind of error only real data can catch, and Section 4's crossing-detection algorithm depends on these specific numbers being right.
