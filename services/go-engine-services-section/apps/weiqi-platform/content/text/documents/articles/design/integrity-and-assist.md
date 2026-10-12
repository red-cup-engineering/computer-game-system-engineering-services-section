---
title: Integrity and Sanctioned Assistance
description: "Audience: designers and engineers building the play, labeling, and moderation systems for Phase 2 (Play) and Phase 3 (Understand). How the platform treats engine assistance — what it forbids, what it sanctions as a feature, and how it detects the rest without becoming a surveillance system."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
references:
  cnn2023aigo:
    authors: ["Simone McCarthy"]
    title: "How AI turned the ancient Chinese sport of Go upside down"
    publication: "CNN"
    year: 2023
    url: "https://www.cnn.com/2023/03/24/asia/ai-disruption-go-sport-hnk-intl-dst/index.html"
  chessbase2023cheating:
    authors: ["ChessBase"]
    title: "Cheating problem in Go"
    publication: "ChessBase"
    year: 2023
    url: "https://en.chessbase.com/post/cheating-problem-in-go"
  sixthtone2025qinsiyue:
    authors: ["Sixth Tone"]
    title: "China Bans Teenage Go Player for Using AI to Cheat"
    publication: "Sixth Tone"
    year: 2025
    url: "https://www.sixthtone.com/news/1016746"
  koreatimes2020aicheat:
    authors: ["The Korea Times"]
    title: "Go player cheated using AI"
    publication: "The Korea Times"
    year: 2020
    url: "https://koreatimes.co.kr/www/sports/2020/11/663_299695.html"
  globaltimes2022liuruizhi:
    authors: ["Global Times"]
    title: "Chinese Go player gets one-year ban for using AI during national competition"
    publication: "Global Times"
    year: 2022
    url: "https://www.globaltimes.cn/page/202203/1255011.shtml"
  nordicgodojo2024catch:
    authors: ["Nordic Go Dojo"]
    title: "How to catch cheaters online"
    publication: "Nordic Go Dojo"
    year: 2024
    url: "https://www.nordicgodojo.eu/post/57/how-to-catch-cheaters-online"
  kasparov1998centaur:
    authors: ["History of Information"]
    title: "The First \"Advanced\" or \"Freestyle\" or \"Centaur\" Human & Computer Chess Event"
    publication: "History of Information"
    year: 1998
    url: "https://historyofinformation.com/detail.php?id=4259"
cites:
  - cnn2023aigo
  - chessbase2023cheating
  - sixthtone2025qinsiyue
  - koreatimes2020aicheat
  - globaltimes2022liuruizhi
  - nordicgodojo2024catch
  - kasparov1998centaur
---

Audience: designers and engineers building the play, labeling, and moderation systems for Phase 2 (Play) and Phase 3 (Understand).

This document serves [Design Pillars](./design-pillars.md) 4 (Calm by construction) and 5 (A place in the lineage), and depends on the ratings posture set in `calm-technology.md`. It commits Phase 2 to a labeling schema (Part 2) and Phase 3+ to a detection posture (Part 3); nothing here ships before those phases arrive, but the schema and the refusals bind now.

## Part 1 — The stance

Engine cheating is not a hypothetical risk for a Go platform to get ahead of. It is the sport's live, documented, unresolved trust crisis, at every level from national championship to online ladder.

**What has actually happened.** In April 2023, newcomer Li Xuanhao's defeat of reigning world champion Shin Jin-seo at the $200,000 Chunlan Cup drew a cheating accusation from Li's own teammate; the Chinese Weiqi Association investigated for weeks and ruled that there was no evidence of cheating — a real finding, not an inconclusive shrug — and separately penalized the accusing teammate with a six-month partial suspension from competition for the accusation itself [@cnn2023aigo]. In December 2024, 19-year-old professional Qin Siyue was caught hiding a phone at the National Go Championship; her recorded moves matched engine output 73% of the time, and her Chinese Weiqi Association ranking was revoked with an eight-year ban from all sanctioned events [@sixthtone2025qinsiyue]. In 2022, professional Liu Ruizhi received a one-year ban for AI use in a national qualifier [@globaltimes2022liuruizhi]. In 2020, a South Korean court sentenced two people to prison for a scheme in which a player wore a hidden camera and earpiece and received engine-computed moves relayed by an accomplice outside the venue [@koreatimes2020aicheat]. None of this is confined to elite play: one survey of the field describes online leagues as "especially precarious," with credible estimates that engine-assisted play is common among strong online players who are never caught at all [@chessbase2023cheating].

**Why detection alone will not solve it.** The Chunlan Cup case is the instructive one, and the instructive part is not that it produced no answer — it's that a national federation, motivated and resourced, spent weeks on a single suspicious game and could only reach a negative finding (no evidence of cheating), then had to sanction the *accuser* rather than settle the technical question with confidence either way. That is what "usually inconclusive" looks like in practice for single-game forensics: not silence, but a procedural verdict that couldn't do more than clear the accused player while leaving collateral damage on the person who raised the alarm in good faith. Forensics across a large sample is what actually catches people (Part 3), and even that produces false positives (also Part 3). A platform that tries to solve engine cheating by getting better at catching it, alone, is choosing the one approach that the sport's federations — with far more resources than we will ever have — have not made reliably work on a single game.

**The other lever: lower the stakes that make cheating rational.** Every documented case above shares a structural feature: something valuable was on the line — prize money, national ranking, professional standing, tournament selection. The ludics corpus's account of the [magic circle](../../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/social-theory-science-services-section/services/ludics-science-services-section/services/game-ludics-services-section/content/text/documents/articles/notes/the-magic-circle-and-its-critics.md) explains why this matters: the circle is "a membrane, not a wall," and what leaks through it is what's staked outside it — money in Geertz's deep play, a career in professional sport. Cheating pressure tracks what crosses the membrane. A platform that keeps the outside-stakes low keeps the pressure low, structurally, before any detection system runs a single query.

This is a design choice already made by Pillar 4, not a new one invented for this document:

| What's at stake | Chunlan Cup / national championship | This platform (Phase 2 launch) |
|---|---|---|
| Prize money | $200,000 (Chunlan Cup) | None — no cash prizes, ever |
| Professional ranking / livelihood | Revoked on conviction | No professional ranking exists here |
| Rating visibility | Public, career-defining | Hidden by default for learners; trend language, not numbers (`calm-technology.md`) |
| National team selection | At stake in qualifiers | Not applicable |
| Public consequence of a loss | National news | None — no ceremony around losses (Pillar 4) |

**The consequence for design.** Because we do not stake money, career, or public standing on outcomes, the *use of an engine is not the platform's crime*. Engines are how players study Go; the analysis sandbox exists so that using one is always available and always legitimate (Part 2). The crime is *misrepresentation* — consulting an engine while presenting a game as unassisted, inside a surface where the other party or the rating system is relying on that not being true. This reframe is what makes Part 2 possible: instead of building a wall around engines, we build honest doors.

## Part 2 — Sanctioned assist modes

Three surfaces exist. Exactly one of them ("engine-transparent games") sits inside live play; the other two are explicitly outside it. Every game record carries an `assist-mode` field; there is no "unspecified" state.

| Mode | Where | Who may consult an engine | Disclosure | Counts toward rating |
|---|---|---|---|---|
| `none` | Live game | Nobody, at any point | Default; no badge shown | Yes |
| `centaur-study` | Outside live play — a joint session | Both participants, together, exploring one line | Session is labeled `centaur-study` from creation; not a game record at all | No — it isn't a game |
| `engine-transparent` | Live game | Both sides, freely, mid-game | Badge visible before either player's first move | No — recorded as a distinct, non-rated game type |
| Analysis sandbox | Always available, outside any game | The lone player, any time | N/A — it is study, not play, and is never mistaken for either | N/A |

**Centaur study**, named for the "centaur chess" practice Kasparov originated after his 1997 loss to Deep Blue — two people and an engine exploring a position together, neither claiming sole authorship of the resulting insight [@kasparov1998centaur]. On this platform it is two *players* (not a player and a bot) sitting inside one shared board-plus-engine session, both seeing the same analysis, talking through it. It produces a saved study, not a game record, and is never rated — there is no result to be honest or dishonest about.

**Engine-transparent games** are live, played-to-completion games in which both sides may consult an engine panel mid-game, and both know the other can too. This is the sanctioned answer to "I want to see what happens when two players play *with* an engine, honestly, against each other" — a legitimate, ludus-with-open-rules mode the [magic circle](../../../../../../../../../../../../../../../../science-services-section/services/social-science-services-section/services/social-theory-science-services-section/services/ludics-science-services-section/services/game-ludics-services-section/content/text/documents/articles/notes/the-magic-circle-and-its-critics.md) lesson would recognize as a circle whose rules simply include the engine, drawn openly rather than snuck through. They never count toward rating, because rating exists to compare unassisted skill.

**Labeling rule (binding, Phase 2).** An assist badge is not a moderation flag; it is a game-state field, set at creation, immutable for the life of the game:

```
Game.assist_mode: "none" | "centaur-study" | "engine-transparent"
```

**Relationship to `rated`, stated once here so it doesn't drift.** `assist_mode` and [Calm Technology](./calm-technology.md#learning-games-that-never-count)'s `rated: boolean` are two independent fields on a `Game` record, not one field wearing two names — an earlier draft of that document conflated them, and has been corrected to point back here. A `centaur-study` session carries neither field, since Part 2's own table above states it is "not a game record at all." An `engine-transparent` game is a real `Game` record with both fields set: `assist_mode: "engine-transparent"` and `rated: false`, for related but distinct reasons.

- `engine-transparent` games display a persistent header badge — "Engine-transparent · both players may consult analysis" — visible to both players and any spectator from the first move, not appended after the fact.
- SGF export carries the mode in a game-comment property, e.g. `GC[assist-mode:engine-transparent]`, so the record is self-describing wherever it travels — this requires a kernel-side extension not yet built; see Roadmap obligations for the specific gap and who owes it.
- A game may not change `assist_mode` after creation. A player who wants to switch from `none` to `engine-transparent` mid-game must resign or draw the game and start a new one under the new mode — this is a deliberate friction, not an oversight, because silent mode-switching is exactly the ambiguity labeling exists to prevent.
- The analysis sandbox is architecturally a separate surface: its engine session must not share a network channel with any live-game Durable Object. This is a build requirement, not a policy one — it means assist cannot leak from "study" into "play" through a shared connection even by accident.

**Decidable test for any new feature that touches engines:** can a spectator or opponent tell, without asking, which of the four rows above they are looking at, before a single move is made? If not, the feature does not ship.

## Part 3 — Detection as care, not policing

Detection exists to protect the `none` lane — the default, rated, unassisted game — not to police the sanctioned modes in Part 2, which need no detection because they hide nothing.

**Signals, and their honest limits.** The strongest public methodology for online Go cheating detection compares a player's moves against an engine's top choices across a sample of games, plus timing patterns — engine-strength moves played unnaturally fast [@nordicgodojo2024catch]. Every signal below has a known, real false-positive cause; the table exists so nobody treats a signal as proof.

| Signal | What it measures | Known false-positive cause |
|---|---|---|
| Match rate to engine's top move, single game | Coincidence of play with engine preference | Short, tactical games and well-studied joseki naturally run high; the same source's own comment thread showed a clean, non-cheating game hitting a similar rate [@nordicgodojo2024catch] |
| Match rate, sustained over many games | Coincidence over a large enough sample to be statistically informative | Rank-appropriate memorization of opening theory (a strong opening-book player can legitimately track an engine closely in the opening phase, then diverge in the middlegame) |
| Timing anomaly (strong moves played very fast) | Deviation from the player's own baseline decision time | Flow-state play, familiar positions, players who have simply seen this exact shape before |
| Sudden rating or win-rate jump | Change in demonstrated strength | Genuine improvement — this platform's own spaced-repetition tsumego and concept-graph tracking are *built* to produce real jumps; a detector naive to this would flag our own pedagogy as evidence of cheating |

**The false-positive problem, stated plainly.** The Chunlan Cup investigation — a national federation, weeks of work, strong incentive to find an answer — could only clear the accused on a negative finding (no evidence of cheating) and had to sanction the accusing teammate for raising it [@cnn2023aigo]; it did not, and structurally could not, produce a confident technical verdict on the single game itself. If that apparatus cannot resolve a single game cleanly, an automated signal computed by our own future engine service cannot either, on its own. We bias toward under-enforcement because our stakes (Part 1's table) make the two error costs asymmetric: a false accusation costs us a learner's trust in a platform whose entire premise is safety to be bad at Go in public (Pillar 4); a missed cheater in a game with no money, no ranking, and no public consequence costs comparatively little. That asymmetry is the actual argument for under-enforcement — not optimism about the signals.

**Graduated response.** No stage is public. No stage is automatic past Stage 1.

| Stage | Trigger | Action |
|---|---|---|
| 1 — Private conversation | A sustained-sample signal (not a single game) crosses a conservative threshold | A private message from a human moderator, showing the player the actual pattern, naming Part 2's sanctioned modes as an available, honest alternative |
| 2 — Quiet correction | Pattern repeats after Stage 1, confirmed by a second human reviewer | Affected games are annulled from rating history; the player themselves is told directly and privately, at the same time, what changed and why — no public note, no opponent notification naming the player, but never a silent rewrite the player could only discover by noticing an unexplained rating change |
| 3 — Matchmaking restriction | Pattern persists after Stage 2 | Player is limited to `engine-transparent` and unrated pools only — not banned, not shamed, simply moved to the lane where the behavior is already sanctioned |

**Appeal, at every stage.** The accused player sees the actual signal data that triggered the flag — not a bare accusation. A human, not the system that raised the flag, reviews any appeal. Decisions and their basis are logged and available to the player on request, indefinitely.

**Sourcing the second reviewer — the gap an earlier draft of this document left unaddressed.** Stage 2 and Stage 3 both require "a second human reviewer to confirm the first's read of the pattern" (Part 4). The platform's own operating reality, stated plainly in [Playtest Protocol](./playtest-protocol.md)'s house posture, is "a local-first, solo-dev operation" — one person. A solo operator has no second human reviewer, structurally, and this document should not have specified a safeguard without saying where the second person comes from. The honest fix is not to weaken the rule (a single person re-reviewing their own read after a cooling-off period is not a second reviewer, whatever it's called) but to name the actual sourcing path and be explicit about what happens before it exists:

- **The mechanism.** Before Stage 2 or Stage 3 can fire even once, at least one other person must be recruited as a trusted reviewer — not a full moderator hire, not gated on Phase 4's club stewardship existing yet. The recruiting channel is the same one [Playtest Protocol](./playtest-protocol.md#recruiting-script) already uses for think-aloud participants: friends and their households, a Discord or forum the operator already has standing in. Vetting is lightweight and revocable, mirroring [Lineage and Clubs](./lineage-and-clubs.md#53-mentor-vetting--lightweight-and-bootstrapped-from-lineage-itself)'s own bootstrapped checklist rather than inventing a heavier one: the reviewer sees only the signal data for the specific pattern under review (never a general audit role), agrees to the same no-secret-tribunal, no-public-shaming rules Part 4 binds the whole system to, and can be removed at any time with a stated reason.
- **Until that person exists, the enforcement ladder is honestly stuck at Stage 1.** This is not a hypothetical caveat; it is the default starting state. Stage 1 (private conversation, one person, no annulment, no restriction) needs no second reviewer and is available from the moment Part 3 ships. Stage 2 and Stage 3 do not fire — not "fire cautiously," not "fire with the operator reviewing their own call twice" — until a named second reviewer is actually in place. A pattern that would warrant Stage 2 or 3, encountered before a reviewer is sourced, stays at Stage 1 (repeated private conversation, if it recurs) rather than either escalating alone or being ignored. This is written down here so it cannot be quietly forgotten under launch pressure the way an unstaffed safeguard usually is.

## Part 4 — What we promise never to do

These are refusals, not aspirations; a feature that requires any of these is rejected outright regardless of how well it would catch cheaters.

- **No surveillance-grade fingerprinting.** No keystroke dynamics, no webcam or microphone access, no device fingerprinting beyond what the game connection already requires. Pillar 4 forbids manufacturing anxiety, and being watched while you think is anxiety we will not manufacture.
- **No secret tribunals.** No accusation the accused cannot see, no decision made by one person alone, no permanent record hidden from the player it describes.
- **No public shaming.** No "suspected cheater" flags visible to opponents or spectators, no leaderboard of the accused, no game-result asterisks. Standing here is earned by teaching (Pillar 5), not lost by suspicion.
- **No third-party detection vendors.** No player data leaves our own systems for cheating analysis. If we cannot review a signal ourselves, we do not act on it.
- **No automatic bans.** Every Stage 2 or Stage 3 action requires a second human reviewer to confirm the first's read of the pattern.

## Worked example: the same game, two labels

A 9x9 game between two 12-kyu players. Midway through, one player wants to check a life-and-death read against an engine before continuing.

- **If the game was created as `none`:** they cannot — the client has no engine panel wired to a live `none` game, so the temptation is architecturally absent, not merely policy-forbidden. If they want the read, the honest move is to resign the game (or accept the loss of rating eligibility for it) and open the position in the analysis sandbox.
- **If the game was created as `engine-transparent`:** they open the panel, their opponent sees the panel-open indicator (both can always see whether the other has opened the panel this game — a live parity signal, not a post-hoc audit), and play continues. The game was never eligible for rating, so nothing about doing this changes what either player earns.

Same board, same position, same desire to check a read — the difference is which lane it happened in, and the lane was chosen before the first stone, not discovered after the last one.

## Roadmap obligations

- **Phase 2 (Play), at launch:** the three-value `assist_mode` field, the persistent header badge for `engine-transparent` games, and the architectural separation between the analysis sandbox and any live-game Durable Object are all launch requirements, not follow-ups. A Phase 2 game room that ships without a settled `assist_mode` on every game is out of spec. **The SGF `GC[assist-mode:...]` tag is not yet buildable against the kernel as written and is a kernel-side obligation, not an app-side one**: `apps/weiqi-kernel/src/sgf.mts`'s `SgfGameRecord` interface is `{ size, ruleset?, komi?, handicap?, moves }`, and `gameRecordToSgf()` hardcodes only `GM`, `FF`, `SZ`, `RU`, `KM`, `HA`, `AB` root properties — there is no field or code path to emit an arbitrary comment/`GC` property today, and `weiqi-learn`'s own `kernel-bridge.mjs` calls `gameRecordToSgf()` with that same fixed shape. Per the kernel's own constitution, extending its serialization surface is the kernel's to make, not the app's: this document's Phase-2 launch requirement is downgraded from "the tag ships" to "the tag ships once `SgfGameRecord` and its serializer carry an optional comment/`GC` field" — a named, scheduled kernel-extension obligation, owed alongside the app-side launch requirements above, not silently assumed to already be possible.
- **Phase 3 (Understand) or later:** Part 3's detection signals require the KataGo review service (`weiqi-platform-plan.md`'s Engines and AI section) to compute match-rate and timing analysis server-side. Before that service exists, enforcement is limited to community reporting reviewed by a human — which is an acceptable, not a degraded, starting state, given Part 3's own bias toward under-enforcement. **Stage 1 (private conversation) may fire as soon as Part 3's detection signals exist, with only the operator involved.** Stage 2 and Stage 3 may not fire — regardless of what phase the platform has otherwise reached — until "Sourcing the second reviewer," above, has actually been discharged: a named, vetted second reviewer in place. This is deliberately not pinned to a phase number the way the rest of this document's obligations are, because staffing is not a build task a phase boundary can guarantee; it is named here as a standing precondition instead, so that reaching Phase 4 (where club stewards eventually exist and could serve as later, better-vetted reviewers) does not get mistaken for having already discharged it.
- **Binding at every phase, permanently:** Part 4's five refusals. No later phase may reintroduce fingerprinting, secret review, public shaming, third-party data sharing, or automatic bans in pursuit of a better detection rate.
