---
title: Canon and Broadcast
description: "Audience: builders and reviewers of the weiqi platform's documentary format and its rank-gated broadcast layer. Specifies the playable-classic-game format (Pillar 5) and the 'training wheels' spectator layer for real games (Pillars 5, 2, 1), with an explicit phase boundary between the two."
date-created: 2026-08-19
date-updated: 2026-08-19
type: specification
authors:
  - claude-fable-5
tags: []
references:
  ear-reddening:
    title: "The Ear-Reddening Game: Honinbo Shusaku's Most Famous Move"
    url: "https://go-game.info/article/ear-reddening-game-honinbo-shusaku-analysis"
  alphago-move37:
    title: "The significance of move 37 by AlphaGo and move 78 by Lee Sedol"
    url: "https://jessa-gavila.medium.com/the-significance-of-move-37-by-alphago-and-move-78-by-lee-sedol-19a21cdb289b"
  lee-sedol-move78:
    title: "Lee Sedol vs AlphaGo, move 78 game 4, the God's touch"
    url: "https://www.are.na/block/7978098"
  go-seigen-shusai:
    title: "Hon'inbō Shūsai — Wikipedia"
    url: "https://en.wikipedia.org/wiki/Hon%27inb%C5%8D_Sh%C5%ABsai"
  rui-naiwei:
    title: "Rui Naiwei — Wikipedia"
    url: "https://en.wikipedia.org/wiki/Rui_Naiwei"
  guksu:
    title: "Guksu — Wikipedia"
    url: "https://en.wikipedia.org/wiki/Guksu"
  lg-cup-2020:
    title: "Shin Jin-seo — Wikipedia"
    url: "https://en.wikipedia.org/wiki/Shin_Jin-seo"
  gray-nagahara:
    title: "A Handicap Game — British Go Journal"
    url: "https://www.britgo.org/bgj/01914.html"
  chunlan-cheating:
    title: "How AI turned the ancient Chinese sport of Go upside down — CNN"
    url: "https://www.cnn.com/2023/03/24/asia/ai-disruption-go-sport-hnk-intl-dst/index.html"
  qin-siyue-cheating:
    title: "Chinese Pro banned for 8 years for using AI to cheat"
    url: "https://everybodycango.wordpress.com/2025/02/27/chinese-pro-banned-for-8-years-for-using-ai-to-cheat/"
cites:
  - ear-reddening
  - alphago-move37
  - lee-sedol-move78
  - go-seigen-shusai
  - rui-naiwei
  - guksu
  - lg-cup-2020
  - gray-nagahara
  - qin-siyue-cheating
  - chunlan-cheating
---


[Pillar 5](./design-pillars.md#pillar-5--a-place-in-the-lineage) commits us to a playable canon: "classic games as documentaries you step into and try yourself." This document specifies that documentary format (Part 1) and its sibling, broadcast mode — watching a real game, live or replayed, with [Pillar 2](./design-pillars.md#pillar-2--feedback-while-the-decision-is-still-warm)'s legibility layer running rank-gated so a spectator sees "training wheels" sized to what they've actually learned, per [Pillar 1](./design-pillars.md#pillar-1--do-first-name-after) (Part 2).

The two share a board component and a rank-band vocabulary, but they sit in different phases. Documentaries are hand-authored prose with no engine underneath, which is exactly why they are buildable now, alongside [`weiqi-learn`](../../../../../apps/weiqi-learn/README.md)'s existing lesson and tsumego players. Broadcast mode's core mechanic — translating live engine judgment into rank-sized assertions — cannot exist before the legibility layer itself does, which the [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md) and the pillars document both place in Phase 3. Section "Phase dependencies," below, is not an aside; it is the reason this document is organized as two parts instead of one feature.

## Part 1 — The documentary format

### What a documentary is

A documentary is one real game (or a deliberately chosen slice of one) retold as an ordered sequence of **beats**. Each beat narrates a stretch of real moves in glossary vocabulary, surfaces the two or three things worth noticing there, and — at the beats that earn it — hands the player the stone: a **you-try** branch where they play the position themselves before the narrative shows them what actually happened.

This is not a new interaction pattern. It is the lesson-board worked-example and the tsumego problem, already built and shipping in `weiqi-learn`, aimed at a real historical position instead of an invented teaching one. A documentary's beat reuses the lesson step's `board` shape (`size`, `stones`, `markers`, `sequence`) for its narrated diagram, and a you-try branch reuses the tsumego problem shape (`size`, `toPlay`, `stones`, `goal`, `accept`, `lines`, `failNote`) verbatim — see [`lessons.json`](../../../../../apps/weiqi-learn/public/data/lessons.json) and [`tsumego.json`](../../../../../apps/weiqi-learn/public/data/tsumego.json). Reuse is not a nicety here: it means the existing tsumego-checking module handles every you-try branch with zero new code, and it means a documentary author is filling in a form the platform already validates, not inventing a new content type.

### Format spec

A documentary is one JSON object, authored by hand into a `canon.json` sibling of `lessons.json` and `tsumego.json`:

```json
{
  "slug": "shusaku-ear-reddening-1846",
  "title": "The Ear-Reddening Game",
  "gameMeta": {
    "black": "Honinbo Shusaku (4 dan)",
    "white": "Inoue Gennan Inseki (8 dan)",
    "event": "even game, no handicap",
    "date": "1846-09-11",
    "boardSize": 19,
    "result": "B+2",
    "totalMoves": 325,
    "sgfSource": "<citation to the primary game record this documentary transcribes>",
    "targetRank": "10 kyu - 5 kyu",
    "lesson": "a quiet extension that connects two weak groups can outweigh a flashy capture"
  },
  "beats": [
    {
      "id": "beat-4-the-quiet-extension",
      "movesRange": [121, 130],
      "prose": "<60-120 words, present tense, no adjectives that aren't earned by a stone on the board>",
      "board": { "size": 19, "stones": [ "...position at the start of the beat..." ],
                 "markers": [ "...points to highlight..." ],
                 "sequence": [ { "move": "...", "note": "..." } ] },
      "assertions": [
        { "term": "connection", "text": "Black's move joins two groups that were each still separately weak." }
      ],
      "youTry": {
        "prompt": "Black to play. The two groups share one weakness. Find the move that removes it.",
        "problem": { "size": 19, "toPlay": "black", "stones": ["..."],
                     "goal": "...", "accept": ["..."], "lines": {}, "failNote": "..." }
      }
    }
  ]
}
```

Field rules a build/lint step enforces — each is a refusal condition, not a style suggestion:

| Field | Rule |
|---|---|
| `slug` | kebab-case, unique across `canon.json` |
| `gameMeta.sgfSource` | required and non-empty; a beat with no cited primary source does not ship (see Authoring standards) |
| `gameMeta.targetRank` | required, spelled `"N kyu"` / `"N dan"` per [How Ranks Work](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/teaching-articles/references/how-ranks-work.md), not an invented band |
| `beats` | non-empty, ordered; each `movesRange` must be strictly increasing and non-overlapping with its neighbors |
| `beats[].prose` | 60-120 words; a documentary that needs more per beat is narrating too much before the next you-try — split the beat |
| `beats[].assertions[].term` | must be a `name` value that exists in [`glossary.json`](../../../../../apps/weiqi-learn/public/data/glossary.json), or `null` for prose with no single linkable concept; never a term the glossary doesn't define (Pillar 1's forbid on app-invented vocabulary applies to documentaries too) |
| `beats[].youTry.problem` | must validate as a legal `tsumego.json` problem when run through the existing checker with zero modifications |

The glossary-term rule has a real, immediate consequence: the corpus's terms are the tactical cluster (liberty, atari, capture, ko, superko, suicide), the scoring cluster (territory, komi, handicap, area-scoring, territory-scoring, pass, dame, dead-stones), and the structural cluster (connection, eye, life-and-death, false-eye, seki) — twenty terms as of this writing, up from the plan's original ten. [Mastery Model](./mastery-model.md#the-graph-the-map-is-drawn-over) documents the same growth and the same staleness this paragraph used to carry: the topic page's own cluster prose has not caught up to twenty yet, so that document's cluster table, not the topic page, is the current source of truth, and this paragraph now matches it rather than repeating the topic page's stale count. Commentary on real games still reaches for words the corpus doesn't have at all — *moyo*, *joseki*, *tesuji*, *sente*, *gote* all appear naturally in the picks below, and none of the twenty above cover them. A beat that needs one of those terms blocks on authoring it first, in the corpus, as its own glossary entry — this is exactly the "content to author" backlog the [platform plan](../../../../../../../../../../../../../../../../science-services-section/services/philosophy-services-section/services/relationality-services-section/services/agency-services-section/services/being-services-section/services/doing-services-section/services/playing-services-section/services/gaming-services-section/services/board-games-services-section/services/weiqi-services-section/content/text/documents/articles/notes/weiqi-platform-plan.md) already names (joseki, tesuji, opening principles). Do not paraphrase around the gap by inventing informal in-app vocabulary; that is precisely what Pillar 1 forbids. Ship the beats that fit the twenty existing terms first, and let the canon list's remaining beats gate on corpus growth.

### Worked example

The fragment below demonstrates the mechanics, not a sourced position. The ear-reddening game's actual coordinates are not transcribed in this corpus yet — no `sgfSource` exists — so per the field rules above this fragment could not ship as written. It stands in for the shape a real beat takes, flagged the way the existing data files flag provisional material:

```json
{
  "id": "beat-illustrative",
  "movesRange": [1, 1],
  "_comment": "SCHEMATIC ONLY — not the historical position. Demonstrates the format's shape; a real beat 4 ships once a primary SGF for the 1846-09-11 Shusaku-Inseki game [@ear-reddening] is transcribed into gameMeta.sgfSource.",
  "prose": "Two Black groups sit apart, each alive only for now. White has just threatened the point that would keep them that way. Black does not capture anything here. Black plays the point both groups need.",
  "assertions": [
    { "term": "connection", "text": "The move joins two separately weak groups into one group that shares all their liberties." },
    { "term": "territory", "text": "Because the groups no longer need separate eye space, the point where a second eye would have gone becomes securable territory instead." }
  ],
  "youTry": {
    "prompt": "Black to play. Find the single point that connects both groups.",
    "problem": {
      "size": 9, "toPlay": "black",
      "stones": [
        { "pt": "C4", "color": "black" }, { "pt": "C5", "color": "black" },
        { "pt": "E4", "color": "black" }, { "pt": "E5", "color": "black" },
        { "pt": "D3", "color": "white" }, { "pt": "D6", "color": "white" }
      ],
      "goal": "The two Black pairs share one connecting point. Play it before White does.",
      "accept": ["D4", "D5"],
      "lines": {},
      "failNote": "Any other move leaves White free to play the connecting point and cut Black into two separately weak groups."
    }
  }
}
```

Note what the you-try branch is doing structurally: it opens a small, temporary space where the player acts freely, then closes back into the narrated game the moment they've played the point — a nested magic circle inside the documentary's larger one, exactly the shape the ludics corpus describes: bounded, voluntary, and over the instant the lesson is enacted. That closing matters as much as the opening; a you-try branch with no `lines` back to the narrative, or that strands the player on a dead-end board, fails Pillar 2's "path back onto the board" test as surely as any post-game analysis screen would.

### Authoring standards

1. **Source or don't ship.** `gameMeta.sgfSource` is not decorative; it names the primary record (an SGF, an original publication, or a specific secondary source with page/date) the beats were transcribed from. A documentary drafted from memory of a famous story, without a cited record backing the actual coordinates, is not ready.
2. **Flag disputes, don't flatten them.** Several canon-worthy anecdotes are contested in exactly the way that makes them worth telling carefully: the ear-reddening game's flushed-ears account is a widely repeated story about a bystander's observation, not a claim in the game record itself [@ear-reddening]; the Go Seigen-Shusai adjournment controversy involves a persistent, disputed allegation that a student supplied White's decisive move [@go-seigen-shusai]. Prose narrating either must say "according to the traditional account" or equivalent, not assert the contested part as settled fact.
3. **No marketing adjectives.** "Legendary," "epic," "genius," and their kin are cut in review. A sentence earns its place by naming a stone, a liberty, or a point; if a sentence in `prose` does neither, it is cut, per the house voice standard.
4. **`targetRank` needs a one-line reason**, stored in `gameMeta.lesson`: what, in glossary vocabulary, does stepping through this documentary teach, and is that lesson findable by a player at the stated rank — the same test [Pillar 3](./design-pillars.md#pillar-3--opponents-are-teachers-wearing-masks) applies to opponents applies here to games.
5. **Assertions are authored, not inferred.** Nothing in Part 1 runs an engine. Every `assertions[].text` is a claim its author is prepared to defend from the source record, not a paraphrase of what a bot might have said. This is the load-bearing difference from Part 2, below.

### Starter canon list

Seven picks, each verified against an independent source, spanning three centuries and both the classical and AI eras. This is a starting list, not a ceiling — Pillar 5's test ("would a traditional Go teacher recognize the practice") is the bar for adding a eighth.

| # | Game / moment | When & where | Players | Target rank | What stepping in teaches |
|---|---|---|---|---|---|
| 1 | The Ear-Reddening Game | 1846-09-11, Japan | Honinbo Shusaku (4d) B vs. Inoue Gennan Inseki (8d) W, B+2, 325 moves [@ear-reddening] | 10 kyu - 5 kyu | A quiet connecting move can outweigh a capture — the game's founding lesson in *why extend instead of take*. |
| 2 | The Game of the Century | 1933-10-16 to 1934-01-29, Japan | Go Seigen (5d) B vs. Honinbo Shusai (9d) W, W+2 [@go-seigen-shusai] | 5 kyu - 1 dan | Opening dogma isn't law: Black's opening moves at 3-3, a star point, and the center point were considered taboo before this game and standard soon after. Teaches that fuseki is judged by result, not tradition. |
| 3 | AlphaGo-Lee Sedol, Game 2, Move 37 | 2016-03-10, Seoul | AlphaGo B vs. Lee Sedol (9p) W [@alphago-move37] | 1 dan and above | A move nearly no human would play (a 1-in-10,000 shoulder-hit by AlphaGo's own model) can still be sound; teaches distrusting "nobody plays there" as a reason not to read a move out. |
| 4 | AlphaGo-Lee Sedol, Game 4, Move 78 | 2016-03-13, Seoul | Lee Sedol (9p) B vs. AlphaGo W, the only game AlphaGo lost [@lee-sedol-move78] | 1 dan and above | A wedge played into a position the engine had misjudged as settled; teaches that reading through a fight a program's evaluation calls closed is still a human's to attempt. |
| 5 | LG Cup Final, Game 1 | 2020-02-10, Korea | Shin Jinseo (9p) vs. Park Junghwan (9p) [@lg-cup-2020] | 5 kyu - 3 dan | A representative modern, whole-board fighting game between the era's two strongest players; already used as teaching material on public review forums, evidence its lessons are legible outside the room it was played in. |
| 6 | 43rd Guksu, Game 3 | 1999, Korea | Rui Naiwei (9d) vs. Cho Hun-hyun (9d), decisive game of the match [@rui-naiwei; @guksu] | 5 kyu - 1 dan | Rui, the first woman ever to reach 9 dan and the only woman to win a major open Go title, took this title by beating both Cho Hun-hyun and Lee Chang-ho, the two strongest players in the world at the time — a fighting spirit lesson as much as a technical one, and this platform's clearest single answer to "show me a great player who isn't a man." |
| 7 | A Handicap Game (Gray-Nagahara) | 1970-09, Tokyo | Geoffrey Gray (5k, amateur, London) B vs. Nagahara Yoshiaki (3d professional) W, 9-stone handicap, B resigned move 129 [@gray-nagahara] | 15 kyu - 8 kyu | A real amateur's actual mistakes, professionally commented: don't try to save every stone, separate the opponent's groups instead of only defending your own. The commentary's own diagnosis — "fear of a professional can drive an amateur into a defensive shell" — is a psychological lesson as much as a technical one, and it is the single pick here that shows a player at the target rank's own level rather than a legend playing above it. |

Picks 3 and 4 are conventionally told together (they are one match, two decisive moments) but ship as two separate documentaries: they teach opposite lessons — trust the engine's judgment; then, trust your own reading against it — and a single documentary that tried to hold both would blur which one the player just enacted, which is the thing Pillar 1 exists to prevent.

**Refusal condition: no completion badge over the canon list.** Seven-plus documentaries is an enumerable, completable set in exactly the shape [Opponent Cast](./opponent-cast.md#what-a-fixed-named-and-defeated-roster-refuses-to-become)'s eight-opponent roster is, and that document's own refusal condition against a "cast completion: 6/8" badge applies here on identical grounds: nothing in this application may render "documentaries watched: 4/7," a checklist of completed canon entries, or any other aggregate count derived from which classic games a player has stepped through — on a profile, a dashboard, or anywhere else. Neither Pillar 4's forbids list nor Pillar 5's names this pattern directly; this document closes the gap explicitly rather than leaving it to a future contributor's good judgment, the same way Mastery Model and Opponent Cast now do for their own enumerable sets.

## Part 2 — Broadcast mode

### What broadcast mode is

Broadcast mode is watching a real game — someone else's, live or already finished — with the legibility layer running over it, gated to the spectator's own rank. Where a documentary is one game, hand-narrated once and replayed identically for everyone, broadcast mode is any game, machine-annotated fresh for each viewer at whatever rank they've actually earned. It is Pillar 2's "training wheels" applied to spectatorship instead of to the spectator's own play.

The two modes can look similar in a screenshot — a board, a move list, a commentary panel — but the engine dependency makes them structurally different products, and that difference is the reason Part 2 cannot ship on Part 1's timeline. See "Phase dependencies," below.

### Rank-gated view: the same live moment, two spectators

Concretely: White has just invaded deep into Black's framework in the middle game of a live professional game. Two platform accounts are watching the same broadcast, same board, same clock. What each sees differs by design, not by accident:

| | 20 kyu spectator | 5 kyu spectator |
|---|---|---|
| Board and moves | Identical — the actual game, no lag differences between ranks | Identical |
| Overlay | The invading stone is marked; one sentence: "White just played inside Black's framework. If it lives, Black's territory there shrinks." | An ownership-estimate heat map over the contested area; a sentence naming the shape question: "White's stone has room to make a base here unless Black blocks now." |
| Vocabulary used | Only terms a 20 kyu account has been taught: liberty, atari, capture, territory | Adds connection, life-and-death; may reference eye shape directly |
| Numeric information | None — no win rate, no point estimate, no score graph | A plain-language trend only ("this exchange favored White slightly"), never a raw percentage |
| Above which rank raw numbers appear | — | Not yet; see below |

Pillar 2's own decision test — "raw win-rate deltas or point swings shown to players below the rank where those are actionable" is forbidden — sets the floor here directly: a 20 kyu account cannot act on "White's win probability rose 4%," so it is never shown one. A dan-level spectator can weigh that number against their own reading, so the same broadcast, watched by a 1 dan account, adds a live score-estimate graph the 20 kyu and 5 kyu views never render. The rank gate is not a subscription tier; it is the same legibility-layer discipline the platform already commits to for a learner's own post-game feedback, applied to the feed of someone else's game.

### Delay and spoiler etiquette

Two distinct concerns, both decidable:

**Never show an unplayed move.** The legibility layer may annotate moves that have already happened. It must never surface "the engine's top choice for the position as it currently stands" before a player has moved — not as a hint, not as a preview, not gated to any rank. Go has a documented, current problem with exactly this channel being exploited: engine-assisted move-relay cheating has caused an eight-year professional ban and a public accusation at a $200,000 international final [@qin-siyue-cheating; @chunlan-cheating]. A platform feature that renders a live engine suggestion for a position before the human across the board has moved is that same vector, regardless of intent. This is a hard refusal condition on any broadcast build, not a tuning knob.

**Relay delay, when we are not the tournament's own channel.** When broadcast mode relays a live feed we do not operate (an external tournament's game), a deliberate delay window before rendering to any spectator is standard practice in adjacent mind sports for exactly this collusion risk — chess enforces a much longer delay for over-the-board events for the same reason [chess's transmission-delay convention is the closest documented analog; Go-specific broadcast-delay policy was not found in sourcing for this document and should be confirmed against the actual relay's own terms before this ships]. Configure a delay per relay, default nonzero, and never render the legibility layer's engine-derived assertions faster than the official broadcast's own delay.

**Rank-gating is itself spoiler control.** A 20 kyu spectator who never sees a percentage cannot be spoiled by one — they read the board the way a beginner reads any unfamiliar game, which is calm by construction ([Pillar 4](./design-pillars.md#pillar-4--calm-by-construction)). A dan-level spectator who wants the result to stay a surprise chooses that for themselves (a "hide the outcome" toggle on replays), the same affordance a documentary's you-try branch already gives by never showing `accept` before the player tries.

### How watch-parties work in clubs

A club screening a broadcast is one room, one shared screen, many ranks. Two decidable design points follow from that:

- **The shared screen carries one host-set rank gate**, chosen by whoever is running the session — the room sees one overlay, at one vocabulary level, the way a teacher narrates at one level while advanced students think a move ahead silently. A personal device may subscribe to its own overlay at the viewer's *own or a lower* rank than the room's setting — never higher, since a rank gate exists to withhold what a player isn't ready for yet, and a shared room is not the place to route around that for one attendee.
- **Narrating for the room is a teaching act Pillar 5 wants recognized — but this document does not have the standing to grant it a lineage edge, and an earlier draft overstepped by implying it already could.** [Lineage and Clubs](./lineage-and-clubs.md#12-what-creates-an-edge--nothing-automatic) owns the `LineageEdge` schema, and every edge it defines is sourced from one specific completed teaching game, gated on the taught student's own explicit confirmation tap, with a 20-move minimum-substance bar. A watch-party narrating someone else's broadcast game has none of that: there is no single teaching game between the narrator and any one student, no `source_game_id`, no defined confirmation flow for a room instead of a pair. This document does not invent one. What actually happens today: narrating for the room earns nothing recorded, only the room's own memory of who explained it well — which is real, and consistent with how a physical club's institutional memory already works, but it is not a `LineageEdge`, and this section should not have implied it was. Extending the lineage graph to cover a group-teaching event like this is [Lineage and Clubs](./lineage-and-clubs.md#roadmap-obligations)' owed work, not this document's to specify unilaterally — see that document's Roadmap obligations for the resulting commitment.

Ritual is designed here the same way the plan already asks it to be for game start and resignation: a watch-party opens with everyone settled before the recording or live feed starts (no ceremony is skipped just because nobody is placing a stone), and closes with the room doing, together, a small counterfactual-replay exercise on the game's most contested moment — "what would you have played here" — which is Pillar 2's branching-replay instrument, repurposed as the room's own post-game discussion instead of one player's private feedback. This is Sutton-Smith's rhetoric of identity made concrete: the room isn't there only to learn the position, it's there because gathering around a shared game, at a fixed time, in a fixed place, is itself the belonging Pillar 5 exists to build.

## Phase dependencies

| Capability | Earliest phase | Why |
|---|---|---|
| Documentary player: static board, prose, you-try branches, reusing `lessons.json`/`tsumego.json` shapes, client-only | **Phase 1** | No accounts, no server state, no engine — `canon.json` ships next to the existing data files in exactly `weiqi-learn`'s current architecture. |
| The starter canon list's content (7 documentaries) | **Phase 1**, partially gated on **Phase 0** | Beats using only the current ten glossary terms ship with Phase 1; beats needing *moyo*, *joseki*, *tesuji*, *sente*/*gote* block on those terms existing in the corpus first — already a named item on the plan's content backlog. |
| Legibility layer: engine judgment translated into rank-sized assertions, in any form — live or run once offline over a finished SGF | **Phase 3** | The pillars document assigns the legibility layer to Phase 3 outright; it depends on the KataGo review service, which the platform plan's own risk mitigation defers to Phase 3. Running the engine once instead of continuously does not remove this dependency — the engine still has to exist. |
| Live spectating of the platform's own Play games | **Phase 2** | Needs the Durable Object WebSocket hub the plan already scopes for Phase 2 game rooms; broadcast mode's spectator delivery reuses that hub rather than inventing a second one. |
| Broadcast of an external live pro game (a feed we don't operate) | **Phase 3+**, plus an unresolved non-technical dependency | Needs a live feed ingestion path (unbuilt, not scoped by the plan) *and* the Phase 3 legibility layer; also needs relay rights to someone else's tournament feed, which is a licensing question this document does not resolve — see Roadmap obligations. |
| Replayed broadcast with engine-derived (not hand-authored) assertions | **Phase 3** | Same legibility-layer dependency as live; batch analysis still needs the engine to have run at all. |
| Replayed broadcast of a recent game with hand-authored commentary, no engine | **Phase 1**, but note it is then a documentary, not broadcast | If nothing here is engine-derived, this is Part 1's format applied to a recent game instead of a classic one — a legitimate thing to build early, but it should be named and authored as a documentary, not marketed as "broadcast," or the two products blur for no reason. |
| Club watch-party room mechanics (shared rank gate, lineage credit for narrating) | **Phase 4** | Depends on clubs and rooms existing at all, which the plan places in the Belong phase. |

## Roadmap obligations

This document commits future phases to the following, beyond what the plan and pillars already state:

- **Phase 1** gains explicit scope: a documentary player and a `canon.json` data file, built by extending `weiqi-learn`'s existing lesson and tsumego players rather than adding a new component — and specifically, you-try branches must validate against the *existing* tsumego-checking code with no modifications to it.
- **Phase 0** gains a concrete, checkable sub-item on its corpus-hygiene work: before the canon list above is fully legible, author glossary entries for *moyo*, *joseki*, *tesuji*, *sente*, and *gote* (or determine, term by term, that a documentary can be told without them — but that determination has to be made explicitly, not skipped).
- **Phase 3** gains a scope addition, not a new project: the legibility layer's assertion API, when built, must be general enough to serve two consumers from one implementation — a learner's own post-game feedback (its original scope in Pillar 2) and broadcast mode's live/replayed spectator assertions (this document's scope). Broadcast mode is the legibility layer's second consumer, not a second engine integration.
- **Phase 4** gains the watch-party room mechanic described above as a named feature, not an unspecified "clubs will figure this out" — and, per the correction above, gains it *without* a lineage-edge grant bundled in; that piece is [Lineage and Clubs](./lineage-and-clubs.md#roadmap-obligations)' to design and schedule, not implied here as already solved.
- **Open question for the board**, alongside the plan's existing decision list: relaying an external tournament's live feed for broadcast mode requires that tournament's or federation's permission. No phase resolves this by building it; it is a rights question to raise before Phase 3+ broadcast work is scheduled, not during it.
