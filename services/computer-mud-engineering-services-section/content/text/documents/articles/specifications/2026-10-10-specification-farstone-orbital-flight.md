---
title: "Specification: Farstone orbital flight (the Sky Yard)"
status: first slice built; ledger open
date-created: 2026-10-10
description: "How Farstone's KSP-like game flies: who owns which part (Farstone, Holofoam, FeltOS), the Group mathematics each computation uses, the stored form of a flight, the slice built on 2026-10-10 and the ledger of what comes next."
keywords:
  - farstone
  - kerbal-space-program
  - orbital-flight
  - holofoam
  - meet-then-beat
provenance:
  authors:
    - emsenn
    - farstone-sci-fi-wings-session (Claude Code, 2026-10-10)
  serves:
    - ../../../../../content/requirements/farstone-orbital-flight-game-beyond-kerbal-space-program.json
    - ../../../../../../../computer-simulation-system-services-section/content/requirements/holofoam-as-physics-simulation-engine.json
  comparison: ../notes/2026/10/10/2026-10-10-note-on-meeting-then-beating-kerbal-space-program.md
  game-specification: causeway-services/farstone docs/SPACEFLIGHT.md
  census: causeway-services/farstone data/records/2026-10-10-kerbal-space-program-capability-census.json
---

# What was asked

The Leader, 2026-10-08T16:44Z (Claude session 0fbf24cb, leader-utterances line 1423):

> I want us to start working toward Farstone having a full-on game like Kerbal Space Program in
> it, but obviously, we want to beat Kerbal Space Program using everything the world has learned
> between when it was designed and now, and critically, use our own math as much as we can to
> help us. [...] I'm picturing orbital launch platforms being one kind of ship that folk can build

And thirty-three minutes later, to the session that began building it (line 1451):

> you aren't doing this right you're tyring to make a normal 3d physics engine [...] THEN
> ACTUALLY READ THE FUCKING SCIENCE AN DMATH

And on 2026-10-10T00:56Z (session b44bb98f, line 1545): "meet-then-beat Kerbal Space Program
with our game engines, and then including in Farstone, our falgship MMORPG, a KSP-like game for
folk (which is also part of how we justify our weird little MMORPG growing sci-fi wings)".

The relationality section has held the shape of this since before the request: the idea note
`science-services-section/.../relationality-services-section/.../notes/space-program.md`
("Relational Space Program") models vehicles as part graphs, missions as profiles and runs, and
Δv margins, loads and cost as measurements, so that "a Kerbal Space Program–style game becomes
just another slice of the universal relational computer". This specification is the first
engineering of that slice.

# Ownership

| Layer | Owner | Path |
|---|---|---|
| Place, parts, words, commands | Farstone | `causeway-services/farstone` `docs/world/spaceflight.json`, `src/farstone-spaceflight.mjs` |
| Flight laws, stages, propellant | Holofoam | `computer-simulation-system-services-section/apps/holofoam` `src/orbit.mjs`, `src/vessel.mjs` |
| Vehicle as a part graph | Holofoam | `src/structure.mjs` |
| World, commands, persistence | FeltOS | `red-cup-engineering/feltos` (capability commands; world cells in the SignCraft history) |

This section, computer-mud-engineering, owns the requirement that Farstone holds the game. The
engine requirement is the simulation section's (`holofoam-as-physics-simulation-engine`).

# The Group mathematics each computation uses (R2, R5)

| Computation | Group result used | Where |
|---|---|---|
| A trajectory is a **law over time**, never a stepped state; the pose at any time is derived | SignCraft history: laws are cells told into an append-only history; the plan is replayed, never written per tick | `orbit.mjs` (`createPlan`, `tellCoast`, `tellPowered`, `poseAt`) |
| Exact coasting flight, elliptic and hyperbolic | Deterministic arithmetic of `computer-data-engineering-services-section/number/deterministic-math` (Stumpff functions, `keplerElliptic`): every node derives identical bits, so equal cells hash to the same history head | `orbit.mjs` (`propagate`, `conic`) |
| Segments of a flight and their order | **Obsmetrologia, Book VIII, kinematic points**: a segment is a causal diamond (a, b); diamonds are ordered by sequencing, never by nesting; a readout predicate on diamonds is a kinematic region (its exterior past-closed, its hole future-closed) | `orbit.mjs` (`diamonds`, `sequencingCheck`, `kinematicRegion`, `visibilityRegion`, `commRegion`) |
| Players' plans merged into one sky | **Relational** cohomology of a merge: a union of histories is order-independent; two laws told at one (vessel, epoch) are a seam, H¹ ≠ 0, listed and never resolved silently; H¹ = 0 exactly when the plans are confluent | `orbit.mjs` (`mergePlans`, `seams`) |
| The vehicle as a structure | The body-bar **rigidity sheaf** (signgraph `cellular-sheaf`), read exactly over ℚ: H⁰ = infinitesimal motions, H¹ = self-stresses, loads as static equilibrium on the coboundary, failure as a told-against member (the FOUR ⊤ reading) firing in a settling flow | `structure.mjs` (`rigidity`, `loads`, `failure`); `vessel.mjs` (`stackDesign`) |
| Stages and propellant | Tsiolkovsky's rocket equation per stage (classical, not the Group's), held as a ledger beside the law history | `vessel.mjs` (`stagesOf`, `spend`, `deltaVLeft`) |
| Ascent | Fixed-step semi-implicit (symplectic) Euler under the parent's point gravity, with a gravity-turn steering programme and an apoapsis cutoff; dt a power of two so tick times are exact | `orbit.mjs` (`integrate`), `vessel.mjs` (`tellAscent`) |

Where the Group has no result yet (the rocket equation, the gravity turn) the classical result is
named as classical. The next place for Group mathematics is the atmosphere. Drag is a
dissipative flow, and the relational-physics idea note (`relational-physics-sim.md`, "flows,
nuclei, profiles, and towers evolving recognitions") is where its law should come from.

# Stored form

A flight is two cells on the player in Farstone's world: `spaceflight-stack` (part ids, top
first) and `spaceflight-mission` (vessel id, the stack flown, the told laws, the mission clock in
seconds, the propellant ledger). Derived successors (burnout coasts, sphere-of-influence handoffs)
are never stored. One player's two burns at one instant fold into one coast law. The game never
writes the seam that Holofoam would refuse.

These are FeltOS world cells, so they live in the world's SignCraft history (the flat-file
journal on the local host, the Durable Object's history on Cloudflare). Converting them to signed
SignCell predication cells with four-valued charge in a SEAVT journal is the Group's standing
direction and is pending the orchestrator's canonical call.

# The slice built (2026-10-10)

- Holofoam `src/vessel.mjs` with `test/vessel.test.mjs` (7 tests): stack → stages, Tsiolkovsky per
  stage, staging in the ledger, the structure design with decoupler joints, a staged ascent to an
  80 km apoapsis cutoff, circularization into an orbit with periapsis above 70 km, determinism,
  and a rocket too heavy to lift.
- Farstone `src/farstone-spaceflight.mjs` with `src/farstone-spaceflight.test.mjs` (7 tests),
  played through FeltOS as typed commands: parts, stack, unstack, rocket, launch, orbit,
  circularize, burn, warp, chart, recover. They play the same in the browser's text tier and over
  telnet.

# Ledger

The capability-by-capability comparison (R3) is the census in Farstone and the dated note beside
this specification. Every job carries a behavioral check that is also the met-when of its own
requirement record (`farstone-ksp-*` in the public-games section, and in the simulation section
for engine jobs). Count: meet 4, beat 4, partial 7, gap 10 (planet rotation built the same day: a body may carry a sidereal `rotationPeriod`, the launch starts with ω × r, and the gravity turn follows prograde relative to the turning ground).

# Not yet met

- `farstone-ksp:ship-builder` checks for a `*ship*` test in this section's own `test/` directory.
  The ship builder is engine work in Holofoam (`test/vessel.test.mjs`) and game work in Farstone
  (`src/farstone-spaceflight.test.mjs`); this section is not a package and has no test runner.
  Giving this section a package with a ship-builder test over both, or moving the condition, is a
  change to the requirement and goes through a new requirement record.
- Orbital launch platforms (R1's example) are a ledger gap: `farstone-ksp-orbital-launch-platforms`.
