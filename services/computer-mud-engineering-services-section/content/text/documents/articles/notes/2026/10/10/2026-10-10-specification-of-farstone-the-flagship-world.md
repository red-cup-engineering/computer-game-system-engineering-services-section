---
title: "Specification of Farstone, the flagship world"
description: "Red Cup Engineering's specification of Farstone outside its orbital game: one persistent SignCell world that runs without a hand, played as a browser MMORPG and as a MUD, sold as a download and as server access, growing a spaceflight region, drawing media from the Group's other channels, and feeding its engine gains back to the MetroPlat servers."
date-created: 2026-10-10
type: specification
status: draft
authors:
  - red-cup-engineer-senior
keywords:
  - farstone
  - specification
  - mmorpg
  - mud
  - qwzspace
  - abrash
  - holofoam
  - signcell
x-provenance:
  pass: farstone-ksp-2
  request: debt-2026-10-09-leader-words-held-in-corpus
  requirements:
    - public-games-services-section/content/requirements/farstone-flagship-world.json
    - public-games-services-section/content/requirements/farstone-downloadable-and-sellable.json
    - graphical-computer-interface-system-services-sections/content/requirements/farstone-3d-graphics-engine.json
    - computer-simulation-system-services-section/content/requirements/holofoam-as-physics-simulation-engine.json
    - 561-group-services-section/content/requirements/farstone-pressure-upstream-on-the-groups-methods.json
  research: game-ludics-services-section/content/text/documents/articles/notes/2026/10/10/2026-10-10-note-on-farstone-as-a-flagship-mmorpg-sold-and-self-hosted.md
  utterances:
    - "ni:///sha-256;6xGuWyJF8FUCGtwmYxBv6ERAsei0kNVQOSWi1JzlTn8"
    - "ni:///sha-256;nX48bLCnuNp5CmJtvTkkWMiGVq0Qx4iE3B0bKTQvRVc"
    - "ni:///sha-256;OyRuhOjz7BSMjgw3xQW_EXV83l4yIlR4iv-xC_noRnI"
    - "ni:///sha-256;XsCg9q5v4CHtS8YLqwgB-E8LEN97f9CrcuoIXtkJwuE"
    - "ni:///sha-256;YOE2FgbeX_jrVNu9J_kSpO4KLY7vUv_3WGmRXDOr-Wo"
---

## Scope

This specification covers Farstone as a world and a product. The orbital spaceflight game inside it, its physics and its comparison with Kerbal Space Program are specified by pass farstone-ksp-1 at `computer-game-system-services-section` and are referred to here only where the world meets them. It realizes `farstone-flagship-world` (R1–R11) and states how the held requirements `farstone-downloadable-and-sellable`, `farstone-3d-graphics-engine`, `holofoam-as-physics-simulation-engine` and `farstone-pressure-upstream-on-the-groups-methods` fit one design. It describes the code as it should be, not as it is; the Farstone repository (`causeway-services/farstone`, mounted at `public-web-games-services-section/sites/farstone.561.group`) is aligned to it, not read for design.

## The world

1. **One world, many faces (R1, R2).** Farstone is one persistent world. Its places, characters, items and events are SignCells in one content-addressed history. A face is a projection of that history: the browser face draws it in 3D; the MUD face renders the same rooms, characters and events as text over a line protocol; further faces (the spaceflight region's flight view, a map, a Semioverse view) are further projections. No face holds state the history does not hold.
2. **A world that runs without a hand (R3).** The world advances on a fixed tick that is a transaction boundary over its append-only history. Each tick admits queued intents (players, non-player characters, world law), folds the touched subjects and projects settled deltas to subscribers. Non-player characters act through the same intent path as players. Events are settlings of the world's own records under its law, as Permit #23 settles to ⊤ in the QBN design: an operator admits law and content; no operator drives play. The world's monitor-analyze-plan-execute loop reads the history and admits law changes as governed acts, never as hand edits to state.
3. **Everything is SignCells (R6).** Entities, their predications, media references and law are SignCells; histories are SignChains; the world's relations are a SignGraph; inference over the history (what a character knows, what an NPC plans) is SignCraft. This is what lets replay, federation and the Semioverse view work on Farstone with no adapter.
4. **The spaceflight region (R4).** The orbital game is a region of the same world. A character walks to a launch site, builds a ship (an orbital launch platform is one kind of ship) from parts held as items, and flies it; the flight state is simulated by Holofoam and enters the world history as SignCells at the world's tick. Fantasy and sci-fi regions share one clock, one economy and one cast; that shared world is how Farstone grows sci-fi wings. Orbital mechanics, integrators, time warp in a shared world and part physics are pass farstone-ksp-1's specification.

## The engines

| Concern | Engine | Section | Held requirement |
|---|---|---|---|
| World tick, rooms, intents, resume, replay-verifiable rooms, scene | QwzSpace | computer-web-engineering-services-section/apps/qwzspace | farstone-3d-graphics-engine |
| Software 3D rendering into a framebuffer, browser and headless | Abrash | graphical-computer-interface-system-services-sections/apps/abrash | farstone-3d-graphics-engine R2 |
| Physics simulation, deterministic replayable histories | Holofoam | computer-simulation-system-services-section/apps/holofoam | holofoam-as-physics-simulation-engine |
| Cells, chains, graphs, inference | SignCell, SignChain, SignGraph, SignCraft | computer-engineering-services-section/lib/signstuff | — |
| A sibling game proving the merge-of-traces arena on Abrash | Durante | public-web-games-services-section/sites/durante.play.561.group | farstone-3d-graphics-engine R2 |

This specification takes QwzSpace as the engine the world runs on and Abrash as the renderer the browser face draws through, because QwzSpace already holds the tick, room and replay semantics a world needs and its scene module holds render tiers, and Abrash is the house's only 3D renderer that runs both in a canvas and headless. It closes, for Farstone, the intake's open question "which held engine is the bespoke 3D graphics engine"; the graphics section's own specification may supersede it. Each engine lives in its own repository on its upstream packages (R2 of `farstone-3d-graphics-engine`); Farstone consumes them as packages and carries no engine of its own.

## The product

5. **Order of delivery (R5).** The 3D view comes first; the downloadable build follows and includes it. A download without the 3D view is not released.
6. **Two artefacts, one engine (R7).** The download is a client plus a local world server, running offline on the player's machine (`farstone-downloadable-and-sellable` R1). The server sold or rented to a buyer is the same world server with the same record format (`farstone-downloadable-and-sellable` R2). The flagship world at farstone.561.group is one instance of it. Because every instance is a SignCell history, a buyer's world can federate with the flagship by the substrate's algebra; whether it does is an open decision in the research note.
7. **Offer and release.** The offer states what a buyer receives and pays for the game and for server access; the release crosses the external boundary only after its responsible office records that it stands behind it (`farstone-downloadable-and-sellable` R3, R4).

## Media

8. **Borrowed media (R8).** Media generated for another Group channel enters Farstone's media library when its subject is free of that channel's setting. The first candidates are the generated pieces made for a Sigrid Song video channel on 2026-10-04/05 that do not show Duluth's Aerial Lift Bridge; the Leader decided that channel is not made and that Sigrid Song does not need that material.
9. **Custody (R9).** Media is held in a channel repository or the release artifact store and referenced from the world by content address; never as untracked binaries in the superrepo.
10. **Disclosure (R10).** Each media item records whether it was generated. Where the distributing platform or law requires disclosure (Steam's content survey does, for pre-generated and live-generated content), the release discloses it; elsewhere the default is not to.

## Pressure upstream and the MetroPlat servers

11. Each defect Farstone finds in an engine it consumes is recorded as an obstacle against that engine's section, not patched in Farstone (`farstone-pressure-upstream-on-the-groups-methods` R1). The effort runs as one endeavor whose research, specification, SAS, HLD, LLD and engineering are staged in that order (R2 there).
12. The MetroPlat servers on Bare Cedar Fog and Cold Red Gate run the engine releases the Farstone effort produces, and draw the 561 Group Semioverse, the content-addressed foam of semiotic cells, through the same renderer (`farstone-flagship-world` R11; `farstone-3d-graphics-engine` R4).

## Open

- The responsible office for Farstone's first-contact release is not named.
- Whether buyers' worlds federate with the flagship world.
- The MUD face's line protocol (telnet, websocket text, or both).
- The legacy content wells (seed island, harbor, tale, wild) still to be judged against this design.
