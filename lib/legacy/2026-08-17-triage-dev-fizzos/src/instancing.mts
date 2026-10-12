/**
 * `@emsenn/fizzos/instancing` — instanced regions, the MMORPG capability FizzOS lacked.
 *
 * A **template** is a region of the world whose rooms share a `template:<name>` tag (one of
 * them also tagged `template:<name>:entry`). Instancing **clones** that region into a fresh
 * namespace (`inst-<n>-<roomId>`), rewriting internal exits to stay inside the copy, and
 * cloning the template's contents (a dungeon's monsters and loot) with them — each instanced
 * monster seeded with the SAME facts the bible one loads with (`thingSeedFacts`). A party
 * enters its own private copy; when empty, the copy is torn down. This is the dungeon-
 * instance / private-map standard, realized on the same runtime-room path the creator tools
 * already use — no new world model.
 */
import { type RoomContent, type ThingContent, thingSeedFacts } from "./world-load.mjs";

export const TEMPLATE_TAG = "template:";

/** The namespaced id a template member takes inside instance `n`. */
export const instanceMemberId = (instanceId: string, id: string): string => `inst-${instanceId}-${id}`;

export interface InstancePlan {
  readonly id: string;
  readonly template: string;
  readonly rooms: readonly RoomContent[];
  readonly things: readonly ThingContent[];
  readonly entry: string;
  /** The facts to tell so the cloned rooms/things come up placed and statted. */
  readonly facts: readonly { readonly e: string; readonly a: string; readonly v: string }[];
}

interface ContentView {
  readonly rooms: Readonly<Record<string, RoomContent>>;
  readonly things: Readonly<Record<string, ThingContent>>;
}

/**
 * Plan an instance of a named template: the cloned rooms (internal exits remapped into the
 * copy, exits leaving the template preserved as the way out), the cloned contents, the entry
 * room, and the world facts to assert. Returns null when no such template exists.
 */
export function planInstance(content: ContentView, templateName: string, instanceId: string): InstancePlan | null {
  const memberTag = `${TEMPLATE_TAG}${templateName}`;
  const templateRooms = Object.values(content.rooms).filter((r) => r.tags.includes(memberTag));
  if (templateRooms.length === 0) return null;
  const inside = new Set(templateRooms.map((r) => r.id));
  const remap = (id: string): string => (inside.has(id) ? instanceMemberId(instanceId, id) : id);

  const rooms: RoomContent[] = templateRooms.map((r) => ({
    id: instanceMemberId(instanceId, r.id),
    name: r.name,
    description: r.description,
    exits: Object.fromEntries(Object.entries(r.exits).map(([dir, dest]) => [dir, remap(dest)])),
    tags: [...r.tags.filter((t) => !t.startsWith(TEMPLATE_TAG)), "instance", `instance:${instanceId}`],
  }));

  const entryRoom = templateRooms.find((r) => r.tags.includes(`${memberTag}:entry`)) ?? templateRooms[0]!;
  const things: ThingContent[] = Object.values(content.things)
    .filter((t) => t.location !== undefined && inside.has(t.location))
    .map((t) => ({ ...t, id: instanceMemberId(instanceId, t.id), location: instanceMemberId(instanceId, t.location!) }));

  const facts = [
    ...rooms.flatMap((r) => Object.values(r.exits).map((dest) => ({ e: r.id, a: "exit", v: dest }))),
    ...things.flatMap((t) => thingSeedFacts(t.id, t.tags, t.location)),
  ];
  return { id: instanceId, template: templateName, rooms, things, entry: instanceMemberId(instanceId, entryRoom.id), facts };
}
