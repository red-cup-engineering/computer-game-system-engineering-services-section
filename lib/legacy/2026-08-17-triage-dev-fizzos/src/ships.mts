/**
 * `@emsenn/fizzos/ships` — vessels as movable places.
 *
 * A ship is the cleanest expression of the charge world's containment: a ship is a
 * *thing* that is `located-in` an ocean cell or a dock, and its rooms are joined to it
 * by a functional `part-of` fact. A player stands in a ship room (`located-in` the
 * room); the room is `part-of` the ship; the ship is `located-in` the sea. So when the
 * ship sails — one functional `located-in` retraction on the ship — everyone aboard
 * moves with it for free, because they were never `located-in` the sea, only the room.
 * Conservation does the bookkeeping; nothing tracks "who is on the boat".
 *
 * These are pure reads over `World` + `Content`; the verb orchestration lives in the
 * scene.
 */
import { type World, contentsOf, placeOf, valueOf } from "./world.mjs";
import type { Content } from "./world-load.mjs";

/** Whether an id names a ship in this content. */
export const isShip = (content: Content, id: string): boolean => content.ships[id] !== undefined;

/** Whether a place is open ocean (you cannot stand on it; you sail it). */
export const isOcean = (content: Content, place: string): boolean => (content.rooms[place]?.tags ?? []).includes("ocean");

/** Whether a place is a dock — where ships tie up and people can step ashore. */
export const isDock = (content: Content, place: string): boolean => (content.rooms[place]?.tags ?? []).includes("dock");

/** Whether a room is a ship's helm (the steering point). */
export const isHelm = (content: Content, room: string): boolean => (content.rooms[room]?.tags ?? []).includes("helm");

/** The ship a room belongs to (its functional `part-of`), or null when it is not a ship room. */
export const shipOfRoom = (w: World, room: string): string | null => valueOf(w, room, "part-of");

/** The ship an actor is currently aboard (the ship of the room it stands in), or null. */
export function aboardShip(w: World, actor: string): string | null {
  const room = placeOf(w, actor);
  return room === null ? null : shipOfRoom(w, room);
}

/** The ocean cell or dock a ship currently floats in. */
export const shipPosition = (w: World, ship: string): string | null => placeOf(w, ship);

/** The ships floating in a place (dock or ocean cell). */
export const shipsAt = (w: World, content: Content, place: string): readonly string[] =>
  contentsOf(w, place).filter((id) => isShip(content, id));
