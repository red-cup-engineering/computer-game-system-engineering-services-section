---
title: Mastery Model
description: "Audience: builders and reviewers of the Learn and Play faces, and anyone authoring lesson/tsumego content that will be read by it. The five-tier evidence ladder over the concept graph, its decay schedule, its player-state schema, and its UI stance."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
---


This document specifies how the platform knows what a player understands, and how it shows that back to them. It serves [Pillar 1](./design-pillars.md#pillar-1--do-first-name-after) (the map is built entirely from things the player *did*, never from a quiz) and [Pillar 4](./design-pillars.md#pillar-4--calm-by-construction) (the map is one of the three honest motivators — "visible mastery, the concept graph filling in with evidence" — and it must never punish). It also reaches into [Pillar 5](./design-pillars.md#pillar-5--a-place-in-the-lineage): the fifth and highest evidence tier is teaching, which is where this document and the lineage system meet.

The concept graph itself is the [weiqi topic index](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/glossary/topics/weiqi.md)'s twenty terms — this document does not define new concepts, it defines what counts as evidence that a player has moved through one.

## The graph the map is drawn over

The topic index groups the corpus's terms into three named clusters, and the mastery map is drawn as three regions matching them exactly — no fourth region, no per-term flat list. Two housekeeping decisions extend that three-cluster grouping to all twenty current terms (the plan's original ten have since grown to twenty; the topic page's own cluster prose has not caught up, so this table is the current source of truth until that page is fixed):

| Cluster | Terms |
|---|---|
| Tactical | liberty, atari, capture, ko, superko, suicide |
| Scoring | territory, komi, handicap, area-scoring, territory-scoring, pass, dame, dead-stones |
| Structural | connection, eye, life-and-death, false-eye, seki |

**Excluded: `hoshi`.** It names a board coordinate (a star point), not a piece of understanding a player builds evidence toward. A player does not "master" hoshi the way they master atari — there is no lived-experience threshold to cross. Terms that name vocabulary rather than a skill are not mastery-graph nodes. This is the refusal condition for adding a term to this graph: *if enacting the concept is not a meaningful, checkable event or decision, it does not belong on the map.*

## The five evidence tiers

| Tier | What it means | Can it regress? |
|---|---|---|
| 1. Encountered | The concept's phenomenon occurred in front of the player, whether or not they noticed or were told its name. | Never — the tier is a high-water mark (see Decay, below). |
| 2. Named | The glossary's own name for the concept was surfaced to the player *at a live moment* — while the concept was actually on the board, per Pillar 1 — not read cold off a reference page. | Never. |
| 3. Exercised | The player solved a designed problem whose answer is known in advance: a lesson exercise or a tsumego problem. | Never. |
| 4. Applied | A kernel semantic event carrying this concept's `termRef` fired during a session where the player was making real, undetermined decisions — not stepping through a worked example, not solving a tsumego — and the event mattered (defined per-concept below). | Never. |
| 5. Teaches | The player explained the concept to another player, in a session the lineage system records as teaching. | Never. |

A tier, once reached, is never taken away. What fades is **confidence** — a continuous number attached to the tier, covered in Decay. This is the load-bearing distinction that keeps this system inside Pillar 4: the map can go dim, but it can never go backward. A player who has not played in six months returns to a map that says "you knew this" in a quieter voice, never one that says "you have lost ground."

## Evidence sources, concept by concept

The kernel's semantic-event layer (`weiqi-kernel/src/events.mts`) emits `SemanticEvent`s with a `termRef` for exactly seven of the twenty terms today: `atari`, `capture`, `ko`, `connection`, `eye`, `life-and-death`, `pass`. The other thirteen have no per-move event, for reasons the kernel's own source already documents (liberty is atari/capture's shared currency, not an event of its own; territory/dame/superko are whole-board or legality facts, not move diffs; false-eye/seki need a life-and-death solver the kernel does not have; suicide/superko only ever reject a move, leaving nothing accepted to annotate). The mastery model does not invent evidence the kernel cannot honestly produce — it sources each concept from whatever is actually true of it:

| Concept | Encountered / Applied evidence source | Status |
|---|---|---|
| atari | `atari-given` / `atari-escaped` events | shipped |
| capture | `capture` events | shipped |
| ko | `ko-started` / `ko-resolved` events | shipped |
| connection | `connection` events | shipped |
| eye | `eye-formed` events | shipped |
| life-and-death | `group-killed` events (killing or losing a group) | shipped |
| pass | `pass` / `game-ended` events | shipped |
| liberty | inherits atari/capture's events — liberty has no event of its own because it is the quantity those two are defined in terms of | shipped (borrowed) |
| komi | game-setup fact: a completed game configured with nonzero komi, filtered by "mattered" below | shipped |
| handicap | game-setup fact: a completed game configured with handicap stones, filtered by "mattered" below | shipped |
| territory | end-of-game `scoreTerritory`/`computeTerritory` output for a completed game, filtered by "mattered" below | shipped |
| area-scoring | end-of-game score computed under an area ruleset (Chinese, New Zealand, Ing), filtered by "mattered" below | shipped |
| territory-scoring | end-of-game score computed under a territory ruleset (Japanese, AGA), filtered by "mattered" below | shipped |
| dame | `computeTerritory`'s neutral-point classification | computed, not yet surfaced as its own end-game callout — **Roadmap** |
| dead-stones | `removeDeadStones`'s marking-time fact | **Roadmap** — no dead-stone-marking UI exists yet |
| suicide, superko | the kernel only ever rejects these as illegal moves; there is no accepted move to attach an "applied" event to yet | **Roadmap** — needs the app to record "attempted an illegal retake and was told why," a legality-rejection as evidence, not a move event |
| false-eye, seki | need a life-and-death solver, per `events.mts`'s own documented deferral | **Roadmap** — no detector exists |

Exercised-tier evidence, for every concept, comes from two content sources that already exist and are already concept-tagged loosely by grouping, not yet by an explicit field:

- **`lessons.json` exercises** — each lesson step of kind `"exercise"` has a `prompt`/`answerText` pair but no `termRef` field today. Recording exercised-tier evidence therefore currently requires inferring the concept from the lesson's own subject (e.g. every exercise in `living-groups-and-eyes` counts toward `connection`, `eye`, and `life-and-death`) rather than reading it off a field. **Owed:** add a `termRefs: string[]` array to each exercise step, matching the kernel's own `termRef` convention exactly, so this stops being inferred.
- **`tsumego.json` problems** — each problem has a `set` field (`capture`, `life-and-death`, `endgame`) that maps to a cluster, not a specific term. **Owed:** add the same `termRefs: string[]` field per problem (e.g. `capture-escape-by-extension` should carry `["atari"]` alongside `["capture"]`, since escaping is what it actually drills).

Named-tier evidence is a hover-card open (`ui/hover-card.mjs`'s `attachHoverCards`) whose trigger is either (a) a semantic-event-driven callout on the board — the concept is live in front of the player right now — or (b) an inline `data-term` span inside a lesson step the player is currently reading, directly above or below the worked example that enacts it. A cold visit to a standalone glossary page, with no board or lesson context, is **not** named-tier evidence — Pillar 1 draws that line on purpose ("the glossary is not a reference the player visits"), and this model draws it in the same place.

### "Mattered": the applied-tier filter

Applied-tier evidence requires the producing session to be one where the player was making real, undetermined decisions. That excludes two of the app's four board modes outright and includes the other two conditionally:

1. **Excluded — `mode: "board"` lesson steps.** These replay a fixed sequence; the player enacts nothing. Contributes to named-tier at most.
2. **Excluded — tsumego problems.** A designed position with a known-correct answer is exercised-tier evidence, however good the solve.
3. **Included, at reduced weight (0.5) — the capture-go tutorial ladder's `capture-go`/`full-rules` stages.** The player is genuinely deciding against a bot (`randomBot`/`greedyCaptureBot`), but the bot is deliberately weak, so the stakes are real but low.
4. **Included, at full weight (1.0) — Phase 2+ Play-face games**, once they exist.

Within modes 3 and 4, one further per-event rule decides whether a specific `atari-escaped` event "mattered" enough to count, so that trivially wriggling a lone stone once and never again does not read as mastery of the concept:

- the escaping group has 2 or more stones at the moment of escape, **and**
- no `group-killed` event later in the same game shares any stone with that group.

Both conditions are checked once, at game end, against the event log already produced — no new kernel capability, just a filter the app applies over what the kernel already emits.

### The mattered filter, extended to game-setup and scoring evidence

The rule above only ever governed kernel-event-sourced concepts. It left a real gap: `komi`, `handicap`, `territory`, `area-scoring`, and `territory-scoring` were sourced from bare presence — "a completed game configured with nonzero komi," "a completed game configured with handicap stones" — which is a game-setup or ruleset fact, not anything the player did or decided, by this document's own word choice ("fact," not "event"). Almost every even ranked game carries nonzero komi by ruleset default, so a player who finishes one game under default settings, having never looked at or reasoned about komi, was reaching Applied tier — the model's second-highest evidence of understanding, the same tier reserved for a demonstrated, filtered skill like `atari-escaped` — on co-occurrence alone. That is a real defect: it lets a configuration default masquerade as evidence of understanding, exactly the thing this model's whole design otherwise refuses.

The fix extends the same discipline the atari-escaped filter already applies — a decidable, inspectable condition beyond bare presence — to these five concepts, using the one fact the kernel can already tell honestly: whether the game reached a **negotiated end** (two consecutive passes, the `game-ended` semantic event with a two-pass cause) rather than a resignation, disconnection, or abandonment.

- A resigned game never invokes scoring at all — komi, handicap, and the ruleset's scoring convention are configuration the game carried, never a computation the game actually ran. A player who wins entirely by capture and the opponent resigns has not encountered any of these five concepts as a live fact, whatever the setup screen said.
- A negotiated end is the one moment komi, handicap, and the scoring convention are actually computed against a real, contested count — the same moment [Opponent Cast](./opponent-cast.md)'s Straggler is built to teach ("the same 'extra' move costs nothing under one scoring convention and a full point under another"), which is a decision only visible at a negotiated end, never a resignation.

**Revised rule:** `komi`, `handicap`, `territory`, `area-scoring`, and `territory-scoring` reach Applied tier only from a completed game that ended by the two-pass mechanism, not by resignation, disconnection, or abandonment — and, for `komi` and `handicap` specifically, only when the setup screen that named the value was actually shown to the player (per [Ritual and Atmosphere](./ritual-and-atmosphere.md#the-nigiri)'s nigiri/handicap-confirmation screens), not silently defaulted with the ritual skipped. This is still a proxy, not a perfect outcome-determinacy test — a two-pass game can still end with komi mathematically irrelevant to the margin — and it is named as a proxy on purpose, the same way `atari-escaped`'s filter is a proxy revisited as evidence improves. It closes the specific loophole the panel raised: a default-settings game a player never engaged with can no longer alone produce Applied-tier evidence for any of these five.

### Teaches: the tier that isn't built yet

No teaching-game mode or mentor ladder exists today (both are Phase 4). This document commits their eventual evidence shape now so the Phase 4 implementer is not left to invent it: a `teach-event` is recorded when a mentor-ladder or teaching-game session ends with the taught player acknowledging the explanation, carrying `{ concept, teacherId, studentId, sessionRef, at }`. It is the one evidence type this document defines without a shipped producer — see Roadmap obligations.

## Decay: the map fades, it does not punish

Every evidence tier except *encountered* carries a **confidence** float in `[0.15, 1.0]`, computed from the freshest qualifying evidence entry:

```
confidence(now) = max(0.15, 1.0 × 0.5 ^ ((now − lastReinforcedAt) / halfLife(tier)))
```

| Tier | Half-life | Rationale |
|---|---|---|
| Encountered | none (always 1.0) | A bare exposure fact does not need reinforcing — it is a floor, not a claim. |
| Named | 30 days | Vocabulary is the most volatile layer; a name not used goes quiet fast. |
| Exercised | 60 days | A solved problem's specific pattern fades faster than the underlying skill. |
| Applied | 120 days | Demonstrated in real play is the strongest evidence short of teaching; it should take a real absence to dim. |
| Teaches | 240 days | Having taught it is the deepest form of having it; it barely needs upkeep. |

Three rules make this "gentle, never punishing," concretely:

1. **The floor is 0.15, never 0.** A region of the map that has been touched never goes fully dark. It is the visual difference between "this needs a refresh" and "you never learned this," and the map must never say the second thing about something the player actually did.
2. **Confidence dims the fill; it never changes the tier badge.** A concept that reached *applied* eight months ago and has not been touched since still reads as *applied* — dimly — never demoted back to *exercised*. Regressing the tier label is exactly the kind of quiet penalty Pillar 4 forbids.
3. **New evidence at the same tier resets the clock, not the history.** `evidence[]` is an append-only log (never truncated, never overwritten) so a player's own trajectory is always inspectable; `lastReinforcedAt` is the derived field the decay formula actually reads.

Confidence, not tier, is what feeds the recommendation feed described next — a dim region is a *candidate* for a gentle nudge, never a *deficiency* flagged to the player.

## Player mastery state — schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PlayerMasteryState",
  "type": "object",
  "required": ["playerId", "updatedAt", "concepts"],
  "properties": {
    "playerId": {
      "type": "string",
      "description": "Phase 1: reuses [onboarding-screenplay.md](./onboarding-screenplay.md#the-identity-ramp)'s own anonymous identifier verbatim — `localStorage[\"weiqi-learn:progress\"].sessionId` — not a second, independently-generated id. There is exactly one anonymous identity per browser in Phase 1, and this schema does not mint its own. Phase 2+: the account id, once accounts exist, per the same merge the identity ramp already specifies."
    },
    "updatedAt": { "type": "string", "format": "date-time" },
    "concepts": {
      "type": "object",
      "description": "Keyed by term slug, matching glossary.json's `name` and the kernel's `termRef` targets exactly.",
      "additionalProperties": {
        "type": "object",
        "required": ["cluster", "tier", "confidence", "firstAt", "lastReinforcedAt", "evidence"],
        "properties": {
          "cluster": { "enum": ["tactical", "scoring", "structural"] },
          "tier": {
            "enum": ["encountered", "named", "exercised", "applied", "teaches"],
            "description": "Highest tier ever reached. Monotonic — see Decay."
          },
          "confidence": {
            "type": "number", "minimum": 0.15, "maximum": 1.0,
            "description": "Decayed weight of the current tier's freshest evidence. Drives map fill opacity and recommendation priority only — never the tier label."
          },
          "firstAt": { "type": "string", "format": "date-time" },
          "lastReinforcedAt": { "type": "string", "format": "date-time" },
          "evidence": {
            "type": "array",
            "description": "Append-only. Never truncated or overwritten.",
            "items": {
              "type": "object",
              "required": ["tier", "source", "context", "at", "weight"],
              "properties": {
                "tier": { "enum": ["encountered", "named", "exercised", "applied", "teaches"] },
                "source": {
                  "enum": [
                    "kernel-event", "hover-card", "lesson-exercise",
                    "tsumego-problem", "game-setup", "scoring-result",
                    "teach-event"
                  ]
                },
                "ref": { "type": "string", "description": "e.g. an event type, a tsumego problem id, a lesson step index, a sessionRef." },
                "context": { "enum": ["worked-example", "tutorial-freeplay", "tsumego", "live", "teaching"] },
                "at": { "type": "string", "format": "date-time" },
                "weight": { "type": "number", "minimum": 0, "maximum": 1 }
              }
            }
          }
        }
      }
    }
  }
}
```

## Worked example: `atari`, all five tiers

A new learner, Row, starts the capture-go tutorial. Timestamps compress a real multi-week arc into one legible sequence.

**1 — Encountered (2026-06-01, session start).** In the very first tutorial stage (`mode: "free-placement"`, no bot), Row places a stone that White then surrounds — the kernel fires `atari-given` with `termRef` pointing at `atari.md`. Row has not been told the word.

**2 — Named (2026-06-01, four minutes later).** The next stage's guide text carries `<span data-term="atari">`, live above a worked-example board showing the exact shape Row just triggered. Row hovers it. `hover-card` source, `worked-example` context — because the term was surfaced at the moment the phenomenon was still on the board in front of them, not read cold.

**3 — Exercised (2026-06-03).** Row plays the `capture-atari` tsumego problem (`set: "capture"`) and finds `E4`. `tsumego-problem` source, `tsumego` context.

**4 — Applied (2026-07-14).** Deep in the `full-rules` tutorial stage against `greedyCaptureBot`, Row's three-stone group is put in atari and Row extends it to five liberties. The kernel fires `atari-escaped`. The filter checks: group size at escape was 3 (≥ 2, passes); no `group-killed` event later in that game shares any of those five stones (passes). It counts, at weight 0.5 (`tutorial-freeplay` context — the bot is still deliberately weak).

**5 — Teaches (2026-11-02).** Row, now a mentor-ladder volunteer (Phase 4), plays a teaching game with a brand-new player and explains why their group was in atari and how to read the way out. The session ends with the taught player's acknowledgment. `teach-event` fires, `teaching` context, weight 1.0 — and is separately recorded in the lineage tree as an act of teaching, per Pillar 5.

The resulting record, as of 2026-11-15 (thirteen days after the teaching event, no reinforcement since):

```json
{
  "playerId": "local-row-3f9a",
  "updatedAt": "2026-11-15T00:00:00Z",
  "concepts": {
    "atari": {
      "cluster": "tactical",
      "tier": "teaches",
      "confidence": 0.976,
      "firstAt": "2026-06-01T09:00:00Z",
      "lastReinforcedAt": "2026-11-02T18:40:00Z",
      "evidence": [
        { "tier": "encountered", "source": "kernel-event", "ref": "atari-given", "context": "worked-example", "at": "2026-06-01T09:00:00Z", "weight": 1.0 },
        { "tier": "named", "source": "hover-card", "ref": "atari", "context": "worked-example", "at": "2026-06-01T09:04:00Z", "weight": 1.0 },
        { "tier": "exercised", "source": "tsumego-problem", "ref": "capture-atari", "context": "tsumego", "at": "2026-06-03T20:10:00Z", "weight": 1.0 },
        { "tier": "applied", "source": "kernel-event", "ref": "atari-escaped", "context": "tutorial-freeplay", "at": "2026-07-14T21:02:00Z", "weight": 0.5 },
        { "tier": "teaches", "source": "teach-event", "ref": "mentor-session-2281", "context": "teaching", "at": "2026-11-02T18:40:00Z", "weight": 1.0 }
      ]
    }
  }
}
```

`confidence = max(0.15, 1.0 × 0.5^(13/240)) ≈ 0.976` — thirteen days against a 240-day half-life barely moves it. Left alone for a full year, it would settle around `1.0 × 0.5^(365/240) ≈ 0.373`, still displayed with the *teaches* badge, still visibly Row's — just quieter.

## UI stance

**A map that fills in, never a percent bar, never a level number.** The three clusters render as three regions (tactical, scoring, structural), each tiled into one cell per concept it contains. A cell's hue/pattern encodes tier (five fixed steps, not a gradient a player has to interpret as a score); its opacity encodes confidence. There is no numeral anywhere on this screen — not "73%," not "level 4." A player reads the map the way they read a hand-drawn territory map after a game: shapes and fullness, not a scoreboard.

**What this refuses, and what it doesn't.** Removing the numeral removes the surface form of a progress bar, not necessarily its behavioral pull: a continuously-brightening cell across a fixed, enumerable 20-cell grid can still read as "how filled-in is my map," the same completionist draw as "14/20," just rendered as a gradient instead of a digit. This document does not claim the map is immune to that pull — only that the specific pattern Pillar 4 forbids by name (a numeric percent, a level number, a countable streak) is absent from this screen, and that the tier/confidence encoding was chosen because it degrades gracefully (dims, never a raw count that can be compared release-over-release the way a percentage invites) rather than because gradients are inherently safer than digits. The refusal condition immediately below is what actually closes the loophole: nothing downstream of this data may re-derive the aggregate this screen deliberately declines to show.

**Refusal condition: no derived aggregate, anywhere.** Mirroring [Lineage and Clubs](./lineage-and-clubs.md#14-where-a-teachers-lineage-is-visible--the-exact-list)'s explicit ban on a numeric "N students taught" badge, this data may never be reduced to a single number and rendered anywhere in the product — not "14/20 concepts at applied tier," not a percentage, not a completion badge, on a profile page, a club roster, or anywhere else, present or future. The concept graph is drawn once, on its own page, exactly as this section specifies; a second surface that summarizes it as a count is a progress bar wearing this section's own refusal as camouflage, and is refused outright on sight, the same way a mastery-tier lock is refused below.

**Recommendations, not locks.** The map drives a dismissible suggestion feed ("this dimmed a little — a `life-and-death` tsumego is due") that a player can act on or ignore with zero consequence either way. It never gates anything.

**Refusal condition, stated plainly:** nothing in this application may be hard-locked behind a mastery tier or confidence threshold — not a board size, not a tsumego set, not a lesson, not a bot opponent, not a room. Any feature proposal shaped like "require tier X in concept Y to unlock Z" is refused outright on sight, regardless of the pedagogical argument for it, on the same grounds Pillar 4 already gives: a lock manufactures urgency through loss of access, which is guilt wearing a different mask. Difficulty and pacing are handled entirely by [Pillar 3](./design-pillars.md#pillar-3--opponents-are-teachers-wearing-masks)'s opponent design and by the flow-channel matchmaking described in the platform plan — never by withholding content pending a mastery check.

## Decision tests

- Does this feature's mastery evidence trace to a source in the concept-by-concept table above, or does it invent an event the kernel cannot honestly produce?
- Could a tier ever be read from this data as having gone *down*? If yes, the implementation is wrong — fix it before shipping, don't ship it and call it a known limitation.
- Does anything in the app check a mastery tier or confidence value before allowing an action? If yes, it violates the refusal condition above and must be reworked as a recommendation.
- Is "named" evidence ever recorded from a cold glossary-page visit? If yes, it violates Pillar 1's own line and must be reclassified as, at most, encountered.

## Roadmap obligations

This document commits later phases to specific, checkable work:

- **Phase 1 (Learn face, current).** Mastery state is computed and stored **client-side only**, under its own key, `localStorage["weiqi-learn:mastery"]` — named explicitly here, matching every other Phase-1 storage-bearing design document's own practice of naming its key (onboarding-screenplay.md's `weiqi-learn:progress`/`weiqi-learn:displayName`, ritual-and-atmosphere.md's `RitualPreference`), rather than leaving it implicit. This matches the [Learn constitution](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-learn-constitution.md)'s structural refusal to persist any state past the browser session in a server-reachable location. Tiers *encountered* through *applied* (via `tutorial-freeplay` context only — there is no live play yet) are reachable now; *teaches* is not.
- **Content debt owed before evidence sourcing stops being inferred:** add a `termRefs: string[]` field to every `lessons.json` exercise step and every `tsumego.json` problem, matching the kernel's own `termRef` convention. Until this lands, exercised-tier attribution is inferred from a lesson's or tsumego set's overall subject rather than read off a field, which is a known, temporary looseness in an otherwise evidence-grounded system.
- **Phase 2 (Play face).** `applied`-tier evidence gains its full-weight (1.0) `live` context once real games exist; mastery state gains a D1-backed record (the plan's own "learning-progress (concept-graph state)" table) so a returning player's map survives a new device — this is the point at which `playerId` stops being a purely local value.
- **Phase 3 (Understand).** `suicide` and `superko` gain a genuine applied-tier source once the app records legality-rejection attempts as evidence, per the table above. KataGo review's concept-language synthesis (named in the plan) is a natural second producer of `applied`-tier evidence once it exists — a review that says "this move left the corner group with one eye" is itself evidence the player encountered `eye` in a live game, whether or not they acted on it correctly.
- **Phase 4 (Belong).** The `teach-event` producer (mentor ladder / teaching-game mode) ships, discharging the one evidence type this document defines without a shipped source. `false-eye` and `seki` remain unreachable at the applied tier until a life-and-death solver exists — no phase currently commits to building one; that gap is inherited from the kernel's own documented deferral, not invented here, and stays open until a future kernel design document closes it.
