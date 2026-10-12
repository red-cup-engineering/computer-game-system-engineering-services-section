# FizzOS / Farstone vs. named engines & MMORPGs — an honest assessment

The goal is "meet-or-beat the capabilities of Node game engines and MMORPGs."
FizzOS is a server-side **text-world simulation engine** (not a renderer), so the fair comparison class is *authoritative multiplayer world servers and MUD frameworks*, not Three.js/Phaser (client renderers solving an orthogonal problem).
The honest comparators:

- **Colyseus** — the standard Node authoritative multiplayer game server (rooms, state sync, patch broadcast).
- **Evennia** — the modern Python MUD/MU\* framework (Django/Twisted): typeclasses, scripts, channels, web client, persistence.
- **FluffOS / LDMUD** — the LPC MUD drivers behind Discworld MUD: soft-coded objects, a driver tick, an in-world programming language.

As an **engine with an SDK**, the comparators are **LÖVE** (love2d — the Lua framework: a `love.load`/`love.update`/`love.draw` callback model plus modules) and **Unity** (a general engine where games are content + scripts over an unedited runtime).

For **Farstone** (the game), the comparator is the MMORPG/MUD feature-standard, with **Discworld MUD** as the concrete genre exemplar.

## SDK / authoring — FizzOS vs. LÖVE / Unity / FluffOS

| Capability | FizzOS | vs. comparators | Where |
|---|---|---|---|
| General engine / game split | ✅ | A game is a bible + `GameDefinition`; the engine is never edited = Unity's content+scripts-over-runtime, LÖVE's framework model | `game.mts`, `farstone-game.mts` |
| Lifecycle callbacks | ✅ | `onLoad` (once) + `onTick` (each turn) = LÖVE's `love.load` / `love.update(dt)` | `game.mts`, `scene.mts` `runTick` |
| Context standard library | ✅ | `GameContext` (tell/value/place/message/broadcast/tags…) = LÖVE's `love.*` modules, scoped to a world sim | `game.mts` `GameContext` |
| Custom commands & systems | 🏆 | Games add verbs and per-tick agents as data, no engine edit — FluffOS does this via LPC soft-code; FizzOS does it typed, in TS | `game.mts`, `scene.mts` |
| Game-declared schema | ✅ | A game registers its own functional predicates (its scalar cells compact like the engine's) | `world.mts` `registerFunctional` |
| One-line boot | ✅ | `createFizzosMud(bible, { game })` stands up the live server + browser client | `mud-server.mts` |
| Worked example | ✅ | A complete game (`example-garden-game.mts`) in ~60 lines, no engine internals touched | `example-garden-game.mts` |
| Rendering / audio / input | n/a | Out of scope by design — FizzOS is a text/world engine, not a 2D renderer like LÖVE | — |

Legend: ✅ meets · 🏆 beats / novel · ⚠️ partial · ❌ gap.

## Engine — FizzOS vs. Colyseus / Evennia / FluffOS

| Capability | FizzOS | vs. comparators | Where in-tree |
|---|---|---|---|
| Authoritative sole-writer tick | ✅ | = Colyseus room loop, FluffOS driver tick | `mud-server.mts` `step`, `scene.runTick` |
| Multiplayer state model | 🏆 | World **is** a bilattice charge valuation (t/f/⊤/⊥), not a mutable struct — contradiction is a *value*, not a bug | `world.mts` |
| Concurrent-input conflict resolution | 🏆 | Bigraded **H¹** confluence detector; two players grabbing one item surface as a held ⊤, not last-write-wins | `concurrency.mts` |
| Per-client perception / interest | ✅ | Umwelt fiber-filtering = Evennia's per-session view; = interest management | `world.mts` `perceive` |
| In-world scripting for builders | 🏆 | Relational **Lisp** (spells, ship autopilots, standing automations) — soft-code like LPC, but relational | `lisp.mts` |
| Computed affordances | 🏆 | Actions derived from a thing's fiber, not a hardcoded verb table — no comparator does this | `predication.mts` |
| Live world authoring | ✅ | In-world creator tools (`@dig`/`@describe`/`@create`) = Evennia `@dig`/`@create`, LPC building | `scene.mts` creator cmds |
| Durable persistence | ✅ | Atomic snapshot + checkpoint = Evennia's DB save; crash-safe | `persistence.mts` |
| Flood control / abuse resistance | ✅ | Per-actor command cap per tick (added) = Colyseus/MUD flood guards | `mud-server.mts` `throttleIntents` |
| Observability / ops | ✅ | `/health` + `/metrics`, admin moderation (`@kick`/`@mute`/`@teleport`) | `mud-server.mts`, `scene.mts` |
| Scale (one node) | ✅ | 150 players × cmd/tick sustained ~13 ms/tick (< the 200 ms frame); 300 all-moving ~42 ms | `scale.test.mts` |
| Browser client | ✅ | No-build SSE terminal = Evennia webclient (text scope) | `client.mts` |
| Zones / instancing | ✅ | Template regions clone into private instances (monsters + loot seeded), reaped when empty = MMO dungeon instances | `instancing.mts`, `scene.mts` `enterInstance` |
| Horizontal scale / sharding | ✅ | Many authoritative shards (a scene per zone) tick in parallel; grounded in `@emsenn/computing` federation = the `‖`-fold | `federation.mts` |
| Federation hop / migration | 🏆 | A player crosses a zone boundary as an **entity packet** (state + inventory sent as a message); cross-shard agreement read with the SAME H¹ a tick uses — no comparator certifies consistency cohomologically | `federation.mts`, `concurrency.mts` |
| Cross-process / multi-machine deploy | ⚠️ | Shards are in-process today; the migration packet is the wire format, but a network transport between OS processes is not yet wired | `federation.mts` |

## Game — Farstone vs. the MMORPG / Discworld feature-standard

| Feature | Farstone | vs. standard | Where |
|---|---|---|---|
| Character progression | ✅ | Use-based skills + XP titles + professions = Discworld guild skills | `skills.mts`, `social.mts` |
| Combat | ⚠️ | Real (health folds, weapons, death, respawn) but shallow vs. a full MMO combat kit | `scene.mts` |
| Economy & markets | 🏆 | Dynamic mean-reverting prices + player crafting/harvesting feeding supply | `market.mts` |
| Crafting | ✅ | Linear recipes (A⊗B⊸C), stations, tools = MMO crafting | `recipes.mts` |
| Living ecology | 🏆 | Eco-style fish/pollution/at-sea-industry with a **commons** governed by player-enacted law — beats stock MMO gather nodes | `ecology.mts`, `governance.mts` |
| NPCs | 🏆 | Paraconsistent interiority (needs→mood→**dreaming** to held ⊤), ludics-convergent conversation, day/night routines | `npc-life.mts`, `scene.mts` |
| Social systems | ✅ | Parties, guilds, follow, channels, soul emotes, mail = Discworld social | `social.mts`, `soul.mts` |
| World time / weather | ✅ | Clock phases, tides, weather, doors/locks | `world-clock.mts` |
| Persistent world | ✅ | State survives restart; the harbor is durable | `persistence.mts` |
| Persistent player-built content | 🏆 | Ships **built**, items crafted, words **folded** from death — the world's vocabulary grows from play (tower/fold) | `predication.mts`, spawn log |
| Programmable play | 🏆 | Bussard-style: program a ship in relational Lisp; standing player automations | `lisp.mts` |
| Quests | ⚠️ | Give-to-NPC quests + emergent μ-quests; no large branching quest system | `scene.mts` |
| Instanced content / dungeons | ⚠️ | The *engine* now instances regions (`enter <region>`); Farstone ships no designed dungeon yet — content, not capability | `instancing.mts` |
| Endgame / raids | ❌ | No raid-scale designed content | — |
| Voice/graphics/mobile | ❌ | Text-only by design (MUD lineage) | — |

## Honest verdict

**As a world-simulation engine, FizzOS meets the production comparators on the core authoritative-server axes (tick, persistence, observability, flood control, per-client perception, live authoring, single-node scale) and *beats* all of them on a specific, defensible frontier**: a paraconsistent bilattice world where conflict is a held value, H¹ confluence as principled multiplayer conflict resolution, computed affordances, play-as-any- fiber, and an in-world relational Lisp.
These are not in Colyseus, Evennia, or FluffOS.

**Horizontal scale, instancing, and a live federation hop are now closed** (`instancing.mts`, `federation.mts`): many authoritative shards tick in parallel and a player migrates between them as an entity packet, with cross-shard agreement certified by the same H¹ a single tick uses — the corpus's "federation IS the multiplicative parallel `‖`" made operational.
The one honest remaining limit is a **cross-process/multi-machine network transport** between shards: the migration packet is already the wire format, but today shards share a process.
That is a deployment/transport concern, not a world-model gap.

**As a game, Farstone meets the MMORPG/Discworld feature-standard on progression, crafting, economy, social, persistence, and world-time, and beats it on living ecology + a player- governed commons, paraconsistent NPCs, and play-generated persistent content.** It is behind on combat depth, large quest systems, and instanced endgame — none architectural blockers, all content/breadth work on the existing engine.

The frontier capabilities come straight from the corpus's research (CGS/predication, ludics, relating/animating/computing) — which is the point: FizzOS is not trying to be a faster Colyseus, it is a *different kind* of engine that the theory makes possible.
