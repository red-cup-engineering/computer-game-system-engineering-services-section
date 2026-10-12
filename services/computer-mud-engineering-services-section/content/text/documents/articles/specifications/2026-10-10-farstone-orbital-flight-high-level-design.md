---
title: "Farstone orbital flight: high-level design"
date-created: 2026-10-10
authors: [Red Cup Engineer Senior]
status: draft
part-of: computer-mud-engineering-services-section
version: 0.1.0
derived-from: 2026-10-10-specification-of-farstone-orbital-flight.md
serves: debt-2026-10-09-farstone-beats-kerbal
---

# Farstone orbital flight: high-level design

## Shape

The design keeps one rule from Holofoam's existing modules and extends it to everything: **law, not state**. Nothing about a flying ship is written per tick. What is written is:
- the design;
- the segment laws keyed by (vessel, epoch);
- the events that change a law, such as throttle, staging, a firing member or a burn.

Every pose, load and temperature is derived by deterministic evaluation of those cells. Because of that:
- time warp is evaluation at a later t;
- owed world time is evaluation, not catch-up ticking;
- multiplayer is history merge;
- replay is identity.

The code is layered in the house dependency order, data → code → networking → systems.

```
data      SignCell catalogue (parts, systems, bodies) · ephemeris segments · designs · plans
code      Holofoam: structure → flight → orbit → ephemeris → frames   (pure, deterministic)
network   QwzSpace rooms: interest-filtered settled deltas; FeltOS sessions and terminal
systems   Farstone: authored world, contracts, economy, Director; FeltOS durable world host
```

## Components

1. **Catalogue** (data, Farstone-owned content on SignCell). Parts, procedural part generators (tank, wing, fairing as parameterized cells), engines, and celestial bodies. A mod is an admitted history fragment of catalogue cells (P5).
2. **Ephemeris** (new Holofoam module `ephemeris`).
   - Integrates the bodies once with a high-order symplectic composition: Wisdom–Holman with Yoshida or Blanes–Moan coefficients, at fixed dt.
   - Fits Chebyshev segments per body per interval and observes each segment as a content-addressed cell.
   - The ephemeris head address names the sky (G1).
   - The existing `DEFAULT_SYSTEM` becomes its first input; bodies on fixed Keplerian rails remain a degenerate ephemeris.
3. **Frames** (new Holofoam module `frames`).
   - A tree of frame cells: inertial root, then a body-fixed frame per body, then a vessel frame per vessel.
   - A pose is (frame, offset) in float64. Transforms are derived from the ephemeris at t.
   - Rendering asks for poses relative to the camera's frame, so QwzSpace never sees large coordinates (G5).
4. **Structure** (existing `structure.mjs`). Rigidity sheaf, loads and failure flow as today. It is extended so loads include aerodynamic, thermal and thrust terms supplied by flight (S4), and so the builder can query mechanisms and self-stresses (B2).
5. **Flight** (existing `flight.mjs`). Rigid bodies of the settled design under thrust.
   - Extended: mass flow, a leapfrog or Yoshida-4 step at the same power-of-two dt, and gravity from the dominant body's frame instead of uniform gravity (G3; comparison row 14).
   - Staging and firing keep their T1/T2 semantics.
6. **Orbit** (existing `orbit.mjs`).
   - Patched-conic coasts, powered segments, SOI bisection, `poseAt`, `mergePlans`, `seams`, `diamonds`, `whatIf`.
   - Extended: an *integrated coast* law under the ephemeris, and a promotion test from the third-body acceleration ratio (G2, G7; M10).
   - Integrated coasts are memoised by content address, so a pose request costs one lookup after first evaluation (G4).
7. **Horizon** (new, in `orbit`). For each (player, vessel), the latest epoch read. Telling a law at an epoch before another player's horizon for that vessel is refused (T4). The check is the diamond sequencing already in `orbit.mjs` (M6).
8. **Thermal** (new Holofoam module). Heat as a Laplacian flow over the part graph, with re-entry flux as the source (S4; M7).
9. **QwzSpace client** (existing engine, new views).
   - 3D: icosahedral planet LOD on exact geometry (M9), ships, trajectories in inertial, body-fixed and rotating frames.
   - 2D: orbital map and side view.
   - Text: a flight console in FeltOS's terminal (B4, P7).
   - The shared HUD (labels, minimap, chat, hotbar) is QwzSpace's own, as the Leader directed on 2026-10-03.
10. **Farstone game** (systems).
    - Space places: launch sites, orbital launch platforms, stations at Lagrange points.
    - Contracts and crews on the existing progression and economy (P3).
    - Agents as pilots and station keepers through the same commands as players (P4).
    - The world host pays owed time by evaluation (T5).

## Flow of one launch

1. A player edits a design in the builder. Every edit is a cell. The builder reads mechanisms and self-stresses from the rigidity sheaf and shows them.
2. Launch tells a powered segment at the launch epoch.
3. QwzSpace subscribes the player's room to the vessel. Each tick it projects the derived pose relative to the camera frame.
4. Throttle, staging and firings tell new segments. Structure re-settles under the loads at that tick. Firings are observed.
5. At burnout the successor is a coast. The orbit module derives whether it is conic or integrated, and derives its end: SOI change, impact or promotion.
6. The player warps their view clock. `poseAt` is evaluated at the later t. Other players are unaffected.
7. A second player plans a rendezvous. Both plans merge as a union. A burn told into the first player's horizon is refused. A conflicting burn at one epoch is a seam shown to both.

## What moves where

- Holofoam stays the only physics. Farstone carries no physics and no renderer (farstone-3d-graphics-engine R3).
- QwzSpace stays the only renderer and client. No third-party 3D library is added (F19).
- FeltOS stays the world host. Its request-driven clock gains evaluation-based catch-up for flight laws.
- Anything in FeltOS that is Farstone-specific moves to Farstone. This follows the Leader's "one FeltOS and one Farstone" direction (2026-09-22, ni:///sha-256;8QeX5fVcgXavTD52-K8h-wrzTXCD7aZxWml_5jMdFUg).

## Order of work

Research first, then specifications, then SAS, HLD, LLD and engineering, as the Leader ordered on 2026-10-08.

1. Couple `flight` to `orbit` frames with mass flow (comparison row 14). Without it there is no launch to orbit.
2. Frames, so that ephemeris and rendering share one pose model.
3. Builder on QwzSpace with the rigidity readout. This keeps the existing lead visible.
4. Ephemeris and integrated coasts, which bring Lagrange points.
5. Horizons and per-player clocks.
6. Aerodynamics and thermal.
7. Contracts, stations, platforms and agents in Farstone.

## Risks

- Determinism of the high-order composition under deterministic-math's operation order is untested.
- Memoising integrated coasts by address needs a bounded cache. The Farstone tests already exhausted about 7 GB when run in parallel (Leader, 2026-10-03).
- QwzSpace's 3D tier is immature (comparison row 21). The orbital game puts heavy pressure on it, which the Leader welcomed ("hellllla pressure on our bespoke 3d graphics engine ... which is great").
