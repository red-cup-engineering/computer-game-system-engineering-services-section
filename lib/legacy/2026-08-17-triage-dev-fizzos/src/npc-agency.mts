/**
 * `@emsenn/fizzos/npc-agency` — NPCs that *act on their interiority* (utility-AI).
 *
 * The lore is explicit (`world/lore.md`): *"the hungriest go to the nearest food and deplete it…
 * nobody scripted the feud sharpening under scarcity; the social system read it off opposed traits
 * and shared contested ground."* This is where the NPC cabinets and needs stop being decoration and
 * start *driving behaviour*. Each tick a living NPC scores its options against its needs and acts on
 * the best — the Dwarf-Fortress move, where the world dramatizes itself without a hand on the wheel:
 *
 *   - **Hunger → eat.** A hungry NPC with food at hand eats it (and competes with the player and
 *     other NPCs for the same scarce catch — scarcity made real).
 *   - **Scarcity → feud.** Tempers shorten as needs press: a hungry NPC sharing a room with its
 *     declared **rival** turns on them. The feud is not scripted; it ignites when the lean season
 *     bites. Well-fed rivals coexist.
 *
 * Pure scoring here; the scene executes the chosen action against the world.
 */

/** What an NPC has decided to do this tick. */
export type NpcAction =
  | { readonly kind: "eat"; readonly item: string }
  | { readonly kind: "rest" }
  | { readonly kind: "work"; readonly resource: string }
  | { readonly kind: "move"; readonly dir: string }
  | { readonly kind: "attack"; readonly target: string }
  | { readonly kind: "idle" };

/** The NPC's situation as the chooser reads it off the settled world (assembled by the scene). */
export interface NpcSituation {
  readonly hunger: number;
  readonly rest: number;
  readonly company: number;
  /** An edible thing lying in the room, or null. */
  readonly edibleHere: string | null;
  /** The exit direction toward the nearest food, when none is here (scene BFS), or null. */
  readonly foodDirection: string | null;
  /** Whether the room is a place to rest (an inn, a shelter, a built home, the chapel). */
  readonly restHere: boolean;
  /** The exit direction toward the nearest resting place, or null. */
  readonly restDirection: string | null;
  /** A resource the NPC could work here (a node it has the trade for), or null. */
  readonly workHere: string | null;
  /** A co-located, living declared rival, or null. */
  readonly rivalHere: string | null;
  /** Whether a lasting grievance (e.g. the permit ruling) has been laid on this NPC. */
  readonly embittered: boolean;
}

/** The hunger at which an NPC will eat what's to hand. */
export const EAT_AT = 8;
/** The weariness at which an NPC seeks its bed. */
export const REST_AT = 10;
/** The hunger (tempers-short threshold) at which scarcity ignites a feud with a present rival. */
export const FEUD_AT = 6;

/**
 * Choose an NPC's action by utility — agency breadth, not a scripted pattern. A grudge-bearer
 * strikes its rival on sight; a hungry NPC eats or hunts food; a weary one beds down or seeks a bed;
 * scarcity ignites the feud; and an otherwise-content tradesperson *works* the resource at hand.
 * The result is a cast that pursues its own ends across the island, all tick, with no hand on it.
 */
export function chooseNpcAction(s: NpcSituation): NpcAction {
  const options: [number, NpcAction][] = [];
  if (s.rivalHere !== null && s.embittered) options.push([20, { kind: "attack", target: s.rivalHere }]);
  if (s.edibleHere !== null && s.hunger >= EAT_AT) options.push([10 + s.hunger, { kind: "eat", item: s.edibleHere }]);
  if (s.restHere && s.rest >= REST_AT) options.push([10 + s.rest, { kind: "rest" }]);
  if (s.rivalHere !== null && s.hunger >= FEUD_AT) options.push([6 + s.hunger, { kind: "attack", target: s.rivalHere }]);
  // The lore's drive: the hungriest go to the nearest food. Seeking it beats brawling over nothing.
  if (s.edibleHere === null && s.foodDirection !== null && s.hunger >= EAT_AT) options.push([7 + s.hunger, { kind: "move", dir: s.foodDirection }]);
  if (!s.restHere && s.restDirection !== null && s.rest >= REST_AT) options.push([6 + s.rest, { kind: "move", dir: s.restDirection }]);
  // Idle hands turn to the trade: a fed, rested tradesperson works the resource where they stand.
  if (s.workHere !== null && s.hunger < EAT_AT && s.rest < REST_AT) options.push([4, { kind: "work", resource: s.workHere }]);
  if (options.length === 0) return { kind: "idle" };
  options.sort((a, b) => b[0] - a[0]);
  return options[0]![1];
}
