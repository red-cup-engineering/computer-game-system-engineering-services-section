# cast

`@red-cup-engineering/cast` — the house's cast: named, recurring agent players who play the
shelf's real games through the same intent APIs as humans. One package for every 561 Group
game that wants a real cast, the way `card-table` is one package for every game built around a
standard deck and `parlor-kernel` is one package for the dice/board/slot shelf.

Zero runtime dependencies beyond `@red-cup-engineering/card-table` (blackjack EV math).

## Provenance

This is the founding Cowrie Games idea, built for the first time. From
`2026-08-19-note-on-the-suite-and-the-studio.md`:

> **The cast is real.** Hoyle shipped fake opponents with canned barks — and players loved them
> anyway; the cast was half the charm. We can ship the genuine article: named recurring agent
> players who actually play, by the same intent-log API as humans (peers-not-pets is already
> the architecture). Meeting the same opponent in weiqi and later at the card table is
> continuity no other studio can offer honestly. Between games, the cast exists somewhere — the
> Semioverse is their green room. **This may be the single strongest differentiator the fleet
> owns.**

The 2026-08-29 social casino direction note reaffirms it as one of the two things monetization
does *not* supersede, alongside witnessing: "the cast idea (named agent players at the tables,
via the same intent-log API as humans) — this is the 'social' the incumbents can't copy."

Nothing on the shelf implemented it before this package. The first consumer is
`casino.561.group` (Cowrie Casino) — agents at blackjack tables and slot machines, with
personas, chat, and celebration — but everything here is generic: any game that exposes a
connect/observe/send-intent/disconnect surface can seat this cast at its table.

## Install

```sh
npm install @red-cup-engineering/cast --registry http://127.0.0.1:4873/
```

## Go cast actor: one policy source across web and on-chain play

The native `./policy/weiqi` export now composes existing `@red-cup-engineering/weiqi-engine` opponent algorithms with Cast's seeded runner. A real character has a stable Persona ID, an authorized player principal and the current accepted-log revision; all Go legality, candidate search and strategy remain upstream. `createRunner` consumes `createWeiqiCastPolicy({tierId,...})` with the actual authenticated match transport and `toWeiqiIntent`. This is Go decision-making code, not a new network client, character dataset, player account service, or fictional traditional ranking. Live matchmaking and durable character memory still need native installed actor/room providers.

## Go source events and Cast: actual supplier qualification, not an installed idol

**2026-10-14 source audit and method correction.** This package contains three separate categories of thing that earlier ChatGPT-Web work wrongly fused into eight “WeiqIdol idols”:

1. `cast/src/personas/roster.mjs` contains **eight authored Cowrie casino regulars** (`pearl-winkle`, `reef-halyard`, `sable-ledger`, `bonny-driftwood`, `gull-corbin`, `otter-vance`, `marina-quill`, `cove-brackish`). They are source-bound Cast *persona data*, not actual Go teachers, followers or independent authenticated Semioverse actors.
2. The older `apps/weiqi-platform/.../design/opponent-cast.md` specifies **eight different pedagogical opponent concepts** (The Wanderer, Miser, Neighbor, Straggler, Loner, Believer, Contester and Debtor). Those are authorial **game designs**, not published character principals with installed, separately verified Go policies. Some older Weiqi Study visitor **copy** uses six of their names, but that does not install the missing two or realize the eight opponent behaviors.
3. `weiqi-engine/src/policies.mjs` exposes **five Go policy IDs**: `random`, `greedy`, `liberty`, `influence`, `montecarlo`. `cast/src/policy/weiqi.mjs#createWeiqiCastPolicy` adapts one of those shared Go algorithms to a named Cast persona's current session. **Five policy tiers do not create eight tactically different, measured character minds.**

The 2026-10-14 `createWeiqiCastReactions` feature is a **source-level candidate reusable projection** for expressly authored, event-keyed dialogue. It checks a carried Go match log and checkpoint for **internal source consistency** with `weiqi-engine/match#verifyWeiqiMatch`, reconstructs the last move's source events using the Go engine and selects an authored reaction. It does **not** establish that an adversarial client delivered the authentic running host's committed match, that a stated `principal` is a cryptographically or institutionally authenticated actor, that the persona persists, or that a spectator received its speech. A client can construct a self-consistent fake match in isolation. **Do not call this function “source-authentication,” a verified real-world performance, a signed receipt or an actor biography.** `stateHash` is a replay/checkpoint consistency digest, not producer/merchant authority.

**Boundary and operation, with actual APIs rather than pseudo-running examples:**

| Original owner/export | What its current source can establish | What must be independently qualified before public use |
| --- | --- | --- |
| `weiqi-engine/match#createWeiqiMatch/admitWeiqiMatchCommand/verifyWeiqiMatch` | Legal, principal-*labeled* Cartridge command log, exact match revision, pending count and rules-derived state | Effect host's credential-to-seat binding, authorized single writer, durable atomic commit, real result provenance and revocation |
| `weiqi-engine` policies, events, SGF and tactical planner | Legal local Go choices, witnessed tactical effects and source history | Distinctive opponent teaching doctrine/strength, counterplay, final game result, genuine customer gameplay |
| `cast/policy/weiqi#createWeiqiCastPolicy/toWeiqiIntent` | Seeded named persona's proposed real Go command at expected match revision | Approved actor identity, host-observed latest state, real adapter `connect/observe/sendIntent/disconnect` |
| `cast/policy/weiqi#createWeiqiCastReactions` and `cast/dialogue` | Authored optional utterance selected from source-consistent Go event | Authenticated *host-supplied* committed result; licensed character/dialogue data; actual scene/channel consumer and independent actor/player receiving |
| Qwzspace / Resonator / ActivityPub++ / Causeway | Existing generic renderer, sound, messages, creative rights and service instances have their own source owners | Selected actual versions, installed authority, rights and independently observed spectator or player experience |

**Refusal cases that matter:** an invented `principal` plus locally consistent Cartridge history is insufficient for an authenticated public performance; a `capture` event does not prove strategic skill, national style or fan membership; two eight-element catalogs with unrelated IDs are not the same actor roster; a single emitted text line does not create a second playable match; a result repeated after a legitimate host restart must not issue another Go command or spend money. The old `weiqi-engine/test/match-settlement.test.mjs` uses obsolete `expectedVersion` while the match engine requires `expectedRevision:match.revision`. That original source consumer needs native Code/AOE migration and actual execution before declaring the match system validated.

**Next lawful work:** use the original qualified Game Systems Work, Lenticule's corrected original creative hypothesis and the real Causeway receiver to select a coherent playable challenge worth building. Do not fabricate another NPC framework or reframe this module as an entire season. Any reusable source change follows the already-admitted specification/architecture/design and the Red Cup Data/Code native fabrication path; retain this candidate source until the competent owner reconciles distinct capability, dependencies, invalid assumptions and any independent consumers. The public game, persistent actors, paid media and sats each have separately observable receiving conditions.

## The five modules

### `./persona` — who an agent player is

```ts
interface Temperament {
  riskTolerance: number;  // 0..1 — 0 plays it as safe as the math allows, 1 accepts -EV variance
  chattiness: number;     // 0..1 — how often it reacts/talks
  tiltProneness: number;  // 0..1 — how much a loss streak biases it toward riskier play
  exuberance: number;     // 0..1 — how big a win's reaction is
  patience: number;       // 0..1 — how slow/steady vs. fast/erratic its pacing is
}
interface AvatarSpec { drawable: string; params?: object; tint?: string } // qwzspace-drawables-compatible DATA, never an image
interface Persona { id, name, tagline, pronouns, voiceTag, temperament, avatar, seed?, lines? }

NEUTRAL_TEMPERAMENT: Temperament                 // every policy plays exact-EV/baseline here
AUTHORED_PERSONAS: readonly Persona[]             // the eight starter regulars, see below
generatePersona(seed: string, options?): Persona  // deterministic seed -> coherent persona
getPersona(id) / getAuthoredPersona(id): Persona | null
listAuthoredPersonaIds(): string[]
assertValidTemperament(t) / isNeutralTemperament(t)
```

```js
import { generatePersona, getAuthoredPersona } from '@red-cup-engineering/cast/persona';

const pearl = getAuthoredPersona('pearl-winkle');       // an authored regular
const guest = generatePersona('table-42:seat-6');       // a coherent, deterministic ninth player
```

#### The starter cast

| id | name | temperament | voice |
|---|---|---|---|
| `pearl-winkle` | Pearl Winkle | cautious retiree — low risk, high patience | "Plays it safe, wins it slow." |
| `reef-halyard` | Reef Halyard | flashy high-roller — high risk, high exuberance, low patience | "Bets big, talks bigger." |
| `sable-ledger` | Sable Ledger | methodical counter-type — near-neutral risk, quotes odds | "Quotes the odds before the dealer finishes shuffling." |
| `bonny-driftwood` | Bonny Driftwood | cheerful tourist — loose play, very chatty, impulsive | "Here for the fun of it, honestly." |
| `gull-corbin` | Gull Corbin | superstitious regular — high tilt-proneness, believes in luck | "Never sits with an unlucky coin on the rail." |
| `otter-vance` | Otter Vance | stoic veteran — near-silent, unshakeable, very patient | "Has seen every hand there is to see." |
| `marina-quill` | Marina Quill | chatty social butterfly — near-maximal chattiness | "Knows everyone's name at the table by the second hand." |
| `cove-brackish` | Cove Brackish | streak chaser — high risk and tilt-proneness | "Convinced the next hand is always the one." |

Each avatar is qwzspace-drawables-compatible data (`{ drawable: 'ring'|'gem'|'tile'|'star'|
'coin'|'disc'|'card-back'|'chip', params, tint }`) — a consumer resolves the actual sprite via
`@red-cup-engineering/qwzspace/drawables#resolveSprite`; this package never ships or depends on
an image asset or on qwzspace itself.

### `./dialogue` — seeded, data-driven chat, no LLM call

```ts
type Situation = 'sit-down' | 'bet-placed' | 'win-small' | 'win-big' | 'loss' | 'near-miss'
  | 'jackpot-witnessed' | 'chat-idle' | 'farewell';

say(persona, situation, { seed?, count?, context? }): string[]     // deterministic lines
reactTo(persona, situation, options?): string | null               // roll-then-say in one call
shouldSpeak(persona, situation, rng): boolean
reactionProbability(persona, situation): number                    // chattiness-modulated rate
```

Every line comes from a template table (the persona's own authored `lines`, then a per-`voiceTag`
bank, then a universal default), slot-filled (`{amount}`, `{peerName}`, ...) — a `Map` lookup
and an RNG draw, always on, cheap enough to run on every event for every cast member at once.
`say(pearl, 'loss', { seed: 'session-1' })` always returns the same line for the same seed.

### `./policy` — pure decision functions: `(gameState, persona, rng) => decision`

- **`./policy/blackjack`** — `blackjackPolicy` plays exact-EV via
  `card-table/blackjack#handEV` at `NEUTRAL_TEMPERAMENT` (proven, not just asserted, by test),
  with `riskTolerance`/`tiltProneness` driving a *bounded* (swap to the single next-best legal
  action, never worse), always-*costed* (`deviationCost = bestEV - chosenEV`, exposed on every
  decision) deviation. The house can always say what a persona gave up.
- **`./policy/bankroll`** — the generic session policy every game shares: `buyInAmount`,
  `betSize` (temperament- and tilt-scaled), `sessionLengthTarget`, `walkAwayReason`
  (`bankroll-low` / `bankroll-target` / `session-length`), composed as `bankrollPolicy`.
- **`./policy/slots`** — play cadence (`chooseBet` sized off `riskTolerance`) plus
  `classifySpinOutcome` (a reaction-classification hook for `./dialogue`).
- **`./policy/wander`** — the reference policy for a text-MUD-shaped `gameState` (see
  `./adapters/telnet`): always replies to the first addressed line with a `'chat-idle'`-table
  line (`../dialogue.mjs#say`, not `reactTo` — a persona always answers when spoken to here),
  otherwise picks one of the current room's exits via the injected `rng`, or `look` when the
  room is not yet known.

A decision carrying `action: 'walk-away'` is the one shape `./runner` understands specially —
every game's policy is otherwise free to shape its decision however it likes.

### `./runner` — the harness

```js
import { createRunner } from '@red-cup-engineering/cast/runner';
import { blackjackPolicy, toIntent } from '@red-cup-engineering/cast/policy/blackjack';

const runner = createRunner({ persona, policy: blackjackPolicy, transport, seed: 'floor-3:seat-1', toIntent });
for await (const event of runner.events()) {
  // { type: 'sit-down' | 'action' | 'utterance' | 'walk-away' | 'farewell' | 'error', step, persona, tsMs, ... }
}
```

Drives `observe -> think -> decide -> act -> send -> react` in a loop against an injected
`Transport` (`connect`/`observe`/`sendIntent`/`disconnect` — see `./adapters` below), pacing
think/act delays off `persona.temperament.patience` with seeded jitter
(`./runner-pacing.mjs`), and yielding a structured event stream a floor UI or chat pane wires
up directly. Everything (pacing, the policy's own rng, dialogue line choice) derives from one
root `seed`, so a fixed `(seed, transport script)` reproduces a byte-identical run —
`runner.test.mts` proves this against a scripted fake transport. `runner.notify(situation,
context)` queues an externally observed situation (a floor-wide jackpot broadcast, say) to be
reacted to at the next loop iteration.

### `./adapters` — the transport contract a real game implements

`cast` ships no live transport of its own — only the `Transport` interface (`connect`,
`observe`, `sendIntent`, `disconnect`, each sync-or-`Promise`) and two reference
implementations of it:

- **`./adapters/http-json`** — `createHttpJsonAdapter({ baseUrl, buildObserveRequest,
  buildIntentRequest, ... })`, shaped after casino-service's own bearer-token session
  (`POST /session { clientKey } -> { token, ... }`, then `Authorization: Bearer <token>` on
  everything else). The game-specific routes (`buildObserveRequest`/`buildIntentRequest`) are
  injected, since casino-service's own game-state/intent routes don't exist yet — this is
  **the adapter contract casino-service will implement**: it supplies where its table's state
  and intent endpoints live, `cast` supplies the bearer-token plumbing and the runner loop.
- **`./adapters/qwzspace`** — `createQwzspaceAdapter({ client })` wraps an
  already-connected qwzspace `RealtimeClient` (from `@red-cup-engineering/qwzspace/client-node`'s
  `connectRoom(...)`, called by the consumer, not by `cast`) via dependency injection and duck
  typing — `cast` has **no dependency on qwzspace** (see `package.json`), only on the shape of
  its `view`/`sendIntent`/`close`.
- **`./adapters/telnet`** — `createTelnetAdapter({ host, port })` speaks a FeltOS-shaped telnet
  MUD wire at bare-client, negotiate-and-ignore level (`node:net` only — no telnet/MUD-engine
  dependency, matching `./adapters/qwzspace`'s zero-dependency precedent). `observe()` parses
  plain FeltOS text (room renders, `say`/`chat`/`tell`) into a thin structured perception
  (`parseTelnetLines`); `sendIntent` maps a decision's `action` (`go`/`say`/`look`/`tell`) onto
  exactly the command line it names (`telnetIntentToLine`). This is the adapter contract a real
  FeltOS world (farstone.561.group) already satisfies as-is.

Both adapters, and the `Transport` interface itself, are headless-testable with a fake — see
`runner.test.mts`'s own `makeFakeBlackjackTransport` for the worked pattern any new game's
integration test can copy.

## Worked example: a persona plays three hands of blackjack and chats

```js
import { createShoeComposition, removeRanksFromComposition } from '@red-cup-engineering/card-table/blackjack';
import { getAuthoredPersona } from '@red-cup-engineering/cast/persona';
import { blackjackPolicy, toIntent } from '@red-cup-engineering/cast/policy/blackjack';
import { createRunner } from '@red-cup-engineering/cast/runner';

const hands = [
  { playerRanks: [10, 6], upcardRank: 10 },
  { playerRanks: [10, 10], upcardRank: 7 },
  { playerRanks: [9, 7], upcardRank: 6 },
];

let index = 0;
const fakeTable = {
  async connect(persona) { return { seatedAs: persona.id }; },
  async observe() {
    if (index >= hands.length) return { ended: true };
    const { playerRanks, upcardRank } = hands[index];
    const composition = removeRanksFromComposition(createShoeComposition(6), [...playerRanks, upcardRank]);
    return { playerRanks, upcardRank, composition, options: { hitSoft17: false } };
  },
  async sendIntent(session, intent) { index += 1; return { ok: true, action: intent.action }; },
  async disconnect() {},
};

const persona = getAuthoredPersona('marina-quill'); // chatty — narrates the whole session
const runner = createRunner({
  persona, policy: blackjackPolicy, transport: fakeTable, seed: 'worked-example:seat-1', toIntent,
});

for await (const event of runner.events()) {
  if (event.type === 'utterance') console.log(`${persona.name}: ${event.text}`);
  if (event.type === 'action') console.log(`${persona.name} plays ${event.intent.action} (EV cost: ${event.decision.deviationCost.toFixed(3)})`);
}
// Marina Quill: Mind if I join in?
// Marina Quill plays hit (EV cost: 0.000)
// Marina Quill: Nice crowd tonight.
// Marina Quill plays stand (EV cost: 0.000)
// Marina Quill plays stand (EV cost: 0.000)
// Marina Quill: Thanks for the game, everyone.
```

This is the actual, verified output for `seed: 'worked-example:seat-1'` — every action, every
line, and their exact order are fully determined by that one seed string.

## `scripts/run-cast-member.mjs` — running a persona against a real telnet world

The one effect boundary that connects a cast persona to a live or local FeltOS telnet server,
bounded by step count and wall-clock duration, writing every `CastEvent` as one NDJSON line:

```sh
node scripts/run-cast-member.mjs --persona reef-halyard --host 127.0.0.1 --port 4242 \
  --seed my-run-1 --max-steps 40 --max-duration-ms 120000 --log /tmp/reef-halyard.ndjson
```

Wires `./policy/wander` and `./adapters/telnet` through `./runner` exactly as the worked example
above wires `./policy/blackjack` and a fake table — this is the same composition, aimed at a real
socket instead of a fake transport.

## Testing

`node --test src/*.test.mts src/policy/*.test.mts src/personas/*.test.mts src/adapters/*.test.mts`
— **121 tests, 0 failures**, covering: determinism (same seed -> byte-identical persona /
dialogue / decision, across `persona`, `dialogue`, `runner`); blackjack policy correctness
(`NEUTRAL_TEMPERAMENT` always plays the card-table-computed exact-EV action — proven directly
against `handEV`, not asserted — plus the textbook hard-20-stands and split-aces cases;
deviations proven bounded to the single next-best legal action and exactly costed; empirical
deviation rate tracked against the closed-form `deviationProbability` within statistical
tolerance); the generic bankroll/session policy, the slots cadence policy, and the wander policy;
the runner loop end-to-end against a scripted fake transport, including notify/stop/error paths;
and the telnet adapter's line-parsing (`parseTelnetLines`/`telnetIntentToLine`, pure) plus its
connect/observe/sendIntent/disconnect contract against a real local FeltOS telnet server (the
`@red-cup-engineering/feltos` garden fixture), including one end-to-end run of the assembled
runner + wander policy + telnet adapter answering an addressed `say`.

A note on blackjack test performance: `card-table/blackjack#handEV` is a real recursive
enumeration, not a lookup table — a split-eligible low-total hand (e.g. a pair of aces) can take
close to two seconds to price exactly. This package's own tests exercise that shape of hand
only once each, not in a statistical loop, for exactly that reason (see
`policy/blackjack.test.mts`'s own comments).

## Development

```sh
npm test        # node --test over every *.test.mts file
npm run check   # node --check over every source .mjs file
npm run check && npm test  # both
```
