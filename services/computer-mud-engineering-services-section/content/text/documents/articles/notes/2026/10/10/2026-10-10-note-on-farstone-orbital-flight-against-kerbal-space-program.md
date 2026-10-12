---
title: "Note on Farstone orbital flight against Kerbal Space Program, capability by capability"
description: "The design comparison requirement R3 of farstone-orbital-flight-game-beyond-kerbal-space-program asks for: for each Kerbal Space Program capability, whether Farstone (on Holofoam, QwzSpace and FeltOS) is ahead, equal or behind today, what has been learned since KSP was designed, and what closes the gap."
date-created: 2026-10-10
authors: [Red Cup Engineer Senior]
status: design record
serves: debt-2026-10-09-farstone-beats-kerbal
realizes: farstone-orbital-flight-game-beyond-kerbal-space-program#R3
research:
  - science-services-section/services/natural-science-services-section/services/physical-science-services-section/services/astronomy-services-section/content/text/documents/articles/notes/2026/10/10/2026-10-10-note-on-patched-conics-and-n-body-gravitation-for-a-shared-spaceflight-world.md
  - science-services-section/services/natural-science-services-section/services/physical-science-services-section/services/physics-services-section/content/text/documents/articles/notes/2026/10/10/2026-10-10-note-on-integrators-coordinates-and-joints-for-a-spaceflight-game.md
  - science-services-section/services/social-science-services-section/services/social-theory-science-services-section/services/ludics-science-services-section/services/game-ludics-services-section/content/text/documents/articles/notes/2026/10/10/2026-10-10-note-on-kerbal-space-program-its-successors-and-shared-time-warp.md
---

"Today" means the house as of 2026-10-10. Holofoam's `structure`, `flight` and `orbit` modules exist and are tested; Farstone itself carries no flight yet. "Ahead" is judged on design and on code that exists, not on a shipped game: Farstone has no players flying. The measure that counts is outside evidence, and on that measure Farstone is behind on every row until the game ships.

| # | Capability | KSP (1.12.5) | House today | Verdict | Learned since KSP | What closes it |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Build a craft from parts | VAB/SPH, ~400 stock parts, symmetry, subassemblies | Holofoam `structure`: parts, masses, positions, welds, struts, decouplers, hinges as SignCraft cells; no builder UI | Behind (no UI) | Procedural parts (Juno: New Origins); in-world building in persistent worlds | Ship-builder on QwzSpace; parts as SignCell catalogue; procedural tanks/wings/fairings |
| 2 | Structural rigidity | PhysX joint springs, autostrut, wobble, Kraken | Exact body-bar rigidity sheaf over ℚ; mechanisms and self-stresses at design time; loads by deterministic CG | **Ahead** (design) | Reduced-coordinate articulations; one rigid body unless compliance is designed | Show H⁰/H¹ readout in the builder ("this joint is a mechanism") |
| 3 | Breakage | Joint force/impact tolerance thresholds | FOUR-⊤ settlement firing; failure flow re-settles until nothing fires; firings observed into history | **Ahead** (design) | Load-path failure | Couple to aerodynamic and thermal loads |
| 4 | Orbital mechanics | Patched conics, planets on rails | Patched conics, deterministic universal-variable coasts, SOI events by bisection | Equal | Hybrid conic/integrated propagation; precomputed n-body ephemerides; rotating-frame display (Principia) | Restricted n-body ephemeris as content-addressed segments; coast→integrated promotion by threshold |
| 5 | Lagrange points, halos, resonances | None (without Principia) | None | Equal (both absent) | Principia shows players fly them when displayed well | Row 4, plus rotating-frame trajectory display |
| 6 | Maneuver planning | Maneuver nodes on conics | `whatIf` forks the history and returns apsides and next SOI event; `reopenManeuver` replays | Equal, no UI | Integrated flight plans (Principia) | Maneuver-node UI over `whatIf`; plans over integrated segments |
| 7 | Time warp | Global, single-player; on-rails warp; physics warp ≤ 4× | `poseAt(plan, t)` any t at cost independent of warp; nothing ticked | **Ahead** (design) | Thrust under warp (KSP 2) | Powered segments under warp already work (they are laws); expose per-player clocks |
| 8 | Multiplayer | None (mods: Luna, DMP) | `mergePlans` = SignCraft history union, order-independent; contested (vessel, epoch) refused as an H¹ seam | **Ahead** (design) | Subspace catch-up (Luna) is fragile because state is mutable | Causal check on telling a law into another observer's past (kinematic diamonds) |
| 9 | Unloaded and distant craft | On rails beyond ~2.5 km; no thrust; atmospheric craft deleted | Every craft is a law; no "loaded" distinction | **Ahead** (design) | — | Keep it that way: never add per-tick state for craft |
| 10 | Numerical precision | float32 physics + floating origin + Krakensbane | float64 throughout, no frame hierarchy | Ahead but incomplete | 64-bit large-world coordinates; camera-relative rendering | Frame tree as SignCells: pose = (frame cell, local offset) |
| 11 | Determinism / replay | None; non-deterministic PhysX | Bit-identical across nodes; same history head every run | **Ahead** | Lockstep and replay verification | Golden-vector tests in the release gate |
| 12 | Aerodynamics and re-entry heat | Drag cube model since 1.0; heating | None | Behind | Dynamic drag and lift as the craft's shape changes (Juno) | Drag from part geometry; heat as Laplacian flow on the part graph |
| 13 | Propellant and mass flow | Resource flow between tanks, crossfeed | `orbit` powered segments have mass flow; `flight` mass is constant | Behind | — | Mass flow in `flight`; resources as FeltOS rate laws |
| 14 | Rigid ship in central gravity | Yes | No: the slice-3 rocket flies under uniform gravity, uncoupled from `orbit` | Behind | — | Couple `flight` bodies to `orbit` frames |
| 15 | Terrain and planets | PQS procedural terrain, scaled planets | QwzSpace icosahedral scene with exact quadratic geometry; no planet terrain | Behind | Quadtree cube-sphere LOD; GPU terrain | Icosahedral planet LOD on QwzSpace's exact geometry |
| 16 | Career, science, contracts | Tech tree, science, contracts, funding | Farstone civic arcs, progression, Director; no space career | Behind | — | Space career on Farstone's existing progression and economy |
| 17 | Colonies and logistics | None (KSP 2 promised) | FeltOS ecology and climate rate laws; harbor economy | Ahead in substrate, behind in content | — | Orbital launch platforms and stations as world places with economies |
| 18 | Crew | Kerbals with courage and stupidity | Agents and FeltOS persons | Ahead in substrate | — | Agents as crew, contract pilots, station keepers |
| 19 | Modding | Huge C# mod ecosystem | SignCell catalogues; no mod API | Behind | — | Parts, systems and laws as admitted cells; a mod is a history fragment |
| 20 | Platform | Desktop, consoles | Browser, with text fallback via FeltOS terminal | Different | 2D-first reach (Spaceflight Simulator) | 3D → 2D → text flight in one client |
| 21 | Graphics engine | Unity | QwzSpace, the Group's own; no third-party 3D library | Behind (immature) | — | farstone-3d-graphics-engine requirement |

## Summary

- **Ahead on architecture, from the Group's own mathematics:**
  - structure (rows 2–3: rigidity sheaf, settlement);
  - time and multiplayer (rows 7–9: law-not-state trajectories, H¹ seams);
  - determinism (row 11).
- **Equal on orbital mechanics** (rows 4–6).
- **Behind on everything a player touches:**
  - builder, aerodynamics, mass flow, terrain, career, graphics;
  - the coupling of a rigid ship to orbital gravity.

The specification `2026-10-10-specification-of-farstone-orbital-flight.md` and its high-level design `2026-10-10-farstone-orbital-flight-high-level-design.md` (both in this section) order the work so that the ahead rows stay ahead while the behind rows are built.

## Update, later on 2026-10-10: Farstone flies

The Sky Yard shipped (causeway-services/farstone#10). A Farstone player now walks to the summit
of Mt Farstone, stacks a rocket from catalogue parts, launches a staged gravity-turn ascent from
the Launch Rail and circularizes into a closed orbit about a turning world, then warps, burns and
charts it, over telnet and in the browser's text tier. Rows that moved:

- **Row 1** (build from parts): Behind → partial. A text builder over catalogue parts, one axis.
- **Row 7** (time warp): per-player clocks are exposed. Each flight warps on its own mission
  clock, a year in one call.
- **Row 13** (propellant): Behind → partial. Stages carry fuel; Tsiolkovsky Δv per stage; burns
  are paid from the attached stages (`vessel.spend`); no crossfeed.
- **Planet rotation** (not a row above): equal. The world turns in Kerbin's 21,549.425 s and an
  eastward launch keeps the ground's 175 m/s, with the gravity turn steered relative to the ground.

KSP's own wording for each line, read from its site, Steam page and wiki on 2026-10-10, and a
behavioral check per line are in Farstone's census
`data/records/2026-10-10-kerbal-space-program-capability-census.json` (meet 4, beat 4,
partial 7, gap 10 of 25 lines).
- **Row 12** (aerodynamics): Behind → partial. The world has air to 70 km (ρ₀ e^(−h/5600 m), cut
  at the edge as KSP cuts it). The ascent pays drag against the turning air from each part's drag
  area, and an orbit counts only above the air. Isp by pressure, lift, heating and drag on coasts
  (re-entry, aerobraking) are open. The law is in the aerospace section's note on the atmosphere
  of Farstone's world.
- **Row 6** (maneuver planning): Equal, now with a player-facing command. `plan` reads a burn
  through `whatIf`'s fork-and-read before it is made, and `execute` flies it; a planned 860 m/s
  burn from the 80 km orbit reaches the Moon's sphere of influence.

Count after these: meet 5, beat 4, partial 7, gap 9 of 25 lines.
