---
name: the-living-server
description: How TAB becomes a real multiplayer MUD — a "richer-than-normal normal MUD." Closes the gap where NPCs lived richer lives than players: the daemon (serve.mjs) ticks the world, drains per-session .inbox in a fixed total order, and pushes each session its command output plus a PERCEPTION DELTA. The two pillars are (1) a rich command surface in makeSession that wires the EXISTING morphisms (say/tell/emote, attack/flee, eat/rest, give, score/skills, mail) to player verbs — exposure, no new simulation; and (2) perceive.mjs, the live "you see / you hear" stream computed off the substrate's own apparatus (dual-filed utterances, containedBy diffs, injury cells, weather/bell changes) within a tick window, replay-deterministic. Grounded in scripts/serve.mjs, scripts/play.mjs, being/doing/observing/perceiving/perceive.mjs, and the say/mail/fight/needs/health morphisms.
---

# The living server — a richer-than-normal normal MUD

## The gap this closes

The engine had deep simulation already: needs that decay and a mood that bands
(`#needing`), a body-graph health model where capacities are derived from injury cells
(`#health`), combat that resolves as a bilattice meet with no RNG (`#fighting`), speech
as ambient predication (`#saying`), async mail as letter entities in a mailbox place
(`#mailing`), skills, factions, and a Director wired into the daemon. NPCs used all of
it — they got hungry, decided, moved, broke down, fought.

But the player command surface — `makeSession` in `scripts/play.mjs` — exposed only
`look`, the six movement directions, `take`/`drop`, `inventory`, `who`, and `?`
(affordances). The state of affairs, stated plainly: **NPCs lived richer lives than
players.** A player could walk the world and pick things up; an NPC could pursue a need,
strike a rival, and spiral. The simulation was deep and the player was thin.

The goal this note records (this is intent, stated as intent) is a **"richer-than-normal
normal MUD"**: the bread-and-butter MUD verbs every player expects — say, tell, emote,
attack, flee, eat, rest, give, score, mail — riding the deep sim that already exists. Not
exotic verbs, not time-travel sight; the normal MUD, made richer because every normal verb
is backed by a real simulation instead of a flag.

## The two pillars

### Pillar 1 — a rich command surface (exposure, not new simulation)

`makeSession` is the player half of the firing mechanism: it reads a line, turns it into
an intra-action, and lets the autonomous tick keep running around the player (the file's
own framing — `mover: "session"` is "who pulls the trigger" where the NPC already proved
the trigger). The work of pillar 1 (intent: as it is being built) is to add player verbs
that call the morphisms **already on disk** — no new columns, no new arithmetic:

- **say / tell / emote** → `#saying`. `say` mints an utterance entity `located-in` the
  speaker's room; `tell` is the directed variant, `located-in` the listener and reified
  with a `told-to` cell. The morphism already returns `heardBy`.
- **attack / flee** → `#fighting`. `attack({root, agent, target, t})` settles both beings
  and resolves the contest by composition (`truthMeet`), filing a wound via `#health.injure`
  on a hit or clash. `canAttack` is the availability oracle.
- **eat / rest** → the `need:*` cells `#needing` reads; a satisfied need supersedes the
  decayed one append-only (`needsOf` settles `need:*` as functional).
- **give** → the same `located-in` `changing` that `take`/`drop` already use, retargeted at
  another actor.
- **score / skills / practice** → reads off the settled fiber: `#needing` for mood/band,
  `#health` for capacities and injuries, `skill:*` cells for skills.
- **mail** → `#mailing`. `mail` files a letter entity in `mbox:<owner>`; `hasMail` and
  `readMail` are local reads of the mailbox place; reading `changing`s the letter's `read`
  cell true (append-only — the unread past stays on the trace).

Every one of these is a player verb wired to a morphism that NPCs already use. The
simulation is not extended; it is **exposed**. The same `t`-anchoring `play.mjs` already
does for moves (`tick:NNNNNN/play:NNNNNN`, sorting after this tick's ambient rows and
before the next) carries each new verb's rows into their tick and keeps replay
deterministic.

### Pillar 2 — the perception delta (`perceive`)

A command surface lets you *act*. What makes a place feel **inhabited** is what you perceive
between your commands — arrivals and departures, speech you overhear, blows you witness, the
weather turning. That is `being/doing/observing/perceiving/perceive.mjs` (`#perceiving`),
new this work.

Where `look` is a **snapshot** (the room as it is now), `perceive` is the **delta** — the
"you see / you hear" lines a MUD prints between your commands. The file states its own place:
`perceiving/` nests under `observing/` as a sibling of `look`/`needing`/`storylog`; it reads
the trace into a derived view and changes nothing. And it adds **no new column** — every line
is computed off the substrate's own apparatus:

- **Speech.** Utterance entities (`kind=utterance`) the dual filing has cached in the
  observer's room (`say`) or on the observer (`tell`, via the `told-to` anchor), minted within
  the tick window, excluding the observer's own. Because a heard utterance is already
  `located-in` the listener's frontier (the chat side of "perception as Umwelt filter"),
  `perceive` only has to surface the ones that are **new**.
- **Movement.** Arrivals and departures, by diffing who is co-located **now**
  (`containedBy(loc)`, filtered to actors) against the set the caller passed from last call
  (`prevHere`). Dual filing makes "who is here" a local read; the diff is the narration.
- **Harm.** `injury:<part>` cells filed on a co-located actor (or one who just left) within
  the window — a strike you witness, rendered "reels from a wound to the <part>." These are
  the very cells `#fighting` files through `#health.injure`.
- **Ambient.** The world acting on itself — `weather` turning to/from `fog`, the
  `a-brass-bell` `ringing` — surfaced only when the value **changes** across the window
  (`latest(...,{bound})` before vs. after), so a steady state is silent and a turn of the tide
  is not.

**Tick-windowing.** A tick stamp is `tick:NNNNNN[/...]`; `tickOf` parses the leading number,
so pre-tick rows (`login:`, `seed:`, `cli:`) read as tick 0 and never fall inside a window
> 0. A perception is computed over the half-open window `sinceTick < n <= nowTick`. The
collected events are sorted to a stable order before they are emitted. Because every line is
a deterministic function of the trace plus the passed window, **a replay perceives
byte-identically** — perception is as replay-deterministic as the fold it reads from.

## Why this is the server, not a feature

`scripts/serve.mjs` is the daemon, and it is the **sole world-writer**. Sessions never touch
the log; they enqueue input on disk (`.inbox/<session>.jsonl`, one command per line). Under a
busy-guard so a tick and a drain never overlap, the daemon runs one cycle:

1. **tick** — `ticking({root, dimension})`: one autonomous advance, the world acting on itself
   before it serves input.
2. **drain** — visit sessions in **sorted name order**, lines in **file order**, each input
   taking the next value of a **server-wide monotonic counter**. The whole batch this tick gets
   one total order, and because the order is a function of the on-disk queue (not of wall-clock
   arrival), concurrent sessions' moves settle deterministically and identically on replay.
3. **output** — write each session's command output to `.outbox/<session>.log`, and mirror it
   to any attached TCP socket (a raw `telnet`/`nc` client sees its replies live; the disk log
   stays authoritative).

That loop — tick the world, drain input in a fixed total order, push each session its output —
**is** the loop of a real multiplayer MUD. Wiring the perception delta into step 3 (intent: so
each session receives its `perceive` lines alongside its command output, with the session
holding the previous `hereNow` set to diff against) is what closes the circle: between your
commands, the daemon shows you the world that moved while you were deciding. And the whole
thing runs on an **append-only, content-addressed log** — the only nondeterministic input
(packet arrival) is frozen into the drain order once, so the living server is still a forkable,
replayable trace.

## What's still thin / next (intent, not fact)

- **Accounts / auth.** Login is **name-only** today: a session names itself, slugifies to an
  actor id, and resumes-or-creates on disk. `serve.mjs` leaves a hook (`account`, a hashed
  `secret` cell) but nothing beyond the name gates a session yet.
- **The time-travel / ⊤-sight verbs are deferred.** The substrate supports fork/replay/diff and
  holds contradiction (⊤) as first-class, but the *player-facing* verbs for those are not part
  of the normal-MUD surface this work builds. Normal verbs first.
- **Balance tuning.** As the prior journals record honestly, a dramatic famine still doesn't
  emerge — NPCs feed themselves on the current map. That is a numbers pass (resource density vs.
  map size, decay vs. travel time, Director aggressiveness), the Tynan playtest loop, not a code
  fix — and it is orthogonal to this server work.
