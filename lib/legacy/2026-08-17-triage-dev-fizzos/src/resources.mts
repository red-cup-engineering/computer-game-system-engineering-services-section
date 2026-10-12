/**
 * `@emsenn/fizzos/resources` — harvestable resource nodes.
 *
 * A node is a room tagged `node:<resource>`; its `yield:<resource>` cell depletes as you
 * gather and regrows over ticks. Gathering produces a raw material item (skill-scaled)
 * that feeds crafting — closing the gather → craft → trade loop. Like everything, a node's
 * remaining yield is just a functional cell in the settled world.
 */
export interface ResourceNode {
  readonly resource: string;
  readonly skill: string;
  readonly max: number;
  /** Ticks between each unit of regrowth. */
  readonly regrowEvery: number;
  readonly item: { readonly name: string; readonly description: string; readonly tags: readonly string[] };
}

export const RESOURCES: Readonly<Record<string, ResourceNode>> = Object.freeze({
  fish: {
    resource: "fish", skill: "fishing", max: 5, regrowEvery: 6,
    item: { name: "a fresh fish", description: "A silver fish, fresh off the bank.", tags: ["item", "takeable", "fish", "edible", "nutrition:3"] },
  },
  fiber: {
    resource: "fiber", skill: "foraging", max: 6, regrowEvery: 5,
    item: { name: "a hank of hemp fiber", description: "Raw combed hemp, ready to lay into rope.", tags: ["item", "takeable", "fiber"] },
  },
  timber: {
    resource: "timber", skill: "woodcutting", max: 4, regrowEvery: 10,
    item: { name: "a baulk of timber", description: "A squared length of seasoned oak.", tags: ["item", "takeable", "timber"] },
  },
  iron: {
    resource: "iron", skill: "mining", max: 4, regrowEvery: 12,
    item: { name: "a lump of iron ore", description: "Heavy red ore, ready for the forge.", tags: ["item", "takeable", "iron"] },
  },
  stone: {
    resource: "stone", skill: "masonry", max: 8, regrowEvery: 9,
    item: { name: "a block of granite", description: "Squared grey granite, cut from the quarry — the island's own bones.", tags: ["item", "takeable", "stone"] },
  },
});

/** Verb aliases that gather a specific resource (bare `gather <resource>` works for any). */
export const GATHER_VERBS: Readonly<Record<string, string>> = Object.freeze({
  fish: "fish",
  forage: "fiber",
  chop: "timber",
  mine: "iron",
  quarry: "stone",
});
