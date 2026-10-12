---
title: Lineage and Clubs
description: "Audience: everyone who designs, builds, or reviews the platform's social systems. Specifies Pillar 5's social architecture — the teaching-lineage graph, teaching-game mode, clubs as the default social surface, kibitz and undo norms, and moderation as care — constrained at every point by Pillar 4's calm oath."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
references:
  senseislibrary_teachinggame:
    title: "Teaching Game"
    authors: ["Sensei's Library"]
  senseislibrary_takeback:
    title: "Taking Back a Move / Discussion"
    authors: ["Sensei's Library"]
  wikipedia_simul:
    title: "Simultaneous exhibition"
    authors: ["Wikipedia contributors"]
  wikipedia_kibitzer:
    title: "Kibitzer"
    authors: ["Wikipedia contributors"]
cites:
  - senseislibrary_teachinggame
  - senseislibrary_takeback
  - wikipedia_simul
  - wikipedia_kibitzer
---


This document specifies [Pillar 5](./design-pillars.md#pillar-5--a-place-in-the-lineage)'s social architecture: teaching lineage as a first-class graph, teaching-game mode, clubs, kibitz norms, and moderation. Every mechanism below is also checked against [Pillar 4](./design-pillars.md#pillar-4--calm-by-construction), which binds it from the first sketch, per the plan's own roadmap note. The two pillars pull in different directions on the same material — Pillar 5 wants standing to be visible and social; Pillar 4 forbids anything that manufactures urgency, competition-for-its-own-sake, or guilt — and the resolution used throughout is one rule, applied consistently: **standing here is recognition, never currency.** Nothing in this document can be spent, none of it decays, none of it is ranked against a leaderboard, and no player experiences anxiety about losing it, because none of it can be lost by anything other than a deliberate, mutual, undoable-by-either-party action.

Where a feature below would fail either pillar's decision test, it is not included, and the failure is written down rather than quietly avoided — the Roadmap obligations section names what is deliberately deferred and why.

## 1. Lineage as a graph

### 1.1 What an edge is

A lineage edge is a directed, teacher → student relationship, always sourced from one specific completed teaching game (§2). It is data the platform stores about a real teaching act, not a badge either party can grant themselves.

```
LineageEdge
  id
  teacher_account_id
  student_account_id
  source_game_id          # the teaching game that made this edge eligible
  offered_at               # when the platform surfaced the confirmation prompt to the student
  confirmed_at              # null until the student acts; edge renders nowhere until this is set
  visibility                 # "listed" | "private" — the student's choice, changeable at any time
  teaching_games_count        # increments on each later completed teaching game between this pair
  last_taught_at
  severed_at                  # null; set when either party removes the edge
  severed_by                    # "teacher" | "student" | null
```

### 1.2 What creates an edge — nothing automatic

An edge is **offered**, never created outright. The offer fires only when all of the following hold:

1. The game was played in teaching-game mode (§2) — a ranked or casual game never offers an edge, however instructive it turned out to be.
2. The game reached a **completed** end: scored, resigned with acknowledgment, or explicitly ended by mutual agreement — not merely abandoned or disconnected before either player engaged with it.
3. The game passed a minimum substance bar: at least 20 moves recorded, or an explicit "this was a real lesson" mark from the teacher at close. This exists for one reason — to keep a two-move test game from being able to spawn an edge at all (§1.5).
4. The **student**, and only the student, receives the confirmation prompt at game close: *"Did you learn something from this game with [teacher]? Add them to your lineage — visible only if you choose."* A single explicit tap confirms it. Silence, a closed tab, or a declined prompt all resolve to no edge — there is no default-yes and no confirm-by-timeout.

The teacher cannot confirm their own edge. This is deliberate, not an oversight: standing accrues only from the side of the person who received the teaching, which is the only account of "did this help me" the platform is entitled to trust.

**Decision test applied.** Pillar 5 asks whether a feature "creates an occasion for one player to teach another — and does the teacher gain standing (lineage), not points?" A completed teaching game is the occasion; the edge is the standing; nothing about it is denominated in points, and nothing about it can be earned without the other person's word.

### 1.3 What a teacher sees

A teacher's own view has two independent layers, gated by two independent consents:

- **The lineage tree itself** — every student whose edge is `confirmed` and `visibility: listed`, shown with the student's rank *at the time of that teaching game*, not their current rank. This is a memory, not a live scoreboard.
- **Ongoing progress**, shown only for a student who has separately opted in to "share my progress with teachers who taught me" — a second, distinct consent from the lineage-edge confirmation. A struggling student's later losses are never visible to a past teacher unless the student chose that, which keeps a teacher relationship from becoming a second audience to perform well for (Pillar 4: "does it create any anxiety the player didn't bring with them?").

### 1.4 Where a teacher's lineage is visible — the exact list

Standing is recognition, so it is surfaced only in places a person would actually look to recognize someone, never in a place built to rank people against each other:

1. The teacher's own profile, in a "Teaching" section: the tree described in §1.3.
2. Each student's own profile, under "Taught by," only for edges that student has kept `listed`.
3. A club's roster page (§3.1): next to a member's name, a small note naming their listed teacher, if that teacher is also a club member — this is the one place lineage is ambient rather than sought out, because it is exactly how a real club's institutional memory works.

**Never:** no global "top teachers" surface, no leaderboard sorted by student count, no platform-wide search or filter by teaching volume, no numeric "N students taught" badge rendered anywhere outside the teacher's own profile. These are Pillar 4's forbidden leaderboard-as-default-surface and Pillar 5's forbidden gamification-currency, named as the same violation seen from two pillars.

### 1.5 Abuse considerations

**Edge removal.** Either party may sever an edge unilaterally, at any time, for any reason — this mirrors an "unfollow," not a dispute process. Severing does not delete the underlying game record (it stays in each account's own private archive) but removes the edge from every lineage rendering for both parties immediately. A severed edge is not re-offered by a later teaching game between the same pair unless the severing party first clears the severance flag — this stops an edge from being forced back into visibility by an unwanted opponent simply replaying a teaching game against someone who removed them once.

**No farming.** The structural argument, per the brief this document serves: edges grant no power, only visibility, so there is nothing to farm. That claim is doing more work than it can fully support, and it is worth saying so plainly rather than repeating it as settled: visibility is exactly the currency status-economy patterns exploit elsewhere — it's what a follower count or a trophy case is, just left unquantified here — and [Calm Technology](./calm-technology.md#part-3--the-honest-retention-theory) proposes measuring whether a confirmed teaching edge predicts longer platform tenure, which is this corpus treating lineage-edge accumulation as a designed, measured retention lever in the same breath this section calls it unfarmable. The two aren't contradictory — a mechanism can be both a genuine, hard-to-game measure of real teaching *and* something the platform hopes accumulates, the same way this document hopes clubs accumulate members — but "nothing to farm" overstates it. What's actually true, and defensible, is narrower: the specific mechanical loopholes below are closed, so an edge cannot be minted, inflated, or self-granted without a real student's real confirmation. That's a claim about gaming the mechanism, not a claim that the standing it produces carries no incentive weight at all.

- One edge per teacher–student pair, ever (§1.1's `teaching_games_count` accumulates on the same edge; it cannot spawn duplicates).
- The minimum-substance bar (§1.2.3) blocks a rapid string of trivial games from generating a rapid string of offers.
- Only the student can confirm, so an account cannot inflate its own teacher-lineage by playing itself under alternate accounts and self-confirming as teacher.
- A club-scoped ladder or simul cannot itself be gamed into lineage volume, because a simul's edges still route through the same one-per-pair, student-confirmed rule as any other teaching game (§3.3).

What remains — a teacher who is genuinely generous with their time and accrues a large, honest tree — is exactly the outcome Pillar 5 wants recognized, and precisely because nothing here is currency, there is no reward for making the tree bigger than the truth.

## 2. Teaching-game mode

A teaching game is not a ranked game with rating turned off. Every mechanic differs, because the two modes serve opposite Pillar-4 purposes: ranked play measures, calmly; teaching play teaches, without being watched.

| Dimension | Ranked game | Teaching game |
|---|---|---|
| Counts toward rating | Always | Never, no exception — a teaching game cannot be misfiled as ranked after the fact |
| Clock | Enforced (absolute/Fischer/byo-yomi) | Optional, soft by default — no move timer unless both sides opt in |
| Spectator default | Open (subject to §4.1's reveal timing) | Private to participants unless both explicitly invite a spectator |
| Undo | Never offered in the UI (§4.2) | A two-party "request takeback" flow, available at any point (§4.2) |
| Branch exploration | Not available — the game record is the game | Inline: either player can open a hypothetical branch on the live board, explore it together, and return to the trunk position; every branch is saved into the game record as a variation |
| Teacher stones | N/A | The teacher may place and clear a distinct, visually marked stone layer to demonstrate a continuation without altering the real position |
| Shared pointer | N/A | A synced on-board pointer either player can use to indicate a point without placing a stone — the digital equivalent of tapping the board |
| Result archived as | Win/Loss, feeds the rating history | "Teaching game," filed separately, never shown as a loss anywhere in either account's record |
| Post-game | Rating update, optional review | The lineage-edge offer to the student (§1.2), plus an optional saved commentary from the teacher attached to the branches explored |
| Ceremony | Nigiri, bow, resignation — Pillar 5's ritual, unchanged | Same ritual at open and close; no ceremony around the result itself, because there is no result to have ceremony about |

**Worked example.** A 4-kyu player is teaching a rank-unlisted beginner. At move 34, White has just connected a group the beginner thought was already dead. The teacher opens a branch: "what if you'd played here instead?" — the board splits into a tinted hypothetical layer, both players place stones in it together, the beginner sees the group actually die two moves later, and they return to the trunk position with the lesson enacted rather than described (Pillar 1: the app names the concept — "false eye" — only after the beginner has just watched one form and fail). The branch is saved. At game close, the beginner gets the lineage-edge offer; the teacher gets nothing but the offer having been made, because that *is* the standing.

## 3. Clubs as first-class

Clubs, not lobbies, are the default social surface. A lobby remains reachable for Pillar 1's ten-second no-account entry, but for an account holder past onboarding, the dashboard's rendering order is: (1) your club's current study-night position and any upcoming simul or mentor activity, (2) a direct challenge from a lineage contact, (3) the open lobby. The open lobby is never removed; it is simply never first.

### 3.1 Charter

```
ClubCharter
  club_id
  name
  founding_stewards: [account_id, account_id, ...]   # >= 2 distinct accounts
  purpose                                               # required prose, not a placeholder
  membership_policy       # "open" | "invite-only" | "application"
  meeting_cadence          # free text, optional — e.g. "weekly study night, Thursdays"
  code_of_conduct           # "platform-base" | "platform-base+addenda"
  addenda                     # may only add stricter norms, never weaken a base clause
  created_at
```

**Creation test (decidable).** Club creation is refused unless: at least two distinct accounts co-found it (a "club" of one person is a lobby wearing a costume — Pillar 5's "clubs outrank lobbies" only means something if a club is actually social); the purpose field is non-empty, non-template prose; and the code of conduct references the platform base (§5.4) with addenda checked against a fixed list of base clauses no addendum is permitted to remove.

### 3.2 Study nights — the weekly-position artifact

A study night is not a meeting the platform schedules; it is one artifact the club produces every week, which members study asynchronously and then discuss.

```
StudyNightPosition
  club_id
  week_of                    # the Monday the week starts
  sgf                          # a single position — a diagram, not a full game
  prompt                        # e.g. "What should White do here?"
  posted_by                       # club member, steward or rotating
  source                            # citation: a canon game, a member's own game, a tsumego set
  discussion_opens_at
  discussion_closes_at              # closing archives the position; no urgency framing around the deadline
  submitted_readings: [
    { member_id, variation_sgf, comment, submitted_at }
  ]
  archived_at
```

**Reveal rule (decidable, mirrors §4.1's kibitz-chat logic).** A member's own submitted reading becomes visible to other members the moment *they* submit their own reading, or at `discussion_closes_at`, whichever comes first. This is the study-hall rule, not a broadcast rule: you see others' answers once you've committed yours, so early readers don't anchor the room.

### 3.3 Simuls

A simul is a club-scoped event: one strong player (the host) plays several club members at once, in the historical tradition of the exhibition simultanée — "a board game exhibition in which one player of high rank plays multiple games at a time with a number of other participants," a format documented as a tradition of outreach and education rather than competition [@wikipedia_simul].

```
SimulEvent
  club_id
  host_account_id
  scheduled_at
  board_capacity        # host-chosen N
  ruleset: "teaching"     # simuls always run as teaching games — never ranked
  signup: [account_id...]   # opt-in, capped at board_capacity
  rotation_order              # boards visited in a fixed order; the digital analog prompts the next board when the host "arrives"
  status
```

Because a simul always runs as a set of teaching games, every board's completion independently triggers the standard lineage-edge offer (§1.2) to that participant, with the host as teacher. A simul with ten boards can produce up to ten offers, never one bulk grant — each is still the student's own confirmation.

### 3.4 Internal friendly ladders

```
ClubLadder
  club_id
  opted_in_members: [account_id...]   # nobody appears unless they opt in themselves
  standings                              # derived from club-scoped casual games between opted-in members only
  visible_to: "club members only"          # never public, never cross-club
  feeds_platform_rating: false                # hard rule, no exception
```

**Compliance test (decidable).** A club ladder fails review if it is default-on for new members, visible outside the club, described anywhere as a reward external to the club, or connected in any way to the platform's Glicko-2 rating. What survives that test is a small, opt-in, low-stakes standing among people who already know each other — closer to a running joke about who's beating whom this month than a competition, which is exactly the register Pillar 4 permits.

## 4. Kibitz norms

### 4.1 Spectator chat: never visible mid-game, revealed once

A kibitzer — the standard term for a spectator, "usually one who offers (often unwanted) advice or commentary" [@wikipedia_kibitzer] — talks to other spectators, never to the players, for the length of the game. Spectator chat is:

- Invisible to both players for the entire duration of play, with no partial leak (no "3 new messages" badge, no notification sound).
- Revealed only once the game record locks — resignation confirmed, both passes agreed and score confirmed, or a timeout processed — at which point it appears as a collapsed "Spectator commentary" tab on the post-game review screen. Reading it is the player's choice, made after the fact, when the decision it might comment on is no longer live.
- In beginner-protected rooms (§5.2), even the *count* of spectators is hidden during play by default; open rooms show a spectator count (never identities, never content) during play, since audience-size anxiety is exactly the kind of anxiety Pillar 4 asks whether a feature creates that "the player didn't bring with them."

### 4.2 Undo-request etiquette, encoded in the UI

Real Go communities disagree about takebacks — one camp treats asking as close to sacrilege, another treats refusing an immediate misclick correction as turning Go into "some action arcade variant" [@senseislibrary_takeback] — and Sensei's Library's own account of a teaching game notes plainly that "the pupil may or may not retake his move," at the teacher's discretion [@senseislibrary_teachinggame]. The platform does not adjudicate that disagreement; it encodes the two-party consent it implies.

- **Ranked games:** no undo control exists in the UI at all — not disabled, absent. Nothing about correcting a misclick is worth compromising a number other players trust.
- **Casual and teaching games:** a "Request takeback" button is present at any point. Pressing it sends the opponent a modal with Accept / Decline; an unanswered request auto-expires after 30 seconds rather than sitting as pressure; only the most recent move is ever take-back-eligible per request (no reaching back through history); repeated requests are allowed if both sides keep agreeing. Nothing is ever taken back without the other person's explicit action — the UI never infers consent from silence, matching the same rule lineage-edge confirmation uses (§1.2).

## 5. Moderation as care

### 5.1 Report flow

```
Report
  reporter_id            # never shown to the reported party
  reported_id
  category: "harassment" | "cheating-suspicion" | "unsafe-content" | "other"
  game_id                  # optional evidence anchor
  submitted_at
  status: "queued" | "reviewing" | "resolved"
  resolution_note             # shown to the reporter as acknowledgment, not a public verdict
```

A report never itself changes anyone's rating or standing before review — a false or retaliatory report cannot be used as a weapon, since it has no automatic effect. The reporter always receives an acknowledgment; the reported party is never told who reported them. This is care in the specific Pillar-4 sense: it exists to reduce anxiety a report might otherwise create, on both sides of it.

### 5.2 Beginner-protected spaces

Rooms may be flagged `beginner-protected`: entry gated by an account's rank (below a set ceiling) or game count, per the plan's own community model of "Rooms (beginner-protected, teaching, open)." Inside such a room, the spectator-count hiding of §4.1 is the default, and matchmaking for casual/ranked play within it never pairs a protected account against an unprotected one.

### 5.3 Mentor vetting — lightweight, and bootstrapped from lineage itself

Mentor status is not a certification exam; it is a short, revocable checklist, deliberately built to reuse the lineage graph rather than invent a parallel one:

1. At least one `confirmed` lineage edge already exists with this account as teacher (§1.1) — a mentor must have actually taught someone before being called one; the platform does not certify a capability it hasn't seen evidence of.
2. Rank meets a minimum threshold (single-digit kyu or stronger), or a club steward grants an exception manually, with a stated reason recorded on the account.
3. Zero unresolved harassment reports (§5.1) in the lookback window.

Vetting is revocable by a steward at any time, with a stated reason, and is appealable. It confers no currency — a mentor listing is a fact rendered next to a profile (per §1.4's exact-location rule), not a rank or a badge with its own leaderboard.

### 5.4 The code of conduct as corpus content

Per the platform plan's own instruction, "the code of conduct and etiquette guide are authored as corpus content in the RPG section's table-culture tradition — culture is curriculum here, not terms-of-service boilerplate." The in-house model is the tabletop-RPG section's own material: [table culture](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/role-playing-games-services-section/services/tabletop-role-playing-games-services-section/content/text/glossary/terms/table-culture.md), which defines the shared norms a group develops for how it plays together, and [Safety and Consent](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/role-playing-games-services-section/content/text/documents/articles/notes/safety-and-consent.md), a full lesson — Audience, Learning goal, worked example, exercises — built around concrete tools (lines and veils, the X-Card, open door, stars and wishes) rather than a rules list.

The weiqi platform's own etiquette guide must follow that shape, not a EULA's: a lesson titled something like "Table Manners for the Go Board," teaching (in glossary vocabulary, per Pillar 1) what a bow at game-start means, why a kibitzer's silence during play is the norm and not a suggestion, and how a takeback request is asked and answered — each point anchored to a worked example a reader can picture, the same template the RPG section already proved out. It ships as content in this section's own corpus, authored and versioned exactly like a lesson, so a new club can quote it the way a new table quotes a safety-tool primer at session zero.

## 6. Storage

Every sibling design document that introduces persistent state names its storage layer explicitly — onboarding-screenplay.md's `localStorage["weiqi-learn:progress"]` promoted to a D1 `users` table with an exact merge rule, mastery-model.md's `localStorage["weiqi-learn:mastery"]` promoted the same way, own-games-textbook.md's local-first-by-default mined puzzles, ritual-and-atmosphere.md's `RitualPreference`. An earlier draft of this document never did, for any of its six persistent entities (`LineageEdge`, `ClubCharter`, `StudyNightPosition`, `SimulEvent`, `ClubLadder`, `Report`) — a real gap, and one this corpus's local-first premise requires resolving rather than leaving implicit, since getting it wrong here is a different kind of mistake than getting it wrong in a Phase-1 client-only feature.

**Why these six can't follow the Phase-1 client-first pattern.** A `LineageEdge` is a `teacher_account_id`/`student_account_id` pair, visible to two different accounts on two different devices, that only makes sense as the record both parties see the same version of. A `ClubCharter` is a multi-member roster by definition (`founding_stewards: [account_id, account_id, ...]`, `>= 2 distinct accounts`). None of the six entities in this document is single-player, private, on-device state the way a Phase-1 mastery map or ritual preference is — they are inherently shared, multi-party records, and "store it in the browser that happened to create it" is not a coherent answer to "where does a fact two accounts both need to see live."

**The answer.** All six are **server-side, D1-backed records from their first ship — there is no local-only phase for any of them**, matching the phase each is already scheduled to (Roadmap obligations, below, unchanged in substance, now with a storage layer stated):

| Entity | D1 table (proposed name, matching the plan's own naming style) | First ships |
|---|---|---|
| `LineageEdge` | `lineage_edges` | Phase 4 |
| `ClubCharter` | `clubs` | Phase 4 |
| `StudyNightPosition` | `study_night_positions`, with `submitted_readings` as a child table keyed to it | Phase 4 |
| `SimulEvent` | `simul_events` | Phase 4 |
| `ClubLadder` | `club_ladders`, with `opted_in_members` and `standings` as child tables | Phase 4 |
| `Report` | `reports` | **Phase 2** — this one ships earlier than the other five, per Roadmap obligations' existing Phase 2 commitment, so it needs its D1 table alongside whatever Phase 2 tables the platform plan already scopes for ranked play, not deferred to Phase 4 with the rest of this section |

No entity here has a `localStorage` or IndexedDB representation at any phase, and no client-side cache of one may be treated as authoritative — a device may cache a read-only copy for display, but every write (an edge confirmation, a club creation, a submitted reading) goes to D1 directly, the same way Phase 2's account rung already requires for identity data.

## Roadmap obligations

This document specifies Phase 4 (Belong) work, per the platform plan's roadmap — "Teaching games and mentor ladder; rooms and clubs; tournaments (McMahon); rengo; the culture curriculum in full." Several pieces are seeded earlier, and this section says exactly which:

- **Phase 2 (Play)** owes the report/moderation flow (§5.1) and beginner-protected room flag (§5.2) as launch-day infrastructure for ranked play — the plan already states this ("standard server-health policies from day one of ranked play"), not deferred to Phase 4. Phase 2 also owes the live-game plumbing §4.1's reveal-timing rule depends on: a spectator channel architecturally separated from the player channel from the start, even before teaching-game mode exists to use it, so the never-mid-game rule is never a retrofit.
- **Phase 3 (Understand)** owes the rank data §5.3's vetting checklist reads (kyu/dan display, rated play) and the concept-event instrumentation that makes a teaching game's post-mortem (§2's worked example) possible at all — Pillar 2's legibility layer is a dependency of a good teaching game, not an independent feature.
- **Phase 4 (Belong)** owes everything else specified here outright: the lineage graph and its edge lifecycle (§1), teaching-game mode's UI (§2), clubs in full — charter, study nights, simuls, internal ladders (§3) — the code-of-conduct corpus content (§5.4), and the D1-backed storage layer named in §6 for every entity this document defines. None of it should be built early as a shortcut; each depends on the phase before it being genuinely finished, per the plan's own "each phase ships something complete and usable on its own."
- **Owed: a group-teaching edge-creation pathway.** [Canon and Broadcast](./canon-and-broadcast.md#how-watch-parties-work-in-clubs) describes a club member narrating a broadcast for the room as a teaching act Pillar 5 wants recognized — correctly, as a pedagogical matter — but that document does not own this graph and, after correction, no longer claims it can grant a `LineageEdge` for it. Every edge this document currently defines is sourced from §1.2's four conditions: one specific completed teaching game, a single student's explicit confirmation, a 20-move substance bar, no automatic grant. A watch-party has no single teaching game between the narrator and any one student, no `source_game_id`, and no defined confirmation flow for a room instead of a pair — extending the graph to cover it needs a genuinely new trigger, evidence shape, and confirmation flow (plausibly: each attendee who explicitly marks "this explanation helped me" individually, rather than one blanket grant to the room), designed with the same rigor §1.2 already applies to the one-on-one case. This is named here as owed Phase 4 design work, not committed to a specific mechanism yet — the wrong fix would be inventing one quickly just to close the gap.
