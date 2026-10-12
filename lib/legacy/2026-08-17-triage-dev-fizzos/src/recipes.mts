/**
 * `@emsenn/fizzos/recipes` — crafting as the linear tensor-lollipop A ⊗ B ⊸ C.
 *
 * A recipe *consumes* its inputs (linear: they are used up, not copied) and *produces*
 * one output — exactly the linear-logic lollipop the world's conservation already
 * enforces. A recipe may require a held tool (a reusable `!`-resource) and a station
 * (a room tag), and it trains a skill that scales the result's quality. This is the
 * craft mechanic read straight off DESIGN §4.1, not bolted on.
 */
export interface RecipeInput {
  /** A tag the consumed material must carry. */
  readonly tag: string;
  readonly count: number;
}

export interface Recipe {
  /** The word you craft by (`craft <name>`). */
  readonly name: string;
  readonly inputs: readonly RecipeInput[];
  /** A tag a held tool must carry (reusable; not consumed). */
  readonly tool?: string;
  /** A tag the room must carry (a workbench/forge/galley). */
  readonly station?: string;
  /** The skill practised, whose level scales output quality. */
  readonly skill: string;
  readonly output: {
    /** The crafted item id stem (`<id>-<n>` per craft). */
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly tags: readonly string[];
  };
}

export const RECIPES: Readonly<Record<string, Recipe>> = Object.freeze({
  rope: {
    name: "rope",
    inputs: [{ tag: "fiber", count: 2 }],
    skill: "ropework",
    output: { id: "rope", name: "a coil of rope", description: "Hand-laid hemp rope, sound and strong.", tags: ["item", "takeable", "fiber"] },
  },
  plank: {
    name: "plank",
    inputs: [{ tag: "timber", count: 1 }],
    tool: "saw",
    skill: "carpentry",
    output: { id: "plank", name: "a sawn plank", description: "A fresh-sawn plank, fair and true.", tags: ["item", "takeable", "timber"] },
  },
  knife: {
    name: "knife",
    inputs: [{ tag: "iron", count: 1 }],
    tool: "hammer",
    station: "forge",
    skill: "smithing",
    output: { id: "knife", name: "a fish knife", description: "A short blade, ground keen.", tags: ["item", "takeable", "weapon", "weapon-damage:2", "value:6"] },
  },
  stew: {
    name: "stew",
    inputs: [{ tag: "fish", count: 1 }],
    station: "galley",
    skill: "cooking",
    output: { id: "stew", name: "a bowl of stew", description: "Hot fish stew, thick and good.", tags: ["item", "takeable", "edible", "nutrition:5"] },
  },
});
