/**
 * `@emsenn/fizzos/world-load` — turn an engine-neutral world *bible* (plain JSON:
 * rooms with exits, things with locations) into a live FizzOS world plus the
 * descriptive *content* the engine does not carry.
 *
 * The split is the architecture in miniature (Farstone `DESIGN.md` §2):
 *   - the **world** is a `@emsenn/fizzos` settled charge valuation — who/what is
 *     `located-in` where, and which room exits to which — the part with mechanics;
 *   - **content** is prose: names, descriptions, exit *directions*, tags. The engine
 *     has no opinion about it; verb dispatch reads it to render.
 *
 * Loading is pure: `loadBible(bible)` returns `{ world, content }` and mutates nothing.
 */
import { type Fact, type World, world } from "./world.mjs";

export interface BibleRoom {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly exits?: Readonly<Record<string, string>>;
  readonly tags?: readonly string[];
  /** A larger component this room is part of (a region, a sound) — the nesting morphism. */
  readonly partOf?: string;
}

export interface BibleThing {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly location?: string;
  readonly tags?: readonly string[];
  /** An NPC's reply when a conversation with it converges (DESIGN §4.5). */
  readonly speech?: string;
  /** The words a readable thing carries, shown by `read`. */
  readonly text?: string;
}

/**
 * A finite quest as a μ-type (DESIGN §4.6): it is complete exactly when the
 * constructed element exists — the `give` item is `located-in` the `to` recipient.
 * There is no `isComplete` flag to drift out of sync; completion is read off the world.
 */
export interface Quest {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly give: string;
  readonly to: string;
  readonly reward: string;
}

/** A room inside a ship: an ordinary room, flagged as the boarding deck and/or the helm. */
export interface BibleShipRoom {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly exits?: Readonly<Record<string, string>>;
  readonly tags?: readonly string[];
  /** The room players board into and disembark from. */
  readonly deck?: boolean;
  /** The room the ship is steered from. */
  readonly helm?: boolean;
}

/** A ship: a movable vessel that *is* a place — it carries its own rooms across the sea. */
export interface BibleShip {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly class: string;
  /** Where the ship floats: an ocean cell or a dock. */
  readonly location: string;
  readonly owner?: string;
  readonly hull?: number;
  readonly speed?: number;
  readonly cargo?: number;
  /** Price to buy outright; per-voyage rent. Either may be absent. */
  readonly price?: number;
  readonly rent?: number;
  readonly rooms: readonly BibleShipRoom[];
}

export interface Bible {
  readonly meta?: Readonly<Record<string, unknown>> & { readonly playerStart?: string };
  readonly rooms: readonly BibleRoom[];
  readonly items?: readonly BibleThing[];
  readonly npcs?: readonly BibleThing[];
  readonly quests?: readonly Quest[];
  readonly ships?: readonly BibleShip[];
}

export type ThingKind = "npc" | "fixture" | "item" | "thing" | "vessel";

export interface RoomContent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly exits: Readonly<Record<string, string>>;
  readonly tags: readonly string[];
}

export interface ThingContent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly location: string | undefined;
  readonly tags: readonly string[];
  readonly kind: ThingKind;
  /** The NPC's reply when a conversation converges; absent when it has nothing to say. */
  readonly speech: string | undefined;
  /** Whether the NPC evades — its conversation design never receives, so a cut diverges. */
  readonly evasive: boolean;
  /** The words a readable thing carries; absent when there is nothing to read. */
  readonly text: string | undefined;
}

/** A ship's static structure: its class, its boarding deck, its helm, and its rooms. */
export interface ShipContent {
  readonly id: string;
  readonly name: string;
  readonly class: string;
  readonly deckRoom: string | undefined;
  readonly helmRoom: string | undefined;
  readonly rooms: readonly string[];
  readonly price: number | undefined;
  readonly rent: number | undefined;
}

export interface Content {
  readonly meta: Readonly<Record<string, unknown>>;
  readonly rooms: Readonly<Record<string, RoomContent>>;
  readonly things: Readonly<Record<string, ThingContent>>;
  readonly ships: Readonly<Record<string, ShipContent>>;
  readonly quests: readonly Quest[];
  /** The display name of any nameable id — room or thing — falling back to the id. */
  nameOf(id: string): string;
  /** Whether a thing may be picked up: loose takeable gear or a purchasable ware. */
  isTakeable(id: string): boolean;
}

/** Classify a bible entry into a kind from its tags, for rendering decisions. */
function kindOf(tags: readonly string[] = []): ThingKind {
  if (tags.includes("npc")) return "npc";
  if (tags.includes("resource") || tags.includes("fixed")) return "fixture";
  if (tags.includes("item")) return "item";
  return "thing";
}

const takeable = (tags: readonly string[] = []): boolean => tags.includes("takeable") || tags.includes("ware");

/** Read a numeric tag like `health:30` → 30, or null when absent/non-numeric. */
export function numericTag(tags: readonly string[], prefix: string): number | null {
  for (const tag of tags) {
    if (!tag.startsWith(`${prefix}:`)) continue;
    const n = Number(tag.slice(prefix.length + 1));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Whether a thing's tags mark it hostile — it fights back on its tick. */
export function isHostile(tags: readonly string[] = []): boolean {
  return tags.includes("hostile") || tags.includes("stance:offensive");
}

/**
 * The settled facts a thing's id, tags, and location seed — placement, coin, container
 * state, known tongues, door state, and combat scalars (`health`/`attack` → cells, with
 * `condition:alive`). Used at load AND when cloning a thing into a fresh instance, so an
 * instanced monster comes up fully statted exactly as the bible one does.
 */
export function thingSeedFacts(id: string, tags: readonly string[], location: string | undefined): { e: string; a: string; v: string }[] {
  const facts: { e: string; a: string; v: string }[] = [];
  if (location !== undefined) facts.push({ e: id, a: "located-in", v: location });
  const coin = numericTag(tags, "coin");
  if (coin !== null) facts.push({ e: id, a: "coin", v: String(coin) });
  if (tags.includes("container")) facts.push({ e: id, a: "open", v: tags.includes("closed") ? "false" : "true" });
  for (const tag of tags) if (tag.startsWith("speaks:")) facts.push({ e: id, a: `language:${tag.slice("speaks:".length)}`, v: "true" });
  if (tags.includes("door")) facts.push({ e: id, a: "door-state", v: tags.includes("locked") ? "locked" : tags.includes("closed") ? "closed" : "open" });
  const health = numericTag(tags, "health");
  const attack = numericTag(tags, "attack");
  if (health !== null) {
    facts.push({ e: id, a: "health", v: String(health) });
    facts.push({ e: id, a: "max-health", v: String(health) });
    facts.push({ e: id, a: "condition", v: "alive" });
  }
  if (attack !== null) facts.push({ e: id, a: "attack", v: String(attack) });
  return facts;
}

/** The first room's id is the default player start when the bible names none. */
export function startRoomOf(bible: Bible): string {
  const named = bible.meta?.playerStart;
  if (typeof named === "string") return named;
  const first = bible.rooms[0];
  if (first === undefined) throw new TypeError("fizzos: bible has no rooms");
  return first.id;
}

/** Load a world bible into a live world plus its descriptive content. */
export function loadBible(bible: Bible): { readonly world: World; readonly content: Content } {
  const facts: Fact[] = [];
  const rooms: Record<string, RoomContent> = {};
  for (const room of bible.rooms) {
    const exits = { ...(room.exits ?? {}) };
    rooms[room.id] = { id: room.id, name: room.name, description: room.description, exits, tags: room.tags ?? [] };
    for (const dest of Object.values(exits)) facts.push({ e: room.id, a: "exit", v: dest });
    if (room.partOf !== undefined) facts.push({ e: room.id, a: "part-of", v: room.partOf });
  }
  const things: Record<string, ThingContent> = {};
  for (const entry of [...(bible.items ?? []), ...(bible.npcs ?? [])]) {
    const tags = entry.tags ?? [];
    things[entry.id] = {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      location: entry.location,
      tags,
      kind: kindOf(tags),
      speech: entry.speech,
      evasive: tags.includes("evasive"),
      text: entry.text,
    };
    facts.push(...thingSeedFacts(entry.id, tags, entry.location));
  }
  // Ships: each is a movable vessel that *is* a place. Its rooms become real rooms
  // tagged `ship-room` and joined to the ship by a functional `part-of` fact; the ship
  // itself is a thing `located-in` an ocean cell or dock, carrying its rooms with it.
  const ships: Record<string, ShipContent> = {};
  for (const ship of bible.ships ?? []) {
    things[ship.id] = {
      id: ship.id,
      name: ship.name,
      description: ship.description,
      location: ship.location,
      tags: ["ship", `class:${ship.class}`],
      kind: "vessel",
      speech: undefined,
      evasive: false,
      text: undefined,
    };
    facts.push({ e: ship.id, a: "located-in", v: ship.location });
    facts.push({ e: ship.id, a: "class", v: ship.class });
    facts.push({ e: ship.id, a: "hull", v: String(ship.hull ?? 10) });
    facts.push({ e: ship.id, a: "max-hull", v: String(ship.hull ?? 10) });
    facts.push({ e: ship.id, a: "speed", v: String(ship.speed ?? 1) });
    facts.push({ e: ship.id, a: "cargo-capacity", v: String(ship.cargo ?? 4) });
    if (ship.owner !== undefined) facts.push({ e: ship.id, a: "owner", v: ship.owner });

    let deckRoom: string | undefined;
    let helmRoom: string | undefined;
    const roomIds: string[] = [];
    for (const room of ship.rooms) {
      const roomTags = ["place", "ship-room", ...(room.tags ?? []), ...(room.deck ? ["deck"] : []), ...(room.helm ? ["helm"] : [])];
      rooms[room.id] = { id: room.id, name: room.name, description: room.description, exits: { ...(room.exits ?? {}) }, tags: roomTags };
      facts.push({ e: room.id, a: "part-of", v: ship.id });
      for (const dest of Object.values(room.exits ?? {})) facts.push({ e: room.id, a: "exit", v: dest });
      roomIds.push(room.id);
      if (room.deck) deckRoom = room.id;
      if (room.helm) helmRoom = room.id;
    }
    ships[ship.id] = { id: ship.id, name: ship.name, class: ship.class, deckRoom, helmRoom, rooms: roomIds, price: ship.price, rent: ship.rent };
  }

  const content: Content = {
    meta: bible.meta ?? {},
    rooms,
    things,
    ships,
    quests: bible.quests ?? [],
    nameOf: (id) => rooms[id]?.name ?? things[id]?.name ?? id,
    isTakeable: (id) => takeable(things[id]?.tags),
  };
  return { world: world(facts), content };
}
