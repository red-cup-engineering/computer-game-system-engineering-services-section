/**
 * `@emsenn/fizzos/construction` — player building (meet-or-beat Minecraft, in the MUD's idiom).
 *
 * Minecraft's loop is gather → craft → **build the world itself**. Farstone already has gather and
 * craft; construction closes it. A player carrying the right materials can **raise a structure** —
 * a new room, attached to where they stand, that becomes a permanent, owned part of the island and
 * round-trips through persistence (the same authored-content path the creator's `@dig` uses, but
 * paid for in timber, iron, and the island's own granite rather than granted by fiat). The world
 * stops being only authored and starts being *built* — by the people who live in it.
 *
 * A structure is data (like a ship class or a recipe): a name, the materials it consumes, and the
 * tags the new room carries — so a smokehouse affords curing, a jetty is a dock you can moor at.
 */
export interface Structure {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Materials consumed, by the item *tag* that counts (timber/iron/stone) → how many. */
  readonly needs: Readonly<Record<string, number>>;
  /** Tags the raised room carries — what it then affords. */
  readonly tags: readonly string[];
  /** The skill the raising trains. */
  readonly skill: string;
}

export const STRUCTURES: Readonly<Record<string, Structure>> = Object.freeze({
  shack: { id: "shack", name: "a fishing shack", description: "A rough plank shack, tar-caulked against the weather — a place of your own on the cold waterfront.", needs: { timber: 4 }, tags: ["place", "indoor", "built", "shelter"], skill: "carpentry" },
  jetty: { id: "jetty", name: "a timber jetty", description: "A jetty of driven piles reaching out over the water, sound enough to moor a vessel against.", needs: { timber: 5 }, tags: ["place", "outdoor", "built", "dock"], skill: "carpentry" },
  smokehouse: { id: "smokehouse", name: "a smokehouse", description: "A timber smokehouse, racks hung for curing the catch over a slow alder fire.", needs: { timber: 3, iron: 1 }, tags: ["place", "indoor", "built", "craft", "forge"], skill: "carpentry" },
  cottage: { id: "cottage", name: "a granite cottage", description: "A low cottage of squared granite under a turf roof — built to outlast its builder, the way the island builds.", needs: { stone: 6, timber: 2 }, tags: ["place", "indoor", "built", "shelter", "social-hub"], skill: "masonry" },
  cairn: { id: "cairn", name: "a stone cairn", description: "A cairn of stacked granite, a marker on the bare ground that will stand long after you are gone.", needs: { stone: 4 }, tags: ["place", "outdoor", "built"], skill: "masonry" },
});

/** Whether a tally of carried materials (tag → count) covers a structure's needs; lists any shortfall. */
export function shortfall(structure: Structure, have: Readonly<Record<string, number>>): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const [mat, n] of Object.entries(structure.needs)) {
    if ((have[mat] ?? 0) < n) missing.push(`${n - (have[mat] ?? 0)} more ${mat}`);
  }
  return { ok: missing.length === 0, missing };
}

/** A human reading of what a structure costs. */
export const costOf = (s: Structure): string => Object.entries(s.needs).map(([m, n]) => `${n} ${m}`).join(", ");
