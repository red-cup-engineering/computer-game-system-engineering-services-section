---
name: tsander-design
description: Design note (research + design only, NO game code) for Tsander — a terminal-WIREFRAME space-flight game ("Elite" knockoff) built ON the 561-group computer, made weird by the machine's federation (galaxy = tensor-merge of players' world-traces), paraconsistent settling (a star system settles from a contested trace; disagreement = ⊤ = a Schrödinger system held contested), the principal/recognition account model (reputation = recognition, contested rep = ⊤, factions = coalitions), and belnap (you program your ship in the computer's native paraconsistent Lisp). Tsander←Tsander is the naming homage to Bussard←Bussard. To be built later atop FizzOS + lantern + belnap (owned by other agents; not touched here).
audience: 561-group computer / apps-games dev team
status: design-note
---

# Tsander — a paraconsistent wireframe space-flight game

> **What this is.** A design note only. No game code. Tsander does not exist yet; it needs
> **belnap** (the native language, [`computer/docs/dev/journal/2026-06-05-belnap-the-native-language.md`](../journal/2026-06-05-belnap-the-native-language.md)),
> **FizzOS** ([`apps/tools/fizzos/`](../../../../apps/tools/fizzos/)), and **lantern** — all being
> built/owned by other agents and **not touched here**. This note says what Tsander *is* and how its
> weirdness falls straight out of what this computer already is, so it can be built later.

Plain statements report what a repo file says (with a path). **[DESIGN]** marks my own synthesis —
the game proposal — which is what this whole note is, kept apart from the cited machinery.

## 1. The homage (and why a knockoff is the right shape)

Phil Hagelberg / technomancy's **Bussard** is a space-flight game where you fly by *programming your
ship's computer* in a Lisp (Fennel/Lua). It is named for **Robert Bussard** (the Bussard ramjet) — a
game named after the propulsion pioneer whose idea it embodies. **Tsander** is named for **Friedrich
Tsander**, the Soviet interplanetary-rocketry pioneer ("Вперёд, на Марс!" — *forward, to Mars!*), in
the same homage shape: **Tsander←Tsander as Bussard←Bussard**, and as **belnap←Belnap** already does
inside this repo (the native language is named after Nuel Belnap; see the belnap journal). The genre
target underneath is the original **Elite** (1984, BBC Micro): a procedurally generated galaxy grown
from a small **seed**, trade and combat between star systems, and famously a **3D wireframe vector**
cockpit view. Tsander keeps all four — seed-grown galaxy, trade, combat, wireframe — and replaces the
seed-RNG with this computer's far stranger generator: **federation + paraconsistent settling**.

The thesis: *Elite's galaxy was deterministic from a seed; **Tsander's galaxy is settled from a
contested trace.** Every player who has been somewhere has left predications about it; the system you
arrive at is the **fold** of all of them, and where they disagree the star is **literally a
Schrödinger system** — a ⊤ the computer holds as a situation, not a number a coin-flip resolved.*

## 2. The repo's own prior computing research this stands on

Tsander is not the first "a game IS this computer" thought in the repo; it inherits a lineage.

- **The SPOTCOMP `computer-operating-system` / `posix-computer` tree** (archived). Under
  `archive/2026/05/23/spotcomp/…/concurrent-game-system/…/computer/…/posix-computer/` the spec frames
  a **concurrent-game-system → computer → posix-computer** stack: a posix-computer "exposes a
  supervised userland" that can "start, spawn, supervise, dispatch, and stop subsystems; bind stdio;
  forward signals; report exit status," where "process execution authorizes nothing on its own — side
  effects stay governed by higher layers (capability, governance, modeled-player)"
  (`…/posix-computer/docs/dev/specification.md`). The sibling `file` spec fixes the world's medium:
  "a log file is LF-delimited: one record per line… writes to a log are append-only… a malformed
  record is surfaced, never silently skipped" (`…/file/docs/dev/specification.md`). That is exactly
  Tsander's medium (`.jsonl` traces) and its governance shape (capability + modeled-player). The
  later `voidmath` tree carries the same name **`computer-operating-system`** with
  `posix-computer-operating-system-function-implemented-in-esm-node` under it — the ancestor of
  today's `computer/` layer.
- **The concurrent-game research notes** in this very directory. `concurrent-game-system.md`:
  "plays are concurrent strategies on prime event structures with symmetry — events carry
  **Player/Opponent polarity**, causality is a partial order, conflict is irreflexive symmetric," and
  it cites **Belnap 1977** as "forc[ing] the four-valued truth at the value level." The companion
  `multi-observer-settling-and-consensus.md` distils the repo's "multi-observer settling / network-
  sheaf consensus / CRDT-CALM machinery… the consensus-and-disagreement substrate `@561-group/computer`
  realizes through its FOUR-valued EAVT trace." Tsander's combat and challenge-response are
  Player/Opponent plays in exactly that sense (see `principal`'s `authenticated`, below).
- **The tab MUD lineage.** `apps/tools/tab/README.md`: "The world IS the on-disk EAVT trace; a
  predication is an intra-action… A persistent, self-running world that advances under its own
  volition." Its signature event — "Run it past tick 30 and Building Permit #23 settles to **⊤** — a
  contradiction the world holds as a *situation*… Nobody coded 'permits go bad'; the bilattice fold
  produced it" — is the template for Tsander's **contested star**. The whole archived MUD-driver
  ancestry (`archive/.../multi-user-dungeon/tab/...`, including the **groundhog-operating-system**
  variants and the `teraum` worlds) is the prior "a world that runs itself off a log" thinking.
- **`aletheon`** ([`apps/games/aletheon/README.md`](../../../../apps/games/aletheon/README.md)) is the
  3D sibling that already does this: "every vital fact is a bilattice cell — ⊥ unknown · t real · f
  slain · ⊤ a contradiction the world *holds as a situation* and lets walk as a Corrupted Anomaly."
  Tsander is **aletheon's wireframe-space cousin**, swapping the WebGL realm for a terminal cockpit
  and the single authoritative server for **federation between many players' worlds**.

So Tsander is not a new idea bolted on; it is the repo's own concurrent-game-system / posix-computer /
tab-MUD line, pointed at *space*, and finally given the federation layer the older specs only gestured
at ("modeled-player," "higher layers").

## 3. The machinery Tsander is built on (what each piece already gives, by name)

Everything weird about Tsander is **already in the computer**. Tsander is mostly *wiring*, not
invention. The load-bearing pieces, with the file that defines each:

| Repo piece | File | What Tsander gets from it |
|---|---|---|
| **federation = tensor ∥** | [`computer/distribution/scripts/federate.mjs`](../../../../computer/distribution/scripts/federate.mjs) | "the tensor ∥ of two append-only worlds: a G-Set UNION of each log, deduped by content-id… NO coordinator, NO clock, NO last-write-wins. Conflicting facts… are both kept, and the per-observer read-lens folds the contradiction to ⊤." → **the galaxy is the union of every pilot's world-trace.** `frontier`, `sectionOf`, `disagreements`, `migrate` are the exact reads Tsander needs. |
| **the substrate fold** | `@561-group/computer/substrate` (`settle`/`section`/`relate`/`rowId`) | a star system = `section(subject)` → `{affirmed, denied, contradicted}`. The `contradicted` set **is** the Schrödinger part of the system. |
| **FOUR-valued governance** | [`computer/distribution/scripts/governance.mjs`](../../../../computer/distribution/scripts/governance.mjs) | "a governance decision is NOT a boolean… t / f / ⊥ / ⊤"; `governAction` folds a context to a FOUR decision. → **docking permits, faction jural regimes, bounties**: a contested permit is ⊤ (HELD), never a silent deny. |
| **structural cost / bottlenecks** | [`computer/distribution/scripts/cost.mjs`](../../../../computer/distribution/scripts/cost.mjs) | "a federated world is a relational graph… the bottlenecks are the **cut-vertices** and **bridge-edges**." → **trade routes and chokepoints**: the cost-graph names which jump-lane the galaxy depends on a single system/link for. Piracy and blockades target bridge-edges; profit lives at cut-vertices. |
| **principal = recognition identity** | [`computer/principal/README.md`](../../../../computer/principal/README.md) | "a principal is… a settled identity cell in the trace… capability not credential; recognition not registry… ⊤-held-dispute not access-denied." `recognize`/`dispute`/`whois`/`authenticated`/`may`/`can`/`grant`/`delegate`. → **reputation, factions, bounties, ship ownership.** A contested reputation is ⊤; a faction is a coalition of `recognize` edges. `authenticated` "decays toward ⊥ as evidence ages (no session-bit)" → your standing in a port *fades* if you stop showing up. |
| **belnap = the native language** | [`computer/docs/dev/journal/2026-06-05-belnap-the-native-language.md`](../journal/2026-06-05-belnap-the-native-language.md) | "`eval` is `settle`… the program is a trace; running it is folding it… ⊤ is a first-class value you can bind, pass, and branch on." `(federate worldA worldB)`, `(as principal …)`, `(must…)(should…)(may…)`, `(section subj)` are *special forms*. → **you program your ship in belnap**, and the ship's flight computer is a belnap REPL whose `(if ⊤ …)` runs both arms held contested. |
| **event-projection** | [`computer/event-projection/scripts/event-projection.mjs`](../../../../computer/event-projection/scripts/event-projection.mjs) | "events are a PROJECTION of the append-only trace… a contradiction ⊤ in the settled section… projects to a `top` event — never an error and never suppressed." → **the cockpit's sensor feed**; a ⊤ in sensor range emits a `top` event the wireframe renders as a glitch (§7). |
| **carrier (SSE)** | [`computer/carrier/sse.mjs`](../../../../computer/carrier/sse.mjs) | the transport that streams a peer's row-deltas. → **how two pilots' ships exchange world-traces** when they meet (and how a system you've visited keeps updating as others visit it). |
| **FizzOS (MUD driver)** | [`apps/tools/fizzos/index.mjs`](../../../../apps/tools/fizzos/index.mjs) | "the MUD driver over tab… fizzbang owns the concerns specific to MUDs — practising skills, socialising, saying/mailing, **factions**, fighting, crafting." → Tsander's *gameplay verbs* (hail, trade, fight, mine, practise piloting) ride on FizzOS so Tsander doesn't reinvent them. |
| **tab (engine) + lantern** | [`apps/tools/tab/`](../../../../apps/tools/tab/), `lantern` (other agent) | tab is "the EAVT world-substrate, ticking, value/charge, **trade**, worldgen, ecology, history, **federation**." lantern (per the brief) is the terminal/TUI surface Tsander draws into. |

## 4. [DESIGN] The core loop

A terminal session. You are a **principal** (a recognition cell in the trace) flying a **ship** (an
entity whose flight computer runs **belnap**). One cycle:

1. **Settle the system you are in.** Fold the federated trace at your current subject (`sectionOf`).
   You see `{affirmed, denied, contradicted}` — the station, its prices, its factions, its hazards.
   The `contradicted` cells are the **anomalies** (§5).
2. **Act, by appending predications.** Trade, refuel, take a bounty, scan, mine, talk. Every action is
   `(assert s p o)` / `(deny …)` in belnap — a row appended to *your* world-trace. Governance
   (`governAction`) decides whether the port admits the act (FOUR-valued; a contested permit is ⊤,
   surfaced in the cockpit, not a silent refusal).
3. **Plot a jump.** The galaxy is a relational graph; `cost.mjs` names the cut-vertices and
   bridge-edges. You pick a lane. Fuel = evidence you spend (linear, per belnap's "evidence is
   linear"); you cannot duplicate a jump-charge for free.
4. **Jump = federate.** Arriving at a system means **`federate`-ing your trace with whatever traces
   reach that subject** — other pilots', the home system's seed, your own past visits. The system
   you arrive at is the *fold* of all of them. **It is never the same twice if others have been
   there.**
5. **Project + render.** `event-projection` turns the cycle's row-delta into cockpit events; the
   **wireframe projector** (§7) draws the settled 3D section as terminal vector lines. ⊤ cells render
   **doubled / glitching**. Loop.

There is **no global tick you wait on** — like belnap, evaluation is "aperiodic settling, not
stepping." The world advances when traces meet and re-settle.

## 5. [DESIGN] Infinite-by-federation worlds; how a star system settles

Elite grew its galaxy from a seed. Tsander has a seed too — a tiny canonical world-trace shipped with
the game (the "core systems"), enough that an offline solo pilot has somewhere to start. But the
**real** galaxy is **unbounded by federation**, not by RNG:

- A **star system is a subject `e`** in the trace. Its facts are the rows whose home is that subject:
  `(sol-iii, has-station, port-zarya)`, `(port-zarya, buys, water @ 4cr)`, `(belt-7, hazard,
  pirates)`. The system you *experience* is `sectionOf(world, e)` for **your** observer lens.
- **Anyone can predicate any subject.** When pilot A trades at `port-zarya`, A appends rows under
  `port-zarya`. When A and B meet (carrier SSE) or pass through a shared relay, `federate` G-Set-unions
  their logs. **The galaxy literally grows by people having been places** — new subjects (a station a
  pilot *built* and predicated into existence), new edges (a jump-lane someone *flew* and recorded),
  new prices, new hazards. There is no finite catalogue; the map is the closure of everyone's traces.
- **The seed is just the first peer.** "Procedural generation" becomes "the system is generated *by
  whoever has been there*." A never-visited star is **⊥** — pure potential, "no evidence" — and
  renders as an unresolved dot until someone settles it by going (§7). *Exploration creates the map.*

This is the repo's own line, stated plainly in `federate.mjs`: a player walking from one server to
another is "their entity file being sent as a message; same SHA-256 hash, same identity; no server
transfer, just a predication crossing a boundary." In Tsander that *is* interstellar travel.

## 6. [DESIGN] How ⊤ and ⊥ manifest in-game

This is the whole reason Tsander is weird. The two off-classical values are **content**, not errors:

- **⊥ (no evidence) — the undecided region.** Unvisited space. A star at ⊥ is a **dim, single,
  flickering vector point** — the game *does not pretend to know* what is there. You cannot trade with
  a ⊥ station; you can only go and settle it. Whole **undecided regions** of the galaxy exist as ⊥
  fog; settling one is the explorer's reward (and you can *sell the section* — the rows you appended —
  to other pilots, which is information-as-cargo).
- **⊤ (contradiction, HELD) — the Schrödinger system / contested star.** When two pilots' traces
  *disagree* about a subject — A says `(port-zarya, controlled-by, federation)`, B says
  `(port-zarya, controlled-by, pirates)` — `federate` keeps **both**, and the fold returns **⊤** with
  **both witnesses**. The station is *neither and both* until something settles it. In-game this is a
  **contested star**: a system held in superposition between two realities. Concretely:
  - Its name, owner, prices, and even its *position* may be **doubled** (two overlapping wireframes,
    §7). You can dock — but **which** port-zarya you docked at depends on *whose evidence your
    observer lens weights*, and the other version's faction may treat you as having defected.
  - You can **collapse** a contested star by adding decisive evidence (winning a battle, completing a
    governance challenge), but per `principal`/`governance` you never *erase* the losing witness —
    the contradiction is "surfaced, never destroyed." A collapsed star can be **re-contested** by a
    later pilot. *Reality is a standing argument.* This is exactly tab's Building Permit #23 ("a
    contradiction the world holds as a situation"), promoted to a *star*.
  - **Mechanically novel:** because ⊤ carries *both* faces, a contested star can be **mined for its
    contradiction** — the `disagreements(world)` read (in `federate.mjs`) lists every ⊤ cell; a
    "void-trader" career is finding contested systems and brokering between the two coalitions that
    each believe a different truth. You profit from the disagreement *without* resolving it.

No other space game can do this honestly, because every other space game runs on a boolean machine: a
star is owned by faction X *or* faction Y, decided by a server. Here it can be **owned by both, held**.

## 7. [DESIGN] The wireframe PROJECTOR — and how it draws contradiction

Elite's signature was the 3D wireframe cockpit. Tsander's **projector** is a small, *separable*
package: **a pure function from a settled 3D section to terminal vector lines.** It is built on
`event-projection` (the same "project the trace, never a separate log" law) but projects to *geometry*
instead of to event channels.

- **Input:** a `section(subject)` whose cells carry positions/shapes (a ship, a station, an asteroid,
  a star). Each renderable is an entity with `(e, at-position, v)`, `(e, hull-shape, …)` cells.
- **Pipeline:** model-space vertices → camera transform (the rederived vec/mat math, lifted from
  aletheon's `tests/math.test.mjs` style) → perspective project to the terminal's character grid →
  rasterize **lines** (Bresenham over the cell grid) into a frame buffer of glyphs. Pure, deterministic,
  replay-identical (no `Date.now`, no `Math.random`) — same law as event-projection.
- **The contradiction render is the point.** The projector reads each renderable's **FOUR charge**:
  - **t (affirmed):** a clean, single, solid wireframe.
  - **⊥ (no evidence):** a faint, dotted, single outline — *guessed* geometry.
  - **f (denied):** absent / a wreck-stub (destroyed; the negative face won).
  - **⊤ (contradicted, HELD):** the object is **drawn twice** — both witnesses' geometries
    superimposed and offset, **jittering** frame-to-frame between the two (a controlled glitch driven
    by the *evidence*, not by an RNG): a doubled, shivering wireframe. A ⊤ enemy ship you cannot get a
    targeting lock on because there are *two of it*. A ⊤ station whose docking bay flickers between two
    positions. The `top` event from `event-projection` is what flags which renderables to double. This
    is the visual grammar of the whole game: **clean = settled truth, dotted = unknown, doubled-and-
    shivering = contested.**

So the wireframe is not decoration; it is a **direct readout of the bilattice**. You learn to *fly by
the glitch* — a shivering star on your scope means a contested system, a profit and a danger.

## 8. [DESIGN] Trade & reputation — cost-graph + principal model

- **Trade.** Prices are predications under a station subject; an exchange appends a `(you, sold, water
  @ port-zarya)` row and a converse. Profit lives on the **cost-graph** (`cost.mjs`): a **cut-vertex**
  system (one whose removal disconnects the galaxy graph) is a natural monopoly — high margins,
  high risk. A **bridge-edge** jump-lane is a chokepoint — pirate it or blockade it. The galaxy's
  economy is *literally* its graph topology, read by the same bottleneck function the swarm uses to
  find coordination pressure. **Information is cargo:** a settled `section` of a previously-⊥ region is
  a sellable good (you sell the rows; the buyer federates them in).
- **Reputation = recognition.** Standing is not a number; it is `whois`/`authenticated`/`may` over the
  **recognition graph** (`principal`). A faction recognizes you (`recognize`), a rival disputes you
  (`dispute`); fold both on the same claim and your reputation is **⊤ — contested**, with both
  witnesses. `authenticated` **decays toward ⊥** as evidence ages: *stop showing your face at a port
  and your welcome fades by itself* (no session-bit). A bounty is a `grant` of a capability against
  your principal; a pardon is another `grant`; a `grant` + `revoke` on the same cell rise to **⊤**
  (you are *simultaneously wanted and pardoned* — held), which a port must adjudicate via
  `governAction`. **Factions are coalitions:** a faction is a set of principals bound by mutual
  `recognize` edges; defection is a `dispute` you append; a civil war is when a faction's internal
  recognition graph folds to ⊤. Challenge-response (a customs inspection, a duel-to-prove-identity) is
  a **Player/Opponent play** in the exact concurrent-game-system sense the repo's notes cite.

## 9. [DESIGN] Programming the ship in belnap

Per the belnap journal, the language *is* the OS tool surface and `eval` *is* `settle`. The ship's
**flight computer is a belnap REPL.** You don't push buttons; you append forms:

```
(define autodock
  (when (relate has-station (here))
    (must (align-to (relate-from (here) docking-bay)))))   ; □ as a necessitating charge

(define void-trade                                          ; profit from contradiction, don't resolve it
  (for-each (disagreements (frontier *galaxy* (here)))      ; every ⊤ cell in sensor range
    (broker it)))                                            ; sell each coalition the other's truth

(if (section (target))                                      ; a FOUR-valued branch:
    :t  (lock-and-fire)                                      ;   settled enemy → lock
    :⊤  (do (lock-and-fire) (also evade))                    ;   contested enemy: run BOTH arms, held
    :⊥  (scan)                                               ;   unknown → settle it first
    :f  (disengage))                                         ;   already a wreck
```

The killer feature only this machine allows: **`(if ⊤ …)` runs *both* arms and holds the result
contested** (belnap journal: "⊤ runs *both* arms and holds the result contested"). A ship flying into
a contested star can have its autopilot *honestly* both-dock-and-flee, and the wireframe will show the
ship doubled until the contradiction settles. Evidence is **linear** — you cannot free-duplicate a
fuel-charge or a missile-witness; the `!`-comonad gates explicit duplication. `(federate …)`,
`(as principal …)`, `(at path …)` are the same special forms the OS exposes; **the ship's program and
the galaxy's state are the same medium** (a trace), so a ship can `(quote)` a maneuver and another
ship can `(settle)` it — *programs are tradeable cargo*.

## 10. [DESIGN] Package layout

A workspace member under `apps/games/`, matching the `aletheon` shape (zero-dep where possible, pure
ESM, a `561:serve` block, an append-only world `.jsonl`). **None of these files are written by this
note** — this is the *proposed* layout for the later build.

```
apps/games/tsander/
  README.md                  # front door (follows the readme/ typed-resource spec)
  package.json               # @561-group/tsander ; private ; type:module ; 561:serve block
  bin/tsander.mjs            # the terminal client entry (a belnap REPL + cockpit) — runs on lantern
  engine/                    # Tsander-specific simulation (galaxy, jumps, economy hooks)
    galaxy.mjs               #   star-as-subject; jump = federate; settle a system
    cockpit.mjs              #   the per-cycle loop: settle → act → project → render
  projector/                 # the WIREFRAME PROJECTOR (separable; section → terminal vector lines)
    project.mjs              #   3D section → camera → perspective → Bresenham lines → glyph frame
    contradiction.mjs        #   FOUR → render style (t solid / ⊥ dotted / f stub / ⊤ doubled+jitter)
    math.mjs                 #   rederived vec/mat/quat (aletheon-style) OR import math/ if available
  world/                     # the shipped SEED trace (core systems) — append-only .jsonl
    core-systems.jsonl
  tests/
    galaxy.test.mjs          #   jump=federate; a disagreement settles to ⊤ with both witnesses
    projector.test.mjs       #   replay-identical frames; a ⊤ renderable draws doubled
    economy.test.mjs         #   cut-vertex = monopoly; bridge-edge = chokepoint (cost.mjs)
```

Dependencies (by name, the layer pipeline `computer → apps`):

- **`@561-group/computer`** — `substrate` (settle/section/relate/rowId), `distribution`
  (federate / governance / cost), `principal` (recognition/reputation), `event-projection`,
  `carrier` (SSE peer transport). *The galaxy, identity, economy, and streaming all come from here.*
- **belnap** (`computer/belnap`, when it lands) — the ship's language; the REPL the cockpit embeds.
- **FizzOS** (`apps/tools/fizzos`) — the MUD-driver verbs (hail/trade/fight/mine/practise/faction).
- **tab** (`apps/tools/tab`) — the engine-general world substrate, ticking, trade, worldgen,
  federation tab already carries.
- **lantern** (other agent) — the terminal/TUI surface the projector draws into and the REPL reads
  from.
- **the wireframe projector** — proposed *in-tree* under `apps/games/tsander/projector/` (small,
  Tsander-specific); could later be lifted to `computer/` beside `event-projection` if a second app
  wants terminal vector rendering, exactly as tab's `events.mjs` was lifted into
  `computer/event-projection`.

**Read-only on source held:** this note touches none of `tab` / `fizzos` / `lantern` / `belnap` source
(those are owned by other agents); it only *cites* them and proposes how Tsander wires them.

## 11. Open questions for the build (deliberately unresolved — ⊥, not guessed)

- **Observer lens at a ⊤ star:** whose witnesses does a pilot's `frontier` weight, and does docking at
  one face of a contested station append evidence that *pushes* the fold toward that face? (Likely yes
  — presence is evidence — which makes occupation a way to win a contested system without erasing the
  loser.)
- **Seed vs. federation authority:** does the shipped core-systems seed get any privileged weight, or
  is it just peer-zero whose facts a coalition can out-vote? (Leaning: just peer-zero — *no privileged
  observer* is the honest reading of `federate.mjs`'s "NO coordinator.")
- **Projector home:** keep the wireframe projector in `apps/games/tsander/` or lift to `computer/`
  beside `event-projection` from the start? (Leaning: in-app first, lift on second consumer.)
- **belnap maturity:** the ship-programming surface in §9 assumes belnap's special forms exist; until
  belnap lands, the cockpit is a fixed verb set (FizzOS) and §9 is the north star, not the v0.
