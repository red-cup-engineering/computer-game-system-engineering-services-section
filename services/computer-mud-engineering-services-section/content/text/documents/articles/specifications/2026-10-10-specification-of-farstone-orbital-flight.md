---
title: "Farstone orbital flight: specification"
date-created: 2026-10-10
authors: [Red Cup Engineer Senior]
status: draft
part-of: computer-mud-engineering-services-section
version: 0.1.0
stability: draft
realizes:
  - computer-game-system-services-section/content/requirements/farstone-orbital-flight-game-beyond-kerbal-space-program.json (R1–R5)
  - computer-game-system-services-section/content/requirements/farstone-orbital-flight-game-capabilities.json (F1–F23)
  - computer-simulation-system-services-section/content/requirements/holofoam-as-physics-simulation-engine.json (R1–R4)
serves: debt-2026-10-09-farstone-beats-kerbal
---

# Farstone orbital flight: specification

## What this is

Farstone (causeway-services/farstone, served at farstone.561.group) is the Group's flagship harbor MMORPG/MUD. This specification states the orbital spaceflight game inside it: the game that meets and then beats Kerbal Space Program (KSP) and grows Farstone's science-fiction wings. Players build ships from parts, including orbital launch platforms. They fly them under honest gravitation in Farstone's one shared world, and every ship stays in that world for others to see, dock with and use. The specification is derived from three sources:
- the three research notes of 2026-10-10 (astronomy, physics, game ludics);
- the capability comparison `2026-10-10-note-on-farstone-orbital-flight-against-kerbal-space-program.md` in this section;
- the code Holofoam already holds (`structure.mjs`, `flight.mjs`, `orbit.mjs`).

The orbital game is a region of Farstone's one world, entered by the same characters (farstone-flagship-world R4; `notes/2026/10/10/2026-10-10-specification-of-farstone-the-flagship-world.md` §4 in this section, from pass farstone-ksp-2). No production code is specified here beyond what those modules already establish. The high-level design is in `2026-10-10-farstone-orbital-flight-high-level-design.md`.

## Engines it is realized on

| Engine | Seat | Role |
| --- | --- | --- |
| **Holofoam** | computer-simulation-system-services-section/apps/holofoam | Physics: structure (rigidity, loads, breakage), rigid-body flight, orbits, merge of players' plans. Every simulated thing is a SignCell in a SignCraft history. |
| **QwzSpace** | computer-web-engineering-services-section/apps/qwzspace | The Group's own 3D engine and game client: rooms, fixed-tick transaction boundary, interest-filtered settled deltas, the 3D → 2D → text tiers, the shared HUD, the icosahedral scene on exact quadratic geometry. No third-party 3D library. |
| **FeltOS** | multi-agent-computer-platform-engineering-services-section/apps/feltos (red-cup-engineering/feltos) | World hosting, player sessions, terminal protocol, durable world (one SQLite Durable Object per world), rate laws for climate, needs and ecology. |
| **Farstone** | public-web-games-services-section/sites/farstone.561.group | Authored world, rules, progression, civic arcs, Director, economy. The game definition composes the three engines and owns no renderer and no physics. |
| **SignStuff** | lib/signstuff (signcell → signchain → signgraph → signcraft) | Cells, rules, the cellular sheaf (`signgraph/cellular-sheaf`), histories and their merge. |
| **deterministic-math** | computer-data-engineering-services-section/src/number/deterministic-math.mjs | Portable + − × ÷, sqrt, sin, cos, atan2, log, Stumpff and Kepler functions in fixed operation order. |

## Terminology

- **Part**: a catalogue entry (mass, extent, attachment nodes, strength, function), admitted as a SignCell.
- **Design**: a set of part, joint and strength cells in a SignCraft history.
- **Body**: a rigid piece of a settled design. Welds fuse parts into one body.
- **Segment**: a law for one body or vessel from an epoch. It is a *coast* (exact conic, or an integrated n-body coast) or *powered* (fixed-step integration under thrust). A segment is keyed by (vessel, epoch).
- **Plan**: a vessel's set of segments.
- **Ephemeris**: the celestial bodies' motion, precomputed once and stored as content-addressed segments.
- **Frame**: a body-fixed or vessel frame. A pose is (frame cell, local offset).
- **Seam**: two different laws told at one (vessel, epoch). H¹ ≠ 0 over the merged history.
- **Observer horizon**: the causal past of the epochs a player has already read for a vessel.

## Requirements

### Building

- **B1.** The ship builder shall assemble a design from catalogue parts and from procedurally shaped tanks, wings and fairings. (F4, R1)
- **B2.** The ship builder shall display each mechanism and each self-stress of the design, read from Holofoam's rigidity sheaf, before launch. (F3)
- **B3.** The ship builder shall let a player designate a design as an orbital launch platform, which other designs can be assembled on and launched from in orbit. (F2, R1)
- **B4.** The ship builder shall run in each of QwzSpace's three tiers. In text, a design is edited as a list of parts and joints. (F18)

### Structure

- **S1.** Holofoam shall fuse welded parts into rigid bodies and treat struts, decouplers and hinges as constraints of a body-bar rigidity sheaf over the rationals. (F3)
- **S2.** Holofoam shall solve member loads as equilibrium on the sheaf and return the obstruction, never NaN, for a mechanism. (F5)
- **S3.** Holofoam shall remove a member whose load exceeds its strength by a settlement firing, and re-settle until nothing fires. (F5)
- **S4.** Holofoam shall include aerodynamic, thermal and thrust loads in the loads S2 solves. (F5, F17)

### Flight and gravitation

- **G1.** Holofoam shall hold the celestial system as one ephemeris of content-addressed segments, integrated once by a symplectic method, that every node reads identically. (F7, F10)
- **G2.** Holofoam shall propagate a coast by the exact two-body conic where the third-body acceleration ratio is below the declared threshold, and by fixed-step symplectic integration under the ephemeris elsewhere. (F6, F9)
- **G3.** Holofoam shall integrate a powered segment at a fixed power-of-two step, with thrust, mass flow and staging, in the frame of the body whose gravity dominates. (F9, F11)
- **G4.** Holofoam shall derive any pose at any time from segment laws. A coast costs the same whatever time has elapsed since its epoch, and an integrated coast is memoised by content address. (F8)
- **G5.** Holofoam shall express every pose as (frame cell, local offset) in double precision and never as a single global coordinate. (F12)
- **G6.** Holofoam shall produce the same pose bits and the same history head for the same history on every node. (F10)
- **G7.** Holofoam shall derive segment ends (SOI change, impact, burnout, cutoff, promotion between conic and integrated coast) and store none of them. (F6, F8)

### Time and players

- **T1.** The game shall give each player a view clock they may warp forward independently. (F15)
- **T2.** Holofoam shall merge players' plans as an order-independent history union. (F13)
- **T3.** Holofoam shall refuse a vessel's pose from a seam's epoch on, and report the contested cells. (F13)
- **T4.** When a player tells a law for a vessel at an epoch inside another observer's horizon for that vessel, Holofoam shall refuse the law. (F14)
- **T5.** The world host shall pay owed world time by evaluating laws, never by replaying ticks. (F8; Farstone's host advances time on requests, at most one overdue tick per request.)

### Play

- **P1.** The game shall provide maneuver planning over conic and integrated segments, drawn in inertial, body-fixed and rotating frames. (F16)
- **P2.** The game shall offer Lagrange points, halo orbits and resonant transfers as destinations. (F6, F16)
- **P3.** The game shall attach space contracts, crews, stations and logistics to Farstone's existing progression and economy. (F21)
- **P4.** The game shall let agents fly, crew and keep ships and stations under the same rules as human players. (F20)
- **P5.** The game shall admit parts, systems and laws as catalogue cells. (F22)
- **P6.** The game shall let a server operator set the system's scale. (F23)
- **P7.** The game shall render on QwzSpace in 3D, 2D and text from one client, with no third-party 3D library. (F18, F19)

## Where the Group's own mathematics applies, and the result each use rests on

This section realizes requirement R2/R5 of `farstone-orbital-flight-game-beyond-kerbal-space-program` and condition `math` of `debt-2026-10-09-farstone-beats-kerbal`. "Obsmetrologia" is the Group's Lean 4 library (obsmetrological-services-section/lib/obsmetrologia). "metrologic" is its JavaScript realization (computer-data-engineering-services-section/lib/metrologic). Status words are as the corpus states them.

| # | Place | Result it rests on | Status |
| --- | --- | --- | --- |
| M1 | **Breakage (S3)**: an over-strength member is told against its design cell and fires | FOUR, the Belnap–Ginsberg bilattice (Obsmetrologia `Language/Positing/Four`); the settling law "for any closure operator c, c(a) is the least fixed point above a" (Knaster–Tarski; arenas note Lemma 3.12–3.13; `Language/Settling.lean`) | Proved |
| M2 | **Failure flow terminates (S3)** | Four-regime dichotomy of closure ordinals: a finite design's failure flow is strict (κ < ω), and the finite spine is strict with vanishing H¹ (pymetrologic THEORY.md) | Proved |
| M3 | **Rigidity and wobble (S1, B2)**: mechanisms = dim H⁰ − 6 per piece; self-stresses = H¹; Maxwell identity | Cellular-sheaf cohomology over the clopen lattice, Q-enriched (Framework 3 of `cohomological-framework.md`), realized in `signgraph/cellular-sheaf` `bodyBarSheaf` and `rational-matrix` | Base cases proved |
| M4 | **Loads (S2)**: minimum-norm (harmonic) solution on an over-braced design | Harmonic sections of a sheaf Laplacian; the Lawvere–Laplacian harmonic kernel (`Dynamics/Flow/LawvereKernelH0.lean`) | Proved for the strict and Scott-continuous cases |
| M5 | **Multiplayer merge (T2, T3)**: order-independent union; a seam is H¹ ≠ 0 | H¹ = 0 ⟺ order-independent merge ⟺ confluence (settling cohomology, the CRDT/CALM row of THEORY.md). The non-vanishing content is the cover-nerve cycle rank `CoverNerve.H1rank` | Proved |
| M6 | **Causal admission of a law (T4), visibility and communication regions** | Kinematic points, regions and patches (Obsmetrologia Book VIII, Relational Spacetime): a segment is a causal diamond, ordered by sequencing (a,b) ≺ (c,d) ⟺ b ≤ c, never nesting; exterior past-closed, hole future-closed, disjoint (Obsmetrologia manual, curriculum `FromPredicationToKinematicSpace`, and the 2026-09-21 note on the axiom-law spine and the light cone) | Stated in the manual; the `CausalSets` Lean namespace the 2026-08-11 survey counted is not in the current tree, so no kernel-checked file is cited. Realized in `orbit.mjs` `diamonds`, `sequencingCheck`, `kinematicRegion` |
| M7 | **Re-entry and structural heat (S4)** as diffusion over the part graph | Lawvere–Laplacian spectral gap bounds the relaxation rate (`Dynamics/Flow/LawvereLaplacianSpectralGap.lean`); free energy is a Lyapunov function (`Dynamics/Flow/FreeEnergyLyapunov.lean`) | Proved |
| M8 | **Ephemeris and history identity (G1, G6)**: same cells, same address | Content addressing of SignCells (RFC 6920 ni names); not an Obsmetrologia theorem, a SignStuff invariant | Implemented |
| M9 | **Planet surfaces (P7)**: icosahedral subdivision with exact coordinates | metrologic `articulation/predicating/geometry/spatial/icosahedral`, exact quadratic arithmetic; used by `qwzspace/scene` | Implemented |
| M10 | **Promotion between conic and integrated coast (G2)** as a valued decision | FOUR valuation of "conic adequate": t (conic), f (integrate), ⊤ (both readings disagree, which forces integration), ⊥ (not yet evaluated) | Proposed; no theorem yet |
| M11 | **Time evolution as regime** | Continuous-state regime classification (value-continuity and time-continuity are independent axes) | Proved; its reading for symplectic integration is open |

**Where the Group has no result, and the field's result is used:**
- symplectic integration (Yoshida composition, Wisdom–Holman);
- Chebyshev ephemeris segments;
- 64-bit frame hierarchies;
- drag and lift models.

Obsmetrologia's `Dynamics` namespace holds closure flows, not Hamiltonian flows.

## Conformance

A second implementation conforms when, for the same history:
- it derives the same poses bit for bit (G6);
- it finds the same seams (T3);
- it refuses the same laws (T4);
- it reports the same mechanisms and self-stresses (B2).

Golden vectors are a history head and the poses at named times, as `scripts/orbit-demo.mjs` already prints.

## Open questions

- The third-body threshold for G2, and whether promotion is visible to the player.
- Whether T1's per-player clocks may show another player's vessel at a time that player has not yet reached.
- The scale default (P6).
- The text-tier flight console's command language (B4, P7).

## Realized: the Sky Yard (2026-10-10)

The first playable slice shipped the same day, in causeway-services/farstone#10 and this
section's companion change to Holofoam. The founder's words it answers are in Farstone's
`docs/SPACEFLIGHT.md` (leader-utterances lines 1423, 1451, 1545).

| Requirement | Realized by | Status |
| --- | --- | --- |
| B1 (catalogue parts) | Farstone `docs/world/spaceflight.json` racks; `stack`, `unstack`, `rocket`; Holofoam `vessel.stagesOf`, `vessel.stackDesign` (the stack as a `structure` design) | Catalogue parts on one axis; no procedural parts, no radial symmetry |
| B4 (text tier) | Every verb is a typed FeltOS command, so the builder and the flight console run over telnet and in the browser's text tier | Text tier only |
| G3 (powered, staging) | `vessel.tellAscent`: one powered law per stage, the bottom stage first, each ignition told at the epoch the previous law derives for burnout; `vessel.spend` pays impulsive burns from the attached stages | Point-mass vessel (F11's rigid coupling open) |
| G4, G6, G7 | Farstone keeps only told laws and a mission clock on the player and derives every reading; warping a year is one call; the same commands give the same stored flight | Met for conics |
| T1 (per-player clock) | Each flight has its own mission clock (`warp`), apart from the world's hourly tick and every other player's | Met for one player's own vessel; other players' vessels are not shown yet |
| Rotation (frames, F12/F16 groundwork) | A body may carry a sidereal `rotationPeriod`; `orbit.surfaceVelocity`; a powered law's steering may carry `spin`, so the gravity turn follows prograde relative to the turning ground | The default world turns in Kerbin's 21,549.425 s |
| S4 / F17 (aerodynamic loads), first part | Holofoam: a body may carry an `atmosphere` (`airDensity`, ρ₀ e^(−h/H) cut at its height); a powered law with a `dragArea` pays ½ρ\|u\|u·CdA against the turning air; parts carry drag areas | Ascent drag only; no lift, heating or drag on coasts; the law is the aerospace section's note on the atmosphere of Farstone's world |
| P1 (maneuver planning), conic part | Farstone `plan` / `execute`: a burn read before it is made, by forking the flight at its instant (`whatIf`'s pattern), then flown exactly | Conic segments, one plan at a time |

Open question "the text-tier flight console's command language" is answered for this slice:
`parts`, `stack <part>|starter`, `unstack [all]`, `rocket`, `launch [pitch]`, `orbit`,
`circularize`, `burn <prograde|retrograde|normal|antinormal|radial-out|radial-in> <m/s>`,
`warp apoapsis|periapsis|orbit|<n> [s|m|h|d]`, `chart` (the orbit in characters), `recover`.
One player's two burns at one instant fold into one coast law, so a player's own plan never
holds the seam T3 refuses.

The behavioral measurement of F1–F23 against KSP is Farstone's census
`data/records/2026-10-10-kerbal-space-program-capability-census.json`: 25 jobs read from KSP's
own pages, each naming the F requirements it checks and the command that decides it; the same
command is the met-when of the job's `farstone-ksp-*` requirement record.
