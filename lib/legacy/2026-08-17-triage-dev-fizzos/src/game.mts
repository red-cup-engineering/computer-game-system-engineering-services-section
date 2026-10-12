/**
 * `@emsenn/fizzos/game` — the engine/game seam.
 *
 * FizzOS is a *general* world-simulation engine; a **game** parameterizes it. The engine core
 * (the scene, the tick, the field/closure/instance/federation machinery) knows nothing of
 * harbors or pollution or fizzwater — it runs whatever a `GameDefinition` declares. Farstone
 * is one such definition (`farstone-game.mts`); another world supplies its own. This is the
 * Unity-style split: the engine is the runtime, the game is the data + rules fed to it.
 *
 * A definition declares the *parameterizable* systems. Today that is the closure rules its
 * world settles under and the scalar fields that diffuse across it; the affordance vocabulary
 * may be overridden too. (The content — rooms, things, NPCs — is the bible, separate data.)
 */
import type { Fact, World } from "./world.mjs";
import type { Affordance, ClosureRule } from "./predication.mjs";
import type { WareType } from "./market.mjs";
import type { Recipe } from "./recipes.mjs";
import type { ResourceNode } from "./resources.mjs";
import type { ShipClass } from "./ship-classes.mjs";
import type { Profession } from "./social.mjs";
import type { Soul } from "./soul.mjs";
import type { Faction } from "./reputation.mjs";
import type { WeatherModel } from "./world-clock.mjs";

/**
 * The genre-toolkit catalogs a game supplies. FizzOS ships a batteries-included genre layer —
 * trading, crafting, harvesting, ships, professions, soul emotes, a commons of laws — the way
 * Unity ships physics and terrain; this is the *data* that drives it. A game overrides any
 * catalog (the rest fall back to the engine's Farstone defaults); a game that uses none of the
 * genre verbs ignores it entirely.
 */
export interface GameCatalogs {
  readonly wares?: Readonly<Record<string, WareType>>;
  readonly recipes?: Readonly<Record<string, Recipe>>;
  readonly resources?: Readonly<Record<string, ResourceNode>>;
  readonly gatherVerbs?: Readonly<Record<string, string>>;
  readonly shipClasses?: Readonly<Record<string, ShipClass>>;
  readonly professions?: Readonly<Record<string, Profession>>;
  readonly souls?: Readonly<Record<string, Soul>>;
  readonly factions?: Readonly<Record<string, Faction>>;
  readonly laws?: readonly string[];
}

/**
 * The SDK standard library — the engine API a game's hooks and commands are handed. A game
 * reads and writes the world, places things, and speaks to players through this facade; it
 * never touches the scene internals. This is FizzOS's authoring surface (the `love.*` of a
 * text-world engine): everything a game needs, nothing it shouldn't reach.
 */
export interface GameContext {
  readonly tick: number;
  /** The resolved genre catalogs (the game's, over the Farstone defaults) — reusable toolkit data. */
  readonly catalogs: Required<GameCatalogs>;
  /** Assert facts into the world (the unit of all state change). */
  tell(facts: readonly Fact[]): void;
  /**
   * Transform the world with any `World → World` function — the SDK escape hatch. Lets a game
   * compose engine helpers (moves, settlements, the genre toolkit's own functions) atomically,
   * so a game can build any system the engine can. The engine remains the sole writer; this is
   * how first-party toolkit code and advanced games reach the full algebra.
   */
  apply(transform: (world: World) => World): void;
  /** Read a functional cell, or a numeric one with a fallback. */
  value(entity: string, predicate: string): string | null;
  number(entity: string, predicate: string, fallback?: number): number;
  /** Move or place an entity into a room. */
  place(entity: string, room: string): void;
  /** The room an entity stands in. */
  roomOf(entity: string): string | null;
  /** The things located in a room. */
  contentsOf(room: string): readonly string[];
  /** The display name of an entity. */
  nameOf(id: string): string;
  /** The content tags of a room or thing. */
  tagsOf(id: string): readonly string[];
  /** Send a line to one player. */
  message(actor: string, text: string): void;
  /** Send a line to every player in a room. */
  broadcast(room: string, text: string): void;
  /** All room / thing ids in the world. */
  rooms(): readonly string[];
  things(): readonly string[];
  /** The currently-joined players — for systems (a Director, the thought cabinet) that act on them. */
  players(): readonly string[];
}

/** A custom verb a game contributes: it acts and returns the line the actor sees. */
export type GameCommand = (ctx: GameContext, actor: string, arg: string) => string;

/** A custom per-tick system a game contributes — an agent that advances the world. */
export type GameSystem = (ctx: GameContext) => void;

/**
 * A scalar field that diffuses across a sub-graph of the world each tick, by exact
 * graph-Laplacian heat flow (`@emsenn/fizzos/fields`). Pollution over the open water, scent
 * down corridors, heat through a dungeon — all the same machinery, differing only in which
 * rooms carry the field and which cell holds its value.
 */
export interface FieldSpec {
  /** A stable name (also the cache key for the field's sub-graph). */
  readonly name: string;
  /** Diffuse over the sub-graph of rooms carrying this tag. */
  readonly overTag: string;
  /** The functional predicate holding the field's value at each room. */
  readonly predicate: string;
  /** Heat-flow rate per tick (must be ≤ 1/max-degree of the sub-graph for stability). */
  readonly rate: number;
}

/**
 * A game that parameterizes the engine. The scene runs `worldRules` in its closure agent and
 * diffuses `fields` in its field agent, knowing nothing of what they mean; `affordances`, when
 * given, replaces the default computed-action vocabulary. A game with empty systems is a bare
 * world — the engine still ticks, perceives, moves, and instances; it simply settles nothing
 * extra and diffuses nothing. Extend this interface as more systems become parameterizable.
 */
export interface GameDefinition {
  readonly name: string;
  /** Closure rules fired to a fixpoint each tick. */
  readonly worldRules?: readonly ClosureRule[];
  /** Scalar fields diffused across tagged sub-graphs each tick. */
  readonly fields?: readonly FieldSpec[];
  /**
   * The game's climate: a season-conditioned Markov transition matrix the world-clock advances
   * each phase boundary (seeded, replayable). Unset falls back to the engine's temperate default.
   */
  readonly weather?: WeatherModel;
  /** Overrides the default computed-action vocabulary. */
  readonly affordances?: readonly Affordance[];
  /** Custom verbs, keyed by the word that invokes them (engine verbs take precedence). */
  readonly commands?: Readonly<Record<string, GameCommand>>;
  /** Custom per-tick systems — agents the game contributes to the tick pipeline. */
  readonly systems?: readonly GameSystem[];
  /** The game's own single-valued predicates — registered functional so their traces compact. */
  readonly functional?: readonly string[];
  /** Genre-toolkit catalogs (wares, recipes, ships, professions, …); unset ones default to Farstone's. */
  readonly catalogs?: GameCatalogs;
  /** Ecology: when set, cells tagged `tag` live (fish grow, pollution decays). Off when unset. */
  readonly ecology?: { readonly tag: string };
  /**
   * Whether the built-in genre verbs (trade, craft, harvest, ships, the commons, professions)
   * are offered. Defaults to `true` (batteries included); set `false` for a generic engine
   * whose only verbs are the core (look/go/take/say/…) plus the game's own `commands`.
   */
  readonly genre?: boolean;
  /** Called once, before the first tick — seed world state and content (`love.load`). */
  onLoad?(ctx: GameContext): void;
  /** Called each tick after the engine's own agents — the game's update step (`love.update`). */
  onTick?(ctx: GameContext): void;
}

/** The neutral game: a bare world with no extra settling and no fields. The engine's unit. */
export const NEUTRAL_GAME: GameDefinition = Object.freeze({ name: "neutral" });
