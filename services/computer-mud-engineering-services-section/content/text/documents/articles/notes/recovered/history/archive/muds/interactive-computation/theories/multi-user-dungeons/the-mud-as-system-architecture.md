---
title: "The MUD as System Architecture"
date-created: 2026-04-04
description: "How the LPMud driver/mudlib pattern provides a concrete architecture for systems where the world is a knowledge base, the users are agents, and building is the primary activity."
relates-to:
  - mud
  - lpmud
  - mud-libraries
  - world-building-as-programming
  - convergence-through-minimum-viable-instance
---

The [MUD](./mud.md) tradition solved a problem that most software architectures never encounter: how to build a persistent, shared, navigable world where every object is simultaneously content (something you read), structure (something that connects to other things), and behavior (something that does things on its own). The [LPMud](./lpmud.md) lineage solved it most cleanly, with the [driver/mudlib separation](./mud-libraries.md) — the engine provides infrastructure and a language; the world is an application written in that language.

This text argues that the MUD architecture is not a game pattern that happens to resemble other systems. It is a general system architecture that happens to have been discovered first in games.

## The Pattern

A MUD has five structural elements:

1. **The driver** — handles connections, object lifecycle, the interpreter, I/O. It knows nothing about what the world contains. In LPMud, this is the C binary (MudOS, FluffOS). It provides the runtime.

2. **The mudlib** — written in the driver's language (LPC), defines every object type: rooms, weapons, NPCs, spells. It is the world's type system and its standard library. A room is a constructor that takes a name, description, exits, contents, actions, and trivia. A person is a constructor that takes a name, description, contents, and behavior.

3. **The map** — a flat registry of named locations, each defined by its exits (pointers to other locations by name). Navigation is following named relations between entities. The map is not a spatial data structure — it is a graph of typed entities with directed labeled edges.

4. **Recipes** — domain-specific constructors that specialize the mudlib's base types. A city defines `district` as a specialization of `area/outdoors` that injects city-specific trivia. An inn is a specialization of `area/room` that comes pre-furnished. Recipes compose: each layer adds its own context without replacing what's below.

5. **Builders** — people (or programs) who use recipes to create the world. The builder interface IS the programming interface. [World-building is programming](./world-building-as-programming.md).

## What This Maps To

Consider a system with a knowledge graph of 11,000+ entities, each with typed attributes (name, description, type, relations to other entities). The entities are organized into domains. There are agents that navigate the graph, read entities, create new ones, and modify existing ones. There is a daemon that monitors state and derives work. There is a TUI through which a human operator observes and directs.

This is a MUD. Specifically:

| MUD concept | System equivalent |
|---|---|
| Driver | The daemon binary — handles connections, sessions, I/O, the runtime |
| Mudlib | The type conventions — term, text, plan, task, project, goal, policy |
| Map | The knowledge graph — entities with typed relations, navigable by name |
| Room | A domain, a plan, a project — anything with contents and exits to other things |
| Object | A term, a text, a task — anything containable with a description |
| Person | An agent session — something that moves through the world and acts |
| NPC | A daemon loop, a scheduled process — something that acts on its own |
| Exits | Relations between entities — `relates-to`, `serves`, `blocks`, `part-of` |
| Recipes | Skills — domain-specific constructors (`writing-terms`, `writing-texts`, type conventions) |
| Builder | An agent using skills to create entities in the world |
| Trivia | Accreting metadata — each domain layer adds its own context |
| Look | Query — read an entity's description, contents, exits |
| Go | Navigate — follow a relation to another entity |
| Build | Write — create a new entity using the appropriate recipe |

## Why This Matters Architecturally

The MUD pattern answers architectural questions that are otherwise hard:

**How do you navigate a knowledge base?** The same way you navigate a MUD: you are "in" an entity, you see its description and contents, and you follow exits to related entities. This is not a metaphor — it is a concrete interaction pattern with 40 years of iteration behind it.

**How do you make agents spatial?** An agent has a location (the entity it's currently focused on). It can look (read), go (follow a relation), take (claim a task), build (create an entity), and tell (communicate with other agents in the same location). The MUD verb system maps directly to tool use.

**How do you compose domain knowledge?** The recipe pattern. Base types provide the universal structure. Domain recipes specialize them. Sub-domain recipes specialize further. Each layer adds its own trivia (metadata, conventions, defaults) without touching the layers below. This is exactly how a Teraum inn inherits from `area/room/inn` which inherits from `area/room` which inherits from `area`.

**How do you handle the driver/application boundary?** The same way LPMud does: the driver knows about entities, attributes, connections, and sessions. It does NOT know about what the entities mean. The mudlib (skills, type conventions, domain rules) defines meaning. This separation means the driver can be small, fast, and stable while the world grows without limit.

## The Teraum Precedent

The Teraum Racket MUD codebase (`operations/engineering/triage/software/teraum-racket-mud/`) demonstrates this pattern in ~300 lines of Racket. The base `recipes.rkt` defines `area`, `object`, `person` — each a constructor taking keyword arguments for qualities. The teraum-level recipes layer adds world-specific trivia and specializations (goblin, giant-spider, inn, rural-road). City-level recipes add city-specific trivia and types (district, street, store). Individual rooms are one-liners that invoke the appropriate recipe with a name, description, and exits.

The entire world is declarative. A room file is:

```racket
(define copper-ward
  (district
   #:name "Copper Ward"
   #:description "This is the Copper Ward, a district of the city of Ack."
   #:exits '((north . green-delta/game/ack/red-ward)
             (east . green-delta/game/ack/brass-ward))))
```

This is the same structure as a library term file:

```yaml
---
title: "Copper Ward"
introduces: term
description: "This is the Copper Ward, a district of the city of Ack."
relates-to:
  - red-ward
  - brass-ward
---
```

The formats differ. The data model is identical.
