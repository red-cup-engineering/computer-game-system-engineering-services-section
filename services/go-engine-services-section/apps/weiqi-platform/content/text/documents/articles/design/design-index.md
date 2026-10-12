---
title: Design Index
description: "Audience: anyone building, reviewing, or onboarding into the weiqi platform's design corpus. The map: what each document commits to, the schemas they share and who owns them, every obligation they've placed on Phase 2-4, and the questions still waiting on the board."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
---


## What this corpus is

This directory is the weiqi platform's design constitution and its case law. [Design Pillars](./design-pillars.md) states five commitments — do first name after, feedback while the decision is warm, opponents as teachers wearing masks, calm by construction, a place in the lineage — each with decision tests a feature either passes or doesn't ship. The ten documents indexed below are that constitution worked out against real schemas, real UI copy, and real phase boundaries: each cites the pillars it serves, each names the tension it resolves when two pillars pull in different directions, and each closes with a Roadmap obligations section that binds Phase 2, 3, or 4 to something specific and checkable rather than a vibe. Read together, they are what a builder opens instead of asking "would this be okay?" — the answer, and the test that produced it, are usually already written down. This document is the map over that case law: what each document commits to, which document owns which shared schema, everything the corpus has newly bound the coming phases to, and what's still waiting on a human decision rather than a design one.

## Document map

| Document | Pillars served | One-sentence commitment | Phase obligations (see Roadmap ledger for detail) |
|---|---|---|---|
| [Calm Technology](./calm-technology.md) | 4 | Names eight engagement anti-patterns by real mechanism and refuses each, then specifies the rating-visibility, handicap-broadcast, and loss-streak-protection system that holds Pillar 4's promise under actual matchmaking pressure. | Ph2, Ph3, Ph4 |
| [Onboarding Screenplay](./onboarding-screenplay.md) | 1, 4 | Scripts the shipped five-stage capture-go ladder beat-by-beat with exact copy, two decidable metrics (ten-second rule, TTFC), and an additive three-rung identity ramp — while auditing and correcting three live Pillar 1 violations in shipped copy. | Ph1 (now), Ph2, Ph3 |
| [Opponent Cast](./opponent-cast.md) | 3 (touches 1, 2, 4) | Specifies eight fixed, named opponents — never a slider — each with one precisely stated, consistently-firing flaw whose defeat teaches a findable lesson, plus an implementation ladder and a refusal on any completion badge. | Ph2, Ph3 |
| [Legibility Layer](./legibility-layer.md) | 2 | Defines the Assertion as Pillar 2's atomic unit and specs the three canonical instruments over it — group-status ledger, cause-chain post-mortem, counterfactual replay — against an honest Phase-1-vs-Phase-3 computability boundary. | Ph1, Ph2, Ph3 (owns Ph0/3 content debt) |
| [Lineage and Clubs](./lineage-and-clubs.md) | 5 (bound by 4) | Specifies teaching lineage as a student-confirmed, non-currency graph, teaching-game mode as structurally distinct from ranked play, and clubs as the default social surface — all six persistent entities D1-backed from first ship. | Ph2, Ph3, Ph4 |
| [Mastery Model](./mastery-model.md) | 1, 4 (reaches 5) | Specifies the five-tier evidence ladder over the twenty-term concept graph, sourced only from evidence the kernel can honestly produce, decaying in confidence but never regressing in tier and never gating content. | Ph1 (now), Ph2, Ph3, Ph4 |
| ["Your Games Become Your Textbook"](./own-games-textbook.md) | 2, 4 | Specifies the four-stage pipeline that turns a player's own losses into scheduled, glossary-tagged puzzles via SM-2, keeping only the algorithm's pedagogical spacing while refusing every guilt mechanic it's usually paired with. | Ph1 (now), Ph2, Ph3, Ph4 |
| [Playtest Protocol](./playtest-protocol.md) | 1-5 (empirical arm) | Specifies seven metrics, a moderated N=5 think-aloud method for true beginners, honest N-guidance for a solo operator, and a release ritual requiring one falsifiable pillar hypothesis per release. | Ph1 (now), Ph2, Ph3, Ph4 |
| [Ritual and Atmosphere](./ritual-and-atmosphere.md) | 5 (bound by 4) | Specifies the nigiri, the bow, the quiet room, and sound/materiality — all gated through one `RitualPreference` consent schema, asked once and honored indefinitely. | Ph2, Ph3, Ph4 |
| [Canon and Broadcast](./canon-and-broadcast.md) | 5 (Part 1), 2 and 1 (Part 2) | Specifies the hand-authored documentary format (buildable now, reusing the lesson and tsumego shapes) and rank-gated broadcast mode (blocked on the Phase 3 legibility layer), with an explicit phase boundary between the two. | Ph0, Ph1, Ph3, Ph4 |
| [Integrity and Sanctioned Assistance](./integrity-and-assist.md) | 4, 5 | Reframes engine cheating as a stakes problem rather than only a detection problem, sanctions three explicit assist modes, and specifies a graduated, human-reviewed response gated on a named second-reviewer sourcing mechanism. | Ph2, Ph3+ (permanent refusals) |
| [API Product](./api-product.md) | 1 (outward), constrained by 4 | Specifies a weiqi analysis API — commodity/differentiated/premium/licensing tiers over SGF, a KataGo-shaped JSON form, and GTP-compatible coordinates — as a third constituted face pending board authorization. | Ph2 (conditional), Ph3, immediate (owes review) |

## Cross-document contracts

Three schemas are load-bearing across more than one document. Each has exactly one owner; every other document that touches it references the owner rather than redefining it, and two near-collisions were caught and corrected rather than left to drift.

### The Assertion (owned by Legibility Layer)

```typescript
interface Assertion {
  subject: Subject;          // group | region | move
  claim: ClaimType;          // group-weak | group-settled | base-missing | cut-exists |
                              // territory-lead | urgent-area | seki-standoff | ko-threat-size
  confidence: "certain" | "likely" | "heuristic";
  termRefs: string[];
  evidence: Record<string, number | number[] | string | boolean>;
  rankGate: "25k" | "15k" | "5k";
}
```

[Legibility Layer](./legibility-layer.md#1-the-assertion-atomic-unit) owns this shape and the `ClaimType` enum. Two entries — `seki-standoff` and `ko-threat-size` — exist because [Opponent Cast](./opponent-cast.md#roadmap-obligations) named a gap against an earlier version of the enum (The Contester's and The Debtor's post-mortems needed claim types the enum didn't have); Legibility Layer closed it. A third, `cut-exists`, is named but withheld by a standing refusal condition until `cut.md` exists in the glossary *and* the kernel implements a real cut detector — which leaves The Loner's post-mortem (Opponent Cast) using `group-weak` as an honest approximation in the meantime. [API Product](./api-product.md#endpoint-sketch-v1)'s `/v1/analyze` endpoint serves this schema, versioned with it. `Assertion` is **not** the same shape as own-games-textbook.md's `ConceptTag`, below — an earlier draft of that document called its own shape `Assertion` too, and the collision has been corrected by rename, with a translation layer named as owed work rather than pretended solved.

### The mined-puzzle tag (`ConceptTag`, owned by "Your Games Become Your Textbook")

```typescript
interface ConceptTag {
  term: string;
  termRef: string;
  claim: string;              // free-text, puzzle-card prose
  hedge: "confirmed" | "probable";
}
```

[own-games-textbook.md](./own-games-textbook.md#stage-2--concept-tagging) owns this shape — a natural-language tag for a mined tsumego card, deliberately unlike the enum-typed `Assertion` above. The puzzle object itself (`{size, toPlay, stones, goal, accept, lines, failNote}`) belongs to no design document at all: it's owned by the shipped app (`apps/weiqi-learn`'s `tsumego.json`), and two design documents extend it without redefining it — own-games-textbook.md adds `refutation` and `mined` fields for mined puzzles; [Canon and Broadcast](./canon-and-broadcast.md#format-spec)'s you-try branches reuse the shape verbatim, unmodified, so the existing tsumego checker handles them with zero new code. [API Product](./api-product.md#endpoint-sketch-v1)'s `/v1/tsumego/verify` endpoint accepts this same shape externally.

### Player mastery state (owned by Mastery Model)

```json
{
  "playerId": "string",
  "updatedAt": "date-time",
  "concepts": {
    "<term-slug>": {
      "cluster": "tactical | scoring | structural",
      "tier": "encountered | named | exercised | applied | teaches",
      "confidence": 0.15,
      "firstAt": "date-time", "lastReinforcedAt": "date-time",
      "evidence": [ { "tier", "source", "context", "at", "weight" } ]
    }
  }
}
```

[Mastery Model](./mastery-model.md#player-mastery-state--schema) owns this shape and the tier/decay rules over it. own-games-textbook.md's scheduler emits one evidence sample per tagged `ConceptTag.termRef` into "whatever evidence stream mastery-model.md consumes" — a documented dependency on this schema's per-`termRef` intake interface that its own Roadmap obligations flags for a Phase 3 cross-check, not yet verified against the shape as built. Calm Technology's Part 3 retention prediction and Playtest Protocol's mechanism-specific return metrics both key their "mastery-map view" entry point to this schema's eventual player-facing page (Mastery Model's own Ph3 UI-stance obligation).

### Two smaller, still-load-bearing contracts

- **`Game.assist_mode` and `Game.rated`** — two independent, three/two-valued fields on the same record, owned respectively by [Integrity and Sanctioned Assistance](./integrity-and-assist.md#part-2--sanctioned-assist-modes) and [Calm Technology](./calm-technology.md#learning-games-that-never-count). An earlier draft of Calm Technology conflated the two into one field; both documents now state, identically, that they are separate and why (assistance-was-consulted vs. counts-toward-rating are related but distinct facts).
- **`RitualPreference`** — owned by [Ritual and Atmosphere](./ritual-and-atmosphere.md#why-ritual-precisely-not-decoratively). own-games-textbook.md's `mistake-mining: "on"|"off"` toggle is explicitly placed "alongside `RitualPreference`... in the same local settings object" rather than inventing a second preference object, and Mastery Model's revised "mattered" filter for komi/handicap evidence reads Ritual and Atmosphere's nigiri/handicap-confirmation screens to know whether a value was actually shown, not silently defaulted.

## Roadmap implications ledger

Everything below is a commitment a design document has already made on a future phase's behalf — not a suggestion, a bound obligation a phase workflow must consume or explicitly renegotiate. Organized by phase; each line names its owning document.

### Phase 2 (Play)

- [ ] `rating_visibility` defaults `"private"`, `handicap_broadcast` defaults `"automatic"`, `rated: boolean` on every game record — from the first commit that introduces ratings, not retrofitted — *Calm Technology*
- [ ] Loss-streak thresholds (3/5) and `matchmaking_assist` toggle live in matchmaker logic before ranked queueing is exposed to any user; the 3-loss disclosure line ships in the same commit as the threshold logic — *Calm Technology*
- [ ] `Game.assist_mode` three-value field, persistent `engine-transparent` header badge, and architectural separation of the analysis sandbox from any live-game Durable Object — launch requirements, not follow-ups — *Integrity and Sanctioned Assistance*
- [ ] Kernel-side: extend `SgfGameRecord`/`gameRecordToSgf()` with an optional comment/`GC` field before the `GC[assist-mode:...]` SGF tag can ship — owed to the kernel, not the app — *Integrity and Sanctioned Assistance*
- [ ] `weiqi-api` constitution plus commodity/differentiated API tiers, contingent on board authorization; metering schema lands in D1's initial migration set — *API Product*
- [ ] `seki-standoff` may ship ahead of the rest of Section 2's newer claims, sourced from shaped GnuGo's seki detection — *Legibility Layer*
- [ ] Shaped-GnuGo integration realizing The Loner, The Believer, The Contester natively; matchmaking presents eight named opponents, never a numeric difficulty control — *Opponent Cast*
- [ ] Mistake-mining candidate detection extends to the player's stored game archive; scheduler state gains an opt-in-only server backup — *"Your Games Become Your Textbook"*
- [ ] Live spectating of the platform's own Play games becomes possible (reuses the DO WebSocket hub) — *Canon and Broadcast*
- [ ] `Report`/moderation flow and beginner-protected room flag ship as launch-day ranked-play infrastructure; the spectator channel is architecturally separated from the player channel from the start, before teaching-game mode exists to use it — *Lineage and Clubs*
- [ ] `applied`-tier mastery evidence gains full weight (1.0) `live` context; mastery state gains a D1-backed record — *Mastery Model*
- [ ] Identity ramp's account rung requires D1 `users` implementing the exact additive merge rule (`max()` on ladderIndex, set-union on evidence, localStorage never cleared) — an overwrite implementation is a regression against this spec, not a new design choice; aggregate-only anonymous TTFC pipe becomes buildable — *Onboarding Screenplay*
- [ ] Opt-in aggregate-sync path for D7 and mechanism-specific return metrics; cast-rematch→return and own-game-review→analysis-board rows collected; DO connection logging scoped to operational need from its first design sketch, never joined against play-history — *Playtest Protocol*
- [ ] Commit-reveal nigiri runs server-authoritative inside the game-room Durable Object; `RitualPreference` migrates to D1 with a stated per-field skip-wins merge rule — *Ritual and Atmosphere*

### Phase 3 (Understand)

- [ ] `/v1/analyze` endpoint ships; assertion-schema freeze becomes an explicit API versioning event — *API Product*
- [ ] Legibility layer's assertion API must serve two consumers from one implementation — a learner's own post-mortem and broadcast mode's spectator assertions — not a second engine integration — *Canon and Broadcast* / *Legibility Layer*
- [ ] Open rights question: relaying an external tournament's live feed needs that tournament's permission — not resolved by building anything — *Canon and Broadcast*
- [ ] Detection signals need the KataGo review service; Stage 1 may fire with the operator alone once signals exist; Stage 2/3 are gated on a named, vetted second reviewer actually being sourced — not on a phase number — *Integrity and Sanctioned Assistance*
- [ ] Ownership-curve ingestion; ledger's `weak`/`settling` states and the crossing-detection algorithm exactly as specced; counterfactual-replay branch mechanics incl. the D1 `(parentGameId, forkMove)` schema; `cut-exists`/`urgent-area`/`ko-threat-size` contingent on prerequisites; re-verify the rank-tier mapping and the `SAFE`/`CONTESTED`/`LOST` bands against real data — *Legibility Layer*
- [ ] Author `cut.md` in the glossary before any `cut-exists` detector is written, kernel- or app-side — *Legibility Layer*, gates *Opponent Cast*'s Loner post-mortem too
- [ ] Concept graph ships as a first-class, player-facing mastery-map page, not only backing data — *Calm Technology* / *Mastery Model*
- [ ] `suicide`/`superko` gain genuine applied-tier evidence via recorded legality-rejection attempts; KataGo review becomes a second applied-tier evidence producer — *Mastery Model*
- [ ] KataGo HumanSL profile + policy constraints for The Debtor — blocked on an unresolved architecture gap (a second, low-latency serving path distinct from the batch job-queue the plan specifies) — *Opponent Cast*
- [ ] Engine-delta detector, engine-verified uniqueness threshold, `probable→confirmed` hedge upgrade; check against Mastery Model's actual per-`termRef` intake interface once built; owns the `ConceptTag`/`Assertion` translation layer, if a consumer ever needs both rendered together — *"Your Games Become Your Textbook"*
- [ ] Next-game articulation prompt and recurrence check wired into the post-mortem screen; rank-anxiety pulse's consent banner, 30-day rarity gate, and threshold-crosser tagging ship no more than one release behind ranked play's launch; owns the mastery-map-view→return and canon-entry→lapsed-return metric rows — *Playtest Protocol*
- [ ] Automatic handicap/komi assignment calls the same placement/komi tables the ritual's handicap-confirmation screen uses — one source of truth, never a second table that can drift — *Ritual and Atmosphere*
- [ ] Rank data backs the mentor-vetting checklist (§5.3); teaching-game post-mortems depend on the legibility layer existing — *Lineage and Clubs*

### Phase 4 (Belong)

- [ ] Teaching-credit lineage tracking (`confirmed` edge, teacher/student tree) exists before any leaderboard or tournament feature, so standing precedes ranking — *Calm Technology*
- [ ] Watch-party room mechanic ships as a named feature — explicitly *without* a bundled lineage-edge grant; that mechanism belongs to Lineage and Clubs, not implied here as solved — *Canon and Broadcast*
- [ ] `teach-event` producer (mentor ladder / teaching-game mode) ships, discharging Mastery Model's one evidence type with no shipped source; `false-eye`/`seki` remain unreachable at applied tier pending an unscheduled life-and-death solver — *Mastery Model*
- [ ] Explicit puzzle-share-to-mentor surface for mined puzzles — *"Your Games Become Your Textbook"*
- [ ] Full lineage graph and edge lifecycle, teaching-game mode UI, clubs in full (charter, study nights, simuls, internal ladders), code-of-conduct corpus content, D1 storage for `lineage_edges`/`clubs`/`study_night_positions`/`simul_events`/`club_ladders` (`reports` already shipped Phase 2) — *Lineage and Clubs*
- [ ] Owed, unresolved: a group-teaching edge-creation pathway (new trigger, evidence shape, room-not-pair confirmation flow) — named, not yet committed to a mechanism — *Lineage and Clubs*
- [ ] Teaching-edge→tenure row of mechanism-specific return metrics — *Playtest Protocol*
- [ ] Any teaching-game or mentor-ladder ritual variant passes through `RitualPreference`, never a parallel skip mechanism — *Ritual and Atmosphere*

## Open questions for the board

### Panel findings the corpus already addressed

Each document in this directory carries its own audit trail — passages marked "an earlier draft..." or "corrected against this document's own audit" — where a design-panel-style review caught a real defect and the document fixed itself rather than waiting on the board. The load-bearing ones:

- **`assist_mode`/`rated` field conflation** — Calm Technology's schema note originally claimed these were one field; corrected to two independent fields, cross-referenced in both documents.
- **`rating_visibility` vs. automatic handicap signal leakage** — hiding a rating number doesn't hide the rank gap automatic handicap broadcasts in stones on the board; closed with the `handicap_broadcast` toggle and honest disclosure of its tradeoff.
- **Loss-streak protection shipped silent in an earlier draft** — the exact failure shape the sandbagging literature warns about, wearing a kinder face; closed by disclosing the 3-loss threshold and making the whole mechanism opt-out via `matchmaking_assist`.
- **Second-reviewer sourcing gap in the cheating-detection ladder** — an earlier draft specified Stage 2/3 human review without naming where the second reviewer comes from; closed by gating Stage 2/3 on an actually-sourced, vetted reviewer rather than a phase number.
- **The Contester's and The Debtor's post-mortems had no matching claim type** — Opponent Cast named the gap; Legibility Layer added `seki-standoff` and `ko-threat-size` to close it. (`cut-exists` for The Loner remains open — see below.)
- **Mastery Model's "mattered" filter had a real loophole** — default-settings komi/handicap/scoring evidence was reaching Applied tier on bare co-occurrence, no player engagement required; closed by requiring a negotiated (two-pass) end and a shown, not silently defaulted, setup screen.
- **Three confirmed Pillar 1 violations in shipped onboarding copy** — liberties explained abstractly before the first stone, "territory" glossary-linked while being declared absent, opponents never actually named in Beats 6-7 despite Opponent Cast's advance-disclosure promise; all three corrected in the spec, sync into shipped code tracked as a Phase 1 obligation (see ledger above).
- **Opponent Cast's own Doctrine section contradicted its Pillar 3/4 resolution section** on when a flaw becomes legible — reconciled by distinguishing playful mask language (pre-disclosed) from precise technical description (earned through lived play).
- **`ConceptTag` vs. `Assertion` naming collision** — an earlier draft of own-games-textbook.md called its mined-puzzle tag shape `Assertion`, the same name Legibility Layer uses for a structurally different interface; renamed, with the translation layer named as owed rather than solved.
- **Canon and Broadcast's watch-party section overstepped** into granting lineage-edge credit for narrating, without the schema authority to do so; corrected to state plainly that Lineage and Clubs owns that graph and this mechanism is owed, unbuilt work.
- **Lineage and Clubs' "nothing to farm" claim overstated its own case** against Calm Technology's own retention prediction that lineage-edge accumulation is a measured motivator; narrowed to a defensible claim about closed mechanical loopholes, not zero incentive weight.
- **Storage layer left unnamed for six persistent entities** in an earlier draft of Lineage and Clubs; closed by naming all six as D1-backed from first ship, with no local-only phase.
- **`RitualPreference` had no stated merge rule** across multiple anonymous devices; closed with an explicit, argued skip-wins rule.

### Still open

- **Pillar 4's first decision test has no auditable check.** "Would we still build this if we could not measure engagement?" is unlike the other pillars' tests — no third party can independently verify a sincere "yes." Calm Technology names this as a real gap in the pillars document itself, not something a subordinate document can fix; it compensates with falsifiable retention predictions but calls that a workaround, not a repair.
- **No pillar's decision tests check for cross-feature signal leakage generally.** The `rating_visibility`/`handicap_broadcast` case (addressed above) is proof the gap is real, not hypothetical, and nothing in the constitution would catch the next instance automatically.
- **Pillar 3's illustrative prose ("clings to dead stones") doesn't match the shipped roster.** The Believer's flaw is a mid-game false-eye misjudgment, not a group already provably dead and undefended. Opponent Cast recommends tightening design-pillars.md's language rather than inventing a ninth opponent, but that edit belongs to the pillars document and is recorded here as a request, not made unilaterally.
- **Completion/collection-tracking is refused three times, never once.** Mastery Model, Opponent Cast, and Canon and Broadcast each independently added a refusal against showing a completion badge over their own enumerable content set, because neither Pillar 4's nor Pillar 5's forbids list names the pattern at the constitutional level. Naming it once, at the pillar level, would be cheaper than a fourth subordinate document reinventing it.
- **External tournament broadcast relay rights are unresolved**, and no phase of building closes them — a licensing question to raise before Phase 3+ broadcast work is scheduled, per Canon and Broadcast.
- **`cut-exists` remains blocked** on both an unauthored glossary term (`cut.md`) and an unbuilt kernel detector; no phase currently commits to building the detector, and The Loner's post-mortem ships on an approximation until it does.
- **The Debtor's live-serving architecture gap is unresolved.** The platform plan's only specified KataGo architecture is an asynchronous batch job queue; a live opponent needs a second, persistent, low-latency serving mode on the same box Phase 3's other engine work already competes for. No document schedules this.
- **API Product owes itself an adversarial review pass** — it was authored after the design panel convened and has not yet been checked against the corpus's own standard; it also carries its own standing request, to authorize constituting `weiqi-api` as a third face alongside Learn and Play.
- **Go-specific broadcast-delay policy was not found in sourcing** for Canon and Broadcast's Part 2; the document borrows chess's transmission-delay convention as the closest analog and flags that it needs confirming against any actual relay's own terms before shipping.

## Relation to the platform plan

The [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md) sets the roadmap this corpus works inside: five phases (0 through 4), the Cloudflare-first architecture, the three product faces (Play, Learn, Read), and the board decisions the plan itself requests. Design Pillars turns the plan's product thesis — "the game explains itself" — into five enforceable commitments, and the ten documents this index maps are those commitments worked out against the plan's own phase boundaries: every Roadmap obligations section in this directory cites a specific phase the plan already defined, and none invents a new one. Where the corpus goes further than the plan is in specificity the plan couldn't have had at the time it was written — exact schemas (`Assertion`, `PlayerMasteryState`, `RitualPreference`), exact default values (`rating_visibility: "private"`), exact refusal conditions (no cast-completion badge, no rating-change ceremony), and, in one case, a genuine addition to the plan's own architecture: [API Product](./api-product.md) proposes a third constituted face — a keyed, networked, metered API service — that the plan's original three-faces framing didn't include, and it is explicit that this is a request for board authorization, not a decision the design corpus can make on the plan's behalf. The relationship runs both directions: the plan tells this corpus when things ship; this corpus tells the plan's implementers exactly what "it" is when the phase arrives.
