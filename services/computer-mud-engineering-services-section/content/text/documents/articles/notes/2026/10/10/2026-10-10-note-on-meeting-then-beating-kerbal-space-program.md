---
title: "Note on meeting, then beating, Kerbal Space Program"
date-created: 2026-10-10
description: "Farstone's spaceflight game compared with Kerbal Space Program capability by capability, from KSP's own pages, with where Farstone is ahead, equal or behind, what has been learned since KSP was designed, and the check that decides each line."
keywords:
  - farstone
  - kerbal-space-program
  - meet-then-beat
  - census
provenance:
  serves: ../../../../../../../../content/requirements/farstone-orbital-flight-game-beyond-kerbal-space-program.json
  census: causeway-services/farstone data/records/2026-10-10-kerbal-space-program-capability-census.json
  specification: ../../../../specifications/2026-10-10-specification-farstone-orbital-flight.md
---

The Leader asked that Farstone "beat Kerbal Space Program using everything the world has learned
between when it was designed and now" (2026-10-08). This note is the comparison that requirement's
R3 asks for. The census in Farstone holds the evidence line by line. KSP's statements are copied
from its official site, its Steam page and its wiki, rendered headless on 2026-10-10 because the
wiki refuses plain fetches. Each line ends in a check: a command that passes only when the named
test exists and passes. The same command is the met-when of a requirement record named
`farstone-ksp-<line>`.

## Where Farstone is equal

- **Orbits.** KSP: "This decision by the game developers at Squad allows simplifying the n-body
  problem to a one-body problem." Holofoam flies the same model: exact two-body conics patched at
  spheres of influence, with continuity across each handoff and energy held over a thousand orbits.
- **First milestone.** KSP: "Reaching a stable orbit around Kerbin is one of the initial milestones
  a player might achieve in the game." A Farstone player stacks the Society's starter, launches
  from the rail on Mt Farstone and circularizes into a closed orbit about a world of Kerbin's size
  and gravity.
- **A turning world.** KSP's Kerbin: "Sidereal rotation period 21 549.425 s". Farstone's world turns
  the same, and the gravity turn steers by prograde relative to the ground.
- **Sandbox.** Every part is open.

## Where Farstone is ahead

- **Time warp.** KSP warps "up to 100 000×" and not under acceleration. Farstone's flight is a
  law, so warping a year is one evaluation of the conic; the test warps 365 days.
- **Exactness.** KSP: "Physical time warp can lead to inaccuracies in the physics calculation,
  possibly damaging the vessel." Farstone's coasts are exact and its arithmetic deterministic: the
  same rocket and commands give the same stored flight and the same history head on every node.
  That makes a flight replayable, auditable data, which is the point of the Group's content
  addressing.
- **A shared, persistent world.** KSP's Steam page lists it as "Single-player". Farstone's flights
  are kept in one durable world that many players inhabit at once.
- **Anywhere.** Every verb is typed, so the game is flown over telnet and in a browser's text tier.

What has been learned since KSP's design (2011–2015) and is used here: law-over-time trajectories
(the "on rails" idea taken all the way down), content-addressed deterministic simulation,
order-independent merging with conflicts counted as cohomology rather than overwritten, and
server-authoritative persistent worlds.

## Where Farstone is behind (the order of work)

1. **Atmosphere** (engine). KSP's Kerbin has air; Farstone's world has none, so its ascent is a
   vacuum ascent (~2,500 m/s to orbit against KSP's ~3,400). Planet rotation was in this place
   until the same day: the world now turns once in Kerbin's 21,549.425 s, and an eastward launch
   keeps the ground's 175 m/s.
2. **Maneuver planning.** Holofoam's `whatIf` already forks a plan and reads a candidate burn;
   Farstone has no `plan` command yet.
3. **The shared sky.** Holofoam already merges players' plans and counts seams; Farstone keeps
   each player's plan apart. Docking and rendezvous wait on it.
4. **Crew, and agentic crews.** KSP's Kerbals have "Stupidity and Courage". Farstone's folk have
   needs, routines and thoughts, but none fly yet. The beat the Leader named is characters who
   plan and fly missions themselves.
5. **Career and science.** Farstone has a coin economy, civics and progression, but launches are
   free and nothing is learned from orbit.
6. **Building.** Six parts on one axis against KSP's hundreds with radial symmetry; the structure
   sheaf already holds arbitrary part graphs.
7. **Orbital launch platforms**, the Leader's own picture, and **the 3D flight view**, which falls
   on the Group's own 3D engine requirement.

## Count

meet 4, beat 4, partial 7, gap 10, of 25 lines (2026-10-10, after planet rotation). The count is re-read by running the
checks, never by editing this note.
