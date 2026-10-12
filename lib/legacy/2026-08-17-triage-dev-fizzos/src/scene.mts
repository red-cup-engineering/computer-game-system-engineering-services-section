/**
 * `@emsenn/fizzos/scene` — the live MUD scene: the sole-writer world plus FizzOS's
 * verb dispatch, in the exact surface the contemporary realtime transport
 * (`@emsenn/organizing-with-the-web/qwzspace`) drives: `runTick`, `subjectsOf`,
 * `snapOf`, and the per-subscriber `interest` that IS the perception fiber.
 *
 * The scene holds the current settled world (a `@emsenn/fizzos` charge valuation) and
 * the descriptive content. It is the sole writer: player commands are queued as
 * intents and applied only inside `runTick` (Farstone `DESIGN.md` §3). Each command is
 * verb dispatch — a typed move folded into the world by the engine's conserving
 * `take`/`drop`/`give`/`go` and per-fiber `perceive`. Prose lives in content; mechanics
 * and truth live in the engine.
 */
import {
  type Fact,
  type World,
  contentsOf,
  drop as engineDrop,
  factsOf,
  give as engineGive,
  go as engineGo,
  numberOf,
  perceive,
  placeOf,
  registerFunctional,
  settledFacts,
  take as engineTake,
  tell,
  valueOf,
  world,
} from "./world.mjs";
import { converges, daimon, designFromActs, locusKey, root, type Design } from "@emsenn/gaming";
import { type Content, type RoomContent, type ShipContent, type ThingContent, isHostile, numericTag } from "./world-load.mjs";
import { SHIP_CLASSES } from "./ship-classes.mjs";
import { RECIPES } from "./recipes.mjs";
import { GATHER_VERBS, RESOURCES } from "./resources.mjs";
import { STRUCTURES, costOf, shortfall } from "./construction.mjs";
import { type ThoughtSignals, THOUGHTS, beginThought, internalizeStep, isFixed as thoughtIsFixed, thoughtReport } from "./thoughts.mjs";
import { type CampaignView, OFF_SEASON, campaignReport, stageAt } from "./campaign.mjs";
import { drawFish, ecologyReport, ecologyStep, emitPollution, fishStock, pollutionOf } from "./ecology.mjs";
import { LAWS, type Law, enact, isLaw, lawValue, proposalValue, propose, support, supporterCount } from "./governance.mjs";
import { BUY_PRESSURE, SELL_PRESSURE, SELL_RATIO, WARES, easeToward, regionalPriceBase, regionalStockBase, wareTypeOfTags } from "./market.mjs";
import { aggregateCharge } from "./components.mjs";
import { advanceClock, hashStr, isFoul, phaseChangesAt, phaseOf, rngFor, seasonOf, tideOf, timeReport, weatherOf, worldSeed, worldTime } from "./world-clock.mjs";
import { type DialogueView, type InteriorityView, type NpcView, type RegardView, FACULTIES, FACULTY_MAX, cabinetReport, cabinetSeed, dialogueLines, facultyLevel, interiorityLines, practiseFaculty, regardLines, renderWhisper } from "./interiority.mjs";
import { FACTIONS, dispositionOf, factionsOfTags, priceMultiplier, reputationReport, shiftStanding, standingOf, willTrade } from "./reputation.mjs";
import { bountyLine, flagCrime, isLawfulArea, payBounty } from "./crime.mjs";
import {
  PROFESSIONS, awardXp, enroll, follow, followingOf, foundGuild, guildId, guildLeader, guildName, guildOf,
  joinParty, leaveParty, partyOf, profess, professionOf, resign, titleFor, xpOf,
} from "./social.mjs";
import { SOULS, fillSoul } from "./soul.mjs";
import { believe, driftNeeds, moodEmote, moodOf, relieve } from "./npc-life.mjs";
import { chooseNpcAction } from "./npc-agency.mjs";
import { aboardShip, isDock, isHelm, isOcean, shipPosition, shipsAt } from "./ships.mjs";
import { read as readLisp, runProgram } from "./lisp.mjs";
import { effectiveBonus, practise, skillBonus, skillOf, skillTier } from "./skills.mjs";
import {
  type Fiber, AFFORDANCES, affordances, bodyOf, carriesWordId, closeWorld, entangle,
  entanglementsOf, fold, inhabit, isSettledDead, release, unfold, vocabularyOf, wordFor,
} from "./predication.mjs";
import { planInstance } from "./instancing.mjs";
import { type WorldGraph, diffuse, worldGraph } from "./fields.mjs";
import { type FieldSpec, type GameCatalogs, type GameContext, type GameDefinition } from "./game.mjs";
import { FARSTONE_GAME } from "./farstone-game.mjs";

/** A fresh player's starting vitality and purse. */
const PLAYER_HEALTH = 20;
const PLAYER_ATTACK = 4;
const PLAYER_COIN = 25;

const capitalize = (text: string): string => (text.length === 0 ? text : text[0]!.toUpperCase() + text.slice(1));

/** Verbs that put words into the world — gated by moderation mute. */
const SPEECH_VERBS = new Set(["speak", "say", "'", "emote", "me", ":", "tell", "whisper", "chat", "ooc", "gossip"]);

/**
 * The built-in *genre* verbs — trade, craft, harvest, ships, the commons, professions. They
 * are batteries-included but optional: a game with `genre: false` runs the engine without
 * them, leaving only the core verbs and its own `commands`.
 */
const GENRE_VERBS = new Set([
  "buy", "sell", "list", "wares", "board", "embark", "disembark", "ashore", "land", "sail", "helm",
  "ships", "vessels", "rent", "buyship", "purchase", "build", "lay", "craft", "make", "recipes",
  "fish", "forage", "chop", "mine", "gather", "harvest", "scan", "lookout", "survey", "ecology",
  "propose", "support", "second", "laws", "commons", "industrialize", "rig", "trawl", "profess",
]);


/** Garble speech in a tongue the listener does not know — deterministic gibberish, length-preserving. */
const garble = (text: string): string => text.replace(/[a-zA-Z]/g, (c) => "khrtlsnmvdz"[(c.charCodeAt(0) * 7) % 11]!);

const slug = (text: string): string => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";

/** Opposite directions, for digging a room with a way back. */
const REVERSE: Readonly<Record<string, string>> = Object.freeze({
  north: "south", south: "north", east: "west", west: "east", up: "down", down: "up",
  northeast: "southwest", southwest: "northeast", northwest: "southeast", southeast: "northwest",
  in: "out", out: "in", aft: "forward", forward: "aft",
});

/** A thing formed at runtime, carrying what's needed to reconstruct its content on restore. */
type SpawnRecord =
  | { readonly kind: "ship"; readonly id: string; readonly klass: string }
  | { readonly kind: "craft"; readonly id: string; readonly recipe: string; readonly quality: number }
  | { readonly kind: "harvest"; readonly id: string; readonly resource: string }
  | { readonly kind: "market"; readonly id: string; readonly type: string }
  | { readonly kind: "cured"; readonly id: string };

/** A creator edit to the world's content — replayed on restore so authored places persist. */
type AuthorOp =
  | { readonly kind: "room"; readonly id: string; readonly name: string; readonly description: string; readonly exits: Readonly<Record<string, string>> }
  | { readonly kind: "thing"; readonly id: string; readonly name: string; readonly description: string; readonly location: string }
  | { readonly kind: "exit"; readonly room: string; readonly dir: string; readonly dest: string }
  | { readonly kind: "describe"; readonly id: string; readonly description: string }
  | { readonly kind: "rename"; readonly id: string; readonly name: string }
  | { readonly kind: "tag"; readonly id: string; readonly tag: string };

/**
 * A portable **entity packet**: an actor's own fiber plus the fibers of everything it
 * carries. The unit of migration between shards — the player sent as a message.
 */
export interface ActorPacket {
  readonly actor: string;
  readonly facts: readonly Fact[];
  readonly carried: readonly { readonly id: string; readonly facts: readonly Fact[] }[];
}

/** A queued player command: an actor and the raw line they typed. */
export interface CommandIntent {
  readonly k: "command";
  readonly actor: string;
  readonly line: string;
}

/** A server→client event a tick produces: a line of text addressed to an actor. */
export interface SceneEvent {
  readonly k: "message";
  readonly to: string;
  readonly text: string;
}

/** One subject's renderable projection of the settled scene — a qwzspace snapshot entry. */
export type SceneEntry = Record<string, unknown> & { readonly id: string };

/**
 * A persisted scene: the settled world as its facts plus the joined players. The world
 * is an append-only assertion trace, so event-sourcing is structural — a snapshot is
 * just the settled facts, and restoring re-tells them into a fresh world.
 */
export interface SceneSnapshot {
  readonly kind: "fizzos.scene.snapshot";
  readonly facts: readonly { readonly e: string; readonly a: string; readonly v: string }[];
  readonly players: readonly string[];
  /** Everything formed at runtime (ships, crafts, harvests, market buys), replayed on restore. */
  readonly spawned?: readonly SpawnRecord[];
  /** Creator edits to content, replayed on restore so authored places persist. */
  readonly authored?: readonly AuthorOp[];
}

export interface RunTickResult {
  readonly dirty: readonly string[];
  readonly events: readonly SceneEvent[];
}

/** The shared state a tick agent reads and advances: the tick number, the dirty set, the outgoing events. */
interface TickContext {
  readonly tick: number;
  readonly dirty: Set<string>;
  readonly events: SceneEvent[];
}

/** Canonical compass directions, with the short aliases players actually type. */
const DIRECTIONS: Readonly<Record<string, string>> = {
  n: "north", s: "south", e: "east", w: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
  north: "north", south: "south", east: "east", west: "west",
  northeast: "northeast", northwest: "northwest", southeast: "southeast", southwest: "southwest",
  u: "up", d: "down", up: "up", down: "down",
};

/** Accept a raw client intent into a typed command, or reject it. */
export function validateCommand(raw: unknown): CommandIntent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as { k?: unknown; actor?: unknown; line?: unknown };
  if (record.k !== undefined && record.k !== "command") return null;
  if (typeof record.actor !== "string" || typeof record.line !== "string") return null;
  return { k: "command", actor: record.actor, line: record.line };
}

export class FizzosScene {
  private world: World;
  private readonly content: Content;
  private readonly players = new Set<string>();
  private readonly startRoom: string;
  /**
   * Everything formed at runtime — ships built, items crafted, materials harvested, wares
   * bought — as ONE spawn log. Each record carries the recipe to reconstruct its *content*
   * (its world facts come from the snapshot), so restore replays one list, not four. This
   * is the "components formed from each other" pattern: a uniform way to bring a new
   * component into being.
   */
  private readonly spawned: SpawnRecord[] = [];
  /** Creator edits to the world's content, replayed on restore so authored places persist. */
  private readonly authored: AuthorOp[] = [];
  /** Live instanced regions: their cloned room/thing ids, reaped when no player remains. */
  private readonly instances = new Map<string, { roomIds: string[]; thingIds: string[] }>();
  private instanceCounter = 0;

  /** The game that parameterizes this engine — its closure rules, fields, affordances. */
  private readonly game: GameDefinition;
  /** The resolved genre-toolkit catalogs: the game's, falling back to the engine's defaults. */
  private readonly cat: Required<GameCatalogs>;

  constructor(world: World, content: Content, startRoom: string, game: GameDefinition = FARSTONE_GAME) {
    this.world = world;
    this.content = content;
    this.startRoom = startRoom;
    this.game = game;
    if (game.functional !== undefined) registerFunctional(game.functional);
    const c = game.catalogs ?? {};
    this.cat = {
      wares: c.wares ?? WARES,
      recipes: c.recipes ?? RECIPES,
      resources: c.resources ?? RESOURCES,
      gatherVerbs: c.gatherVerbs ?? GATHER_VERBS,
      shipClasses: c.shipClasses ?? SHIP_CLASSES,
      professions: c.professions ?? PROFESSIONS,
      souls: c.souls ?? SOULS,
      factions: c.factions ?? FACTIONS,
      laws: c.laws ?? LAWS,
    };
    // Agential realism: every NPC is a fiber, so every NPC has interiority. Deal each one its
    // cabinet at load — they perceive the world through faculties too, and those faculties keen
    // with use just like a player's. The world is full of minds, not one mind among props.
    const seed = worldSeed(this.world);
    for (const [id, thing] of Object.entries(this.content.things)) {
      if (thing.kind === "npc" && valueOf(this.world, id, "faculty:shivers") === null) {
        this.world = tell(this.world, cabinetSeed(seed, id));
      }
    }
  }

  /** Admit a player at a start room, returning the room they wake in. */
  join(actor: string, start: string): string {
    this.players.add(actor);
    this.world = engineGo(this.world, actor, start);
    if (valueOf(this.world, actor, "health") === null) {
      this.world = tell(this.world, [
        { e: actor, a: "health", v: String(PLAYER_HEALTH) },
        { e: actor, a: "max-health", v: String(PLAYER_HEALTH) },
        { e: actor, a: "attack", v: String(PLAYER_ATTACK) },
        { e: actor, a: "coin", v: String(PLAYER_COIN) },
        { e: actor, a: "condition", v: "alive" },
      ]);
      // Deal the character their cabinet — the inner faculties they perceive Farstone through.
      this.world = tell(this.world, cabinetSeed(worldSeed(this.world), actor));
    }
    return start;
  }

  /** The live world (read-only use; the scene is the sole writer). */
  current(): World {
    return this.world;
  }

  /** Snapshot the live world, joined players, and built ships for persistence (event-sourcing). */
  snapshot(): SceneSnapshot {
    return {
      kind: "fizzos.scene.snapshot",
      facts: settledFacts(this.world).map((f) => ({ e: f.e, a: f.a, v: f.v })),
      players: [...this.players],
      spawned: [...this.spawned],
      authored: [...this.authored],
    };
  }

  /** Restore a persisted scene: replay spawned + authored content, re-tell facts, re-admit players. */
  restore(snapshot: SceneSnapshot): void {
    for (const record of snapshot.spawned ?? []) {
      this.realizeSpawn(record);
      this.spawned.push(record);
    }
    for (const op of snapshot.authored ?? []) {
      this.realizeAuthorContent(op);
      this.authored.push(op);
    }
    this.world = world(snapshot.facts);
    for (const player of snapshot.players) this.players.add(player);
  }

  // ── the qwzspace surface ─────────────────────────────────────────────────

  /** Drain a tick of commands into the one settling. The scene is the sole writer. */
  /**
   * One turn of the world. First every queued command is *actuated* — a player or NPC
   * acting on the settled world through `apply`. Then the world *agents itself*: a fixed
   * pipeline of agents (the clock, NPCs, ecology, market, autopilots, automations) each
   * advance the one shared world. This is the node ecosystem's shape — actuators carry
   * intent in, agents carry the world forward — made the engine's heart.
   */
  /** Live operational metrics for health/observability. */
  metrics(): { players: number; rooms: number; things: number; tick: number } {
    return { players: this.players.size, rooms: Object.keys(this.content.rooms).length, things: Object.keys(this.content.things).length, tick: this.lastTick };
  }

  private lastTick = 0;

  private loaded = false;

  runTick(tick: number, intents: readonly CommandIntent[]): RunTickResult {
    this.lastTick = tick;
    const ctx: TickContext = { tick, dirty: new Set<string>(), events: [] };
    // The game's load hook fires once, before the world ever advances (`love.load`).
    if (!this.loaded) { this.game.onLoad?.(this.gameContext(ctx.events)); this.loaded = true; }
    for (const intent of intents) {
      const text = this.apply(intent.actor, intent.line, ctx.dirty, ctx.events);
      if (text !== null) ctx.events.push({ k: "message", to: intent.actor, text });
    }
    for (const agent of this.agents) agent(ctx);
    // The game's own systems and update hook run after the engine's agents (`love.update`).
    const gctx = this.gameContext(ctx.events);
    for (const system of this.game.systems ?? []) system(gctx);
    this.game.onTick?.(gctx);
    return Object.freeze({ dirty: Object.freeze([...ctx.dirty]), events: Object.freeze(ctx.events) });
  }

  /** The SDK context handed to a game's hooks, systems, and commands — the engine's API facade. */
  private gameContext(events: SceneEvent[]): GameContext {
    return {
      tick: this.lastTick,
      catalogs: this.cat,
      tell: (facts) => { this.world = tell(this.world, [...facts]); },
      apply: (transform) => { this.world = transform(this.world); },
      value: (e, p) => valueOf(this.world, e, p),
      number: (e, p, d = 0) => numberOf(this.world, e, p, d),
      place: (e, room) => { this.world = engineGo(this.world, e, room); },
      roomOf: (e) => placeOf(this.world, e),
      contentsOf: (room) => contentsOf(this.world, room),
      nameOf: (id) => this.name(id),
      tagsOf: (id) => this.tagsOf(id),
      message: (actor, text) => { events.push({ k: "message", to: actor, text }); },
      broadcast: (room, text) => { for (const o of contentsOf(this.world, room)) if (this.players.has(o)) events.push({ k: "message", to: o, text }); },
      rooms: () => Object.keys(this.content.rooms),
      things: () => Object.keys(this.content.things),
      players: () => [...this.players],
    };
  }

  /**
   * The agent pipeline: each agent is an autonomous process that advances the one world
   * each tick, in order. Adding a system means adding an agent here — no edits to the
   * turn loop. (The order matters: the clock and NPC movement run before perception-shaping
   * agents.)
   */
  private readonly agents: readonly ((ctx: TickContext) => void)[] = [
    ({ dirty, events }) => this.clockAndRoutines(dirty, events),
    ({ dirty, events }) => this.npcTurn(dirty, events),
    ({ dirty, events }) => this.followTick(dirty, events),
    ({ tick, dirty, events }) => this.npcLife(tick, dirty, events),
    ({ dirty, events }) => this.npcAgency(dirty, events),
    ({ events }) => this.thoughtTick(events),
    ({ events }) => this.campaignTick(events),
    ({ tick }) => this.regrowNodes(tick),
    ({ dirty, events }) => this.industryTick(dirty, events),
    ({ tick }) => this.ecologyTick(tick),
    ({ tick }) => this.marketTick(tick),
    ({ dirty, events }) => this.autopilotTurn(dirty, events),
    ({ events }) => this.automationTick(events),
    () => this.diffuseFields(),
    () => this.closureTick(),
    () => this.reapInstances(),
  ];

  /**
   * The closure agent: fire the world's standing rules-as-data to a fixpoint (Knaster-
   * Tarski). Emergent consequence — a polluted cell blighting, a recovered one healing —
   * comes from rules over fibers, not a bespoke pass. New world-logic is a rule, not code.
   */
  private closureTick(): void {
    const rules = this.game.worldRules ?? [];
    if (rules.length === 0) return;
    const ids = [...Object.keys(this.content.rooms), ...Object.keys(this.content.things)];
    const { world: next } = closeWorld(this.world, ids, rules, (w, id) => this.fiberOf(id, w));
    this.world = next;
  }

  /**
   * The interior tick: every living NPC's needs drift, its mood updates, it idly shows
   * that mood (the world feels inhabited), and now and then it *dreams* — consolidating
   * a belief about who it has seen. Cadences are staggered by id so the room doesn't
   * pulse in unison.
   */
  private npcLife(tick: number, dirty: Set<string>, events: SceneEvent[]): void {
    for (const [id, thing] of Object.entries(this.content.things)) {
      if (thing.kind !== "npc" || valueOf(this.world, id, "condition") === "dead") continue;
      const stagger = id.length;
      if (tick % 4 === stagger % 4) this.world = driftNeeds(this.world, id);
      const mood = moodOf(this.world, id);
      if (valueOf(this.world, id, "mood") !== mood) {
        this.world = tell(this.world, [{ e: id, a: "mood", v: mood }]);
        dirty.add(id);
      }
      if (tick % 7 === stagger % 7) {
        const emote = moodEmote(mood);
        const def = emote === null ? undefined : this.cat.souls[emote];
        if (def !== undefined) for (const occ of this.audience(id)) events.push({ k: "message", to: occ, text: fillSoul(def.room, capitalize(this.name(id))) });
      }
      if (tick % 11 === stagger % 11) {
        const room = placeOf(this.world, id);
        if (room !== null) for (const seen of contentsOf(this.world, room)) if (this.players.has(seen)) this.world = believe(this.world, id, `seen:${seen}`, "potential");
      }
    }
  }

  /**
   * Each tick, every ship carrying standing orders *runs its program* against the world
   * (the Bussard move: the vessel is autonomous code). A faulty program is simply inert
   * for the tick — a bad autopilot strands you, it never crashes the world.
   */
  private autopilotTurn(dirty: Set<string>, events: SceneEvent[]): void {
    for (const ship of Object.keys(this.content.ships)) {
      const program = valueOf(this.world, ship, "autopilot");
      if (program === null || program === "nothing" || program === "") continue;
      try {
        const before = placeOf(this.world, ship);
        const { world, log } = runProgram(program, this.world, ship, this.content);
        this.world = world;
        const after = placeOf(this.world, ship);
        if (after !== before) {
          dirty.add(ship);
          if (before !== null) dirty.add(before);
          if (after !== null) dirty.add(after);
          for (const occ of this.aboard(ship)) events.push({ k: "message", to: occ, text: `${capitalize(this.name(ship))} answers her orders and stands on to ${this.name(after ?? "the deep")}.` });
        }
        for (const line of log) for (const occ of this.aboard(ship)) events.push({ k: "message", to: occ, text: `[${this.name(ship)}] ${line}` });
      } catch { /* a faulty program is inert this tick */ }
    }
  }

  /** Each tick, every living hostile NPC strikes a living player sharing its room — the
   *  floor of NPC agency, until behaviour is authored as a `@emsenn/gaming` design. */
  private npcTurn(dirty: Set<string>, events: SceneEvent[]): void {
    for (const [id, thing] of Object.entries(this.content.things)) {
      if (thing.kind !== "npc") continue;
      if (valueOf(this.world, id, "condition") === "dead") continue;
      const room = placeOf(this.world, id);
      if (room === null) continue;
      const factions = factionsOfTags(thing.tags);
      // A plain hostile strikes anyone; a faction member strikes a player its faction *hates*.
      const victim = contentsOf(this.world, room).find(
        (other) => this.players.has(other) && valueOf(this.world, other, "condition") !== "dead"
          && (isHostile(thing.tags) || factions.some((f) => dispositionOf(standingOf(this.world, other, f)) === "hostile")),
      );
      if (victim !== undefined) this.strike(id, victim, dirty, events);
    }
  }

  /**
   * NPC agency: each living NPC acts on its own interiority (`npc-agency`). A hungry one eats what
   * is to hand (competing with players and each other for the scarce catch); under scarcity, tempers
   * shorten and a feud with a co-located rival flares. The world dramatizes itself — no script.
   */
  private npcAgency(dirty: Set<string>, events: SceneEvent[]): void {
    for (const [id, thing] of Object.entries(this.content.things)) {
      if (thing.kind !== "npc" || valueOf(this.world, id, "condition") === "dead") continue;
      const room = placeOf(this.world, id);
      if (room === null) continue;
      const here = contentsOf(this.world, room);
      const rivalTag = thing.tags.find((t) => t.startsWith("rival:"));
      const rivalId = rivalTag === undefined ? null : rivalTag.slice("rival:".length);
      const rivalHere = rivalId !== null && here.includes(rivalId) && valueOf(this.world, rivalId, "condition") !== "dead" ? rivalId : null;
      const edibleHere = here.find((o) => o !== id && !this.players.has(o) && this.tagsOf(o).includes("edible")) ?? null;
      const hunger = numberOf(this.world, id, "need:hunger", 0);
      const rest = numberOf(this.world, id, "need:rest", 0);
      const action = chooseNpcAction({
        hunger,
        rest,
        company: numberOf(this.world, id, "need:company", 0),
        edibleHere,
        foodDirection: edibleHere === null && hunger >= 8 ? this.directionToFood(room) : null,
        restHere: this.isRestRoom(room),
        restDirection: !this.isRestRoom(room) && rest >= 10 ? this.directionTo(room, (r) => this.isRestRoom(r)) : null,
        workHere: this.workableHere(id, room),
        rivalHere,
        embittered: valueOf(this.world, id, "embittered") === "true",
      });
      if (action.kind === "eat") {
        this.world = relieve(this.world, id, "hunger");
        this.world = tell(this.world, [{ e: action.item, a: "located-in", v: "nothing" }]);
        dirty.add(id);
        for (const occ of here) if (this.players.has(occ)) events.push({ k: "message", to: occ, text: `${capitalize(this.name(id))} snatches up ${this.name(action.item)} and eats it, half-starved.` });
      } else if (action.kind === "rest") {
        this.world = relieve(this.world, id, "rest");
        dirty.add(id);
      } else if (action.kind === "work") {
        // Idle hands turn to the trade: the NPC works the node, earning its keep and honing the skill.
        const node = this.cat.resources[action.resource];
        if (node !== undefined) {
          const remaining = numberOf(this.world, room, `yield:${action.resource}`, node.max);
          if (remaining > 0) this.world = tell(this.world, [{ e: room, a: `yield:${action.resource}`, v: String(remaining - 1) }]);
          this.world = tell(this.world, [{ e: id, a: "coin", v: String(numberOf(this.world, id, "coin", 0) + 2) }]);
          this.world = practise(this.world, id, node.skill);
          dirty.add(id);
        }
      } else if (action.kind === "move") {
        const dest = this.content.rooms[room]?.exits?.[action.dir];
        if (dest !== undefined) {
          this.world = engineGo(this.world, id, dest);
          dirty.add(id); dirty.add(room); dirty.add(dest);
          for (const occ of here) if (this.players.has(occ) && occ !== id) events.push({ k: "message", to: occ, text: `${capitalize(this.name(id))} heads off ${action.dir}, hunting for food.` });
          for (const occ of contentsOf(this.world, dest)) if (this.players.has(occ) && occ !== id) events.push({ k: "message", to: occ, text: `${capitalize(this.name(id))} arrives, lean and searching.` });
        }
      } else if (action.kind === "attack") {
        for (const occ of here) if (this.players.has(occ)) events.push({ k: "message", to: occ, text: `Lean and short-tempered, ${this.name(id)} rounds on ${this.name(action.target)} — old grievances and an empty belly.` });
        this.strike(id, action.target, dirty, events);
      }
    }
  }

  /** Whether a room is a place food can be found — edible lying about, fishing water, or a market. */
  private isFoodRoom(room: string): boolean {
    return contentsOf(this.world, room).some((o) => !this.players.has(o) && this.tagsOf(o).includes("edible"))
      || this.tagsOf(room).some((t) => t === "fishing" || t === "market");
  }

  /** Whether a room is a place to rest — an inn, a shelter, a built home, the chapel's quiet. */
  private isRestRoom(room: string): boolean {
    return this.tagsOf(room).some((t) => t === "inn" || t === "shelter" || t === "social-hub" || t === "chapel" || t === "built");
  }

  /** A resource the NPC can work where it stands — a node here it has the trade for, or null. */
  private workableHere(npc: string, room: string): string | null {
    for (const tag of this.tagsOf(room)) {
      if (!tag.startsWith("node:")) continue;
      const resource = tag.slice("node:".length);
      const node = this.cat.resources[resource];
      if (node !== undefined && skillOf(this.world, npc, node.skill) > 0) return resource;
    }
    return null;
  }

  /** The first-step exit direction toward the nearest room satisfying a predicate (BFS, bounded). */
  private directionTo(from: string, isTarget: (room: string) => boolean): string | null {
    const seen = new Set<string>([from]);
    let frontier: { room: string; first: string | null }[] = [{ room: from, first: null }];
    for (let depth = 0; depth < 6 && frontier.length > 0; depth++) {
      const next: { room: string; first: string | null }[] = [];
      for (const { room, first } of frontier) {
        for (const [dir, dest] of Object.entries(this.content.rooms[room]?.exits ?? {})) {
          if (seen.has(dest)) continue;
          seen.add(dest);
          const firstDir = first ?? dir;
          if (isTarget(dest)) return firstDir;
          next.push({ room: dest, first: firstDir });
        }
      }
      frontier = next;
    }
    return null;
  }

  /** The first-step exit direction toward the nearest food room. */
  private directionToFood(from: string): string | null {
    return this.directionTo(from, (room) => this.isFoodRoom(room));
  }

  /** Every subject in the world — rooms, things, actors. */
  subjectsOf(): readonly string[] {
    const ids = new Set<string>(this.players);
    for (const id of Object.keys(this.content.rooms)) ids.add(id);
    for (const id of Object.keys(this.content.things)) ids.add(id);
    return [...ids];
  }

  /** Project one subject to its renderable snapshot entry. */
  snapOf(id: string): SceneEntry | null {
    const room = this.content.rooms[id];
    if (room !== undefined) {
      return {
        id,
        kind: "room",
        name: room.name,
        description: room.description,
        exits: room.exits,
        contents: contentsOf(this.world, id).filter((x) => x !== id),
        charge: "t",
      };
    }
    const place = placeOf(this.world, id);
    const condition = valueOf(this.world, id, "condition");
    const vitals = condition === null ? {} : { health: numberOf(this.world, id, "health", 0), condition };
    const thing = this.content.things[id];
    if (thing !== undefined) {
      return { id, kind: thing.kind, name: thing.name, description: thing.description, locatedIn: place, ...vitals, charge: "t" };
    }
    if (this.players.has(id)) {
      return { id, kind: "actor", name: id, locatedIn: place, inventory: contentsOf(this.world, id), ...vitals, charge: "t" };
    }
    return null;
  }

  /** Per-subscriber perception: a player sees only subjects in its own fiber. */
  interest(id: string, subscriberId: unknown): boolean {
    if (typeof subscriberId !== "string") return true;
    return this.fiber(subscriberId).has(id);
  }

  // ── verb dispatch ────────────────────────────────────────────────────────

  /** The subject ids in an actor's perception fiber (itself, its place, what's co-located). */
  private fiber(actor: string): Set<string> {
    const here = new Set<string>([actor]);
    const place = placeOf(this.world, actor);
    if (place !== null) {
      here.add(place);
      for (const thing of contentsOf(this.world, place)) here.add(thing);
    }
    for (const fact of perceive(this.world, actor).facts) here.add(fact.e);
    return here;
  }

  private here(actor: string): string | null {
    return placeOf(this.world, actor);
  }

  private around(actor: string): { room: string | null; npcs: string[]; items: string[] } {
    const room = this.here(actor);
    const npcs: string[] = [];
    const items: string[] = [];
    if (room !== null) {
      for (const id of contentsOf(this.world, room)) {
        if (id === actor || this.isHidden(id)) continue;
        (this.content.things[id]?.kind === "npc" ? npcs : items).push(id);
      }
    }
    return { room, npcs, items };
  }

  private name(id: string): string {
    return this.content.nameOf(id);
  }

  /** Resolve a thing by id or name among candidate ids — exact id, exact name, substring. */
  private resolve(query: string, candidates: readonly string[]): string | null {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const byId = candidates.find((id) => id.toLowerCase() === q);
    if (byId) return byId;
    const named = candidates.map((id) => [id, this.name(id).toLowerCase()] as const);
    const exact = named.find(([, n]) => n === q || n === `a ${q}` || n === `the ${q}`);
    if (exact) return exact[0];
    const sub = named.find(([, n]) => n.includes(q));
    if (sub) return sub[0];
    const words = q.split(/[\s-]+/);
    return candidates.find((id) => {
      const hay = `${id} ${this.name(id)}`.toLowerCase().replace(/-/g, " ");
      return words.every((w) => hay.includes(w));
    }) ?? null;
  }

  private describe(actor: string): string {
    // Perception is fiber-filtering: when inhabiting another fiber, you see through ITS eyes.
    const viewer = bodyOf(this.world, actor);
    const roomId = this.here(viewer);
    if (roomId === null) return viewer === actor ? "You are nowhere." : `${capitalize(this.name(viewer))} is nowhere you can perceive from.`;
    const room = this.content.rooms[roomId];
    if (room === undefined) return `You are nowhere (${roomId}).`;
    const { npcs, items } = this.around(viewer);
    const lines = viewer === actor ? [room.name, "", room.description] : [`[Through the fiber of ${this.name(viewer)}]`, "", room.name, "", room.description];
    const dirs = Object.keys(room.exits);
    if (dirs.length) lines.push("", `Exits: ${dirs.join(", ")}.`);
    for (const id of items) { if (id !== viewer) lines.push(`  ${this.name(id)} is here.`); }
    for (const id of npcs) { if (id !== viewer) lines.push(`  ${this.name(id)} stands here.`); }
    // The Cabinet: the actor's own faculties whisper what their senses surface from the scene —
    // its own perceived section, deepened by who they are (DESIGN §4.3). Only the actor's own mind.
    if (viewer === actor && this.players.has(actor)) {
      const iv = this.interiorityView(actor, roomId, npcs);
      // Witnessing the world hold a contradiction (⊤) is an experience the Thought Cabinet draws on.
      if (iv.contested.length > 0 && valueOf(this.world, actor, "seen-contradiction") !== "true") this.world = tell(this.world, [{ e: actor, a: "seen-contradiction", v: "true" }]);
      const whispers = interiorityLines(this.world, actor, iv, worldSeed(this.world), worldTime(this.world));
      if (whispers.length) {
        lines.push("", ...whispers.map(renderWhisper));
        // A faculty that just read the world keens a little — interiority grows by use.
        for (const key of new Set(whispers.map((w) => w.faculty))) this.world = practiseFaculty(this.world, actor, key);
      }
    }
    return lines.join("\n");
  }

  /** Assemble the pure snapshot the actor's faculties read — a lens over the live world. */
  private interiorityView(actor: string, roomId: string, npcs: readonly string[]): InteriorityView {
    const npcViews: NpcView[] = npcs
      .filter((id) => id !== actor && valueOf(this.world, id, "condition") !== "dead")
      .map((id) => {
        const tags = this.tagsOf(id);
        const stanceTag = tags.find((t) => t.startsWith("stance:"));
        return {
          name: this.name(id),
          mood: valueOf(this.world, id, "mood") ?? (this.content.things[id]?.kind === "npc" ? moodOf(this.world, id) : null),
          stance: valueOf(this.world, id, "stance") ?? (stanceTag !== undefined ? stanceTag.slice("stance:".length) : null),
          armed: valueOf(this.world, id, "wielding") !== null || tags.some((t) => t.startsWith("wielding:") || t === "weapon"),
        } satisfies NpcView;
      });
    const contested: string[] = [];
    if (this.tagsOf(roomId).includes("ocean") && valueOf(this.world, roomId, "ecology") === "stable") contested.push("the catch runs strong here and the water is fouled, both at once");
    if (valueOf(this.world, roomId, "torn") === "true") contested.push("this water teems with life and reads as blighted in the same breath");
    return {
      weather: weatherOf(this.world),
      season: seasonOf(this.world),
      tide: tideOf(this.world),
      npcs: npcViews,
      hasHidden: contentsOf(this.world, roomId).some((id) => this.isHidden(id)),
      contested,
      self: {
        hunger: numberOf(this.world, actor, "need:hunger", 0),
        rest: numberOf(this.world, actor, "need:rest", 0),
        health: valueOf(this.world, actor, "health") === null ? null : numberOf(this.world, actor, "health", 0),
        maxHealth: valueOf(this.world, actor, "max-health") === null ? null : numberOf(this.world, actor, "max-health", 0),
      },
    };
  }

  /** The other players co-located with an actor — the ones who overhear local speech. */
  private audience(actor: string): string[] {
    const room = this.here(actor);
    if (room === null) return [];
    return contentsOf(this.world, room).filter((id) => id !== actor && this.players.has(id));
  }

  // ── predication world-sim: fibers, affordances, inhabiting, the fold ──────────

  /** Read any id as a predication Fiber — its kind, tags, and cells over a given world. */
  private fiberOf(id: string, w: World = this.world): Fiber {
    const kind = this.content.things[id]?.kind
      ?? (this.content.rooms[id] !== undefined ? "room"
        : this.content.ships[id] !== undefined ? "vessel"
        : this.players.has(id) ? "player" : "thing");
    return {
      id,
      kind,
      tags: this.tagsOf(id),
      has: (p) => { const v = valueOf(w, id, p); return v !== null && v !== ""; },
      value: (p) => valueOf(w, id, p),
      number: (p, d = 0) => numberOf(w, id, p, d),
    };
  }

  /** Resolve an interaction target near an actor — co-located things, NPCs, or the room. */
  private resolveTarget(actor: string, query: string): string | null {
    const { room, npcs, items } = this.around(actor);
    const here = room === null ? [] : [room];
    return this.resolve(query, [...items, ...npcs, ...here, ...contentsOf(this.world, actor)]);
  }

  /** `afford <thing>` — the COMPUTED action menu: which messages compose with its fiber. */
  private affordList(actor: string, query: string): string {
    const self = bodyOf(this.world, actor);
    const target = query.trim() ? this.resolveTarget(self, query) : self;
    if (target === null) return `There is no "${query}" here to weigh.`;
    const menu = affordances(this.fiberOf(self), this.fiberOf(target), this.game.affordances ?? AFFORDANCES);
    if (menu.length === 0) return `${capitalize(this.name(target))} affords you nothing — its fiber does not compose with yours.`;
    const mark = (c: string): string => (c === "active" ? " (blocked)" : c === "stable" ? " (contested)" : "");
    const lines = menu.map((a) => `  ${a.channel} — ${a.gloss}${mark(a.charge)}`);
    return [`With ${this.name(target)} you could:`, ...lines].join("\n");
  }

  /** `enter <template>` — open a private instance of a template region and step inside. */
  private enterInstance(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    const name = query.trim().toLowerCase();
    if (!name) return "Enter what? Name a place that can be instanced.";
    const plan = planInstance(this.content, name, String(++this.instanceCounter));
    if (plan === null) return `There is no instanced region called "${name}".`;
    const rooms = this.content.rooms as Record<string, RoomContent>;
    const things = this.content.things as Record<string, ThingContent>;
    for (const r of plan.rooms) rooms[r.id] = r;
    for (const t of plan.things) things[t.id] = t;
    this.world = tell(this.world, plan.facts.map((f) => ({ e: f.e, a: f.a, v: f.v })));
    // The way back out: an `out` exit from the entry to where the party stood.
    const ret = this.here(actor);
    if (ret !== null) {
      (rooms[plan.entry]!.exits as Record<string, string>)["out"] = ret;
      this.world = tell(this.world, [{ e: plan.entry, a: "exit", v: ret }]);
    }
    this.instances.set(plan.id, { roomIds: plan.rooms.map((r) => r.id), thingIds: plan.things.map((t) => t.id) });
    this.world = engineGo(this.world, actor, plan.entry);
    touch(actor, plan.entry, ret);
    return `You cross into a private ${name}. (Take the 'out' exit to leave; it closes once empty.)`;
  }

  /**
   * Export an actor as a portable **entity packet** — its own fiber plus the fibers of
   * everything it carries — so it can cross a shard boundary. This is the design's "a player
   * walks from one server to another by their entity being sent as a message": the packet IS
   * the message. Pure; does not change this shard.
   */
  exportActor(actor: string): ActorPacket {
    const carried = contentsOf(this.world, actor);
    const cells = (id: string): Fact[] => factsOf(this.world, id).map((f) => ({ e: f.e, a: f.a, v: f.v }));
    return Object.freeze({
      actor,
      facts: cells(actor),
      carried: carried.map((id) => Object.freeze({ id, facts: cells(id) })),
    });
  }

  /** Receive an entity packet from another shard: re-tell its fibers and place it here. */
  importActor(packet: ActorPacket, room: string): void {
    const incoming: Fact[] = [...packet.facts, ...packet.carried.flatMap((c) => c.facts)];
    this.world = tell(this.world, incoming);
    this.world = engineGo(this.world, packet.actor, room); // override the packet's stale place
    this.players.add(packet.actor);
  }

  /** Drop a player from this shard (it has migrated): forget it and vacate its footprint. */
  dropPlayer(actor: string): void {
    const carried = contentsOf(this.world, actor);
    this.world = tell(this.world, [actor, ...carried].map((id) => ({ e: id, a: "located-in", v: "elsewhere" })));
    this.players.delete(actor);
  }

  /** The room a player currently stands in — the federation routes by this. */
  roomOf(actor: string): string | null {
    return placeOf(this.world, actor);
  }

  /** This shard's current settled world (immutable) — read by the federation's H¹. */
  currentWorld(): World {
    return this.world;
  }

  /** Reap instances no player stands in any longer — tear down their rooms and contents. */
  private reapInstances(): void {
    const rooms = this.content.rooms as Record<string, RoomContent>;
    const things = this.content.things as Record<string, ThingContent>;
    for (const [id, inst] of this.instances) {
      const occupied = inst.roomIds.some((r) => contentsOf(this.world, r).some((o) => this.players.has(o)));
      if (occupied) continue;
      for (const t of inst.thingIds) { this.world = tell(this.world, [{ e: t, a: "located-in", v: "nowhere" }]); delete things[t]; }
      for (const r of inst.roomIds) delete rooms[r];
      this.instances.delete(id);
    }
  }

  /** `inhabit <entity>` — assume control of any fiber and perceive through its predicates. */
  private inhabitCmd(actor: string, query: string): string {
    if (!query.trim()) return "Inhabit what? Name any thing, creature, or place.";
    // Play as ANYTHING: resolve against the whole world, not just what is co-located.
    const all = [...Object.keys(this.content.things), ...Object.keys(this.content.rooms), ...Object.keys(this.content.ships)];
    const target = this.resolveTarget(actor, query) ?? this.resolve(query, all);
    if (target === null) return `There is no "${query}" to inhabit.`;
    this.world = inhabit(this.world, actor, target);
    return `Your awareness pours into ${this.name(target)}. You perceive through its fiber now. (\`release\` to return.)`;
  }

  private releaseCmd(actor: string): string {
    if (bodyOf(this.world, actor) === actor) return "You already wear your own fiber.";
    const was = this.name(bodyOf(this.world, actor));
    this.world = release(this.world, actor);
    return `You withdraw from ${was}, back into yourself.`;
  }

  /** `history` — read the entanglements off your fiber: the geometric record of your past. */
  private historyCmd(actor: string): string {
    const self = bodyOf(this.world, actor);
    const tangles = entanglementsOf(this.world, self);
    if (tangles.length === 0) return "Your fiber is smooth — nothing has yet left its mark on you.";
    const counts = new Map<string, number>();
    for (const t of tangles) counts.set(`${t.kind} ${this.name(t.other)}`, (counts.get(`${t.kind} ${this.name(t.other)}`) ?? 0) + 1);
    const lines = [...counts].map(([k, n]) => `  ${k}${n > 1 ? ` (×${n})` : ""}`);
    return ["You carry, entangled in your fiber:", ...lines].join("\n");
  }

  /** `eulogize <slain>` — the tower/fold: mourn a settled thing into a word others can carry. */
  private eulogize(actor: string, query: string, events: SceneEvent[]): string {
    const target = this.resolveTarget(actor, query);
    if (target === null) return `There is no "${query}" here to mourn.`;
    if (!isSettledDead(this.fiberOf(target))) return `${capitalize(this.name(target))} still lives — there is nothing yet to fold.`;
    const witnesses = [actor, ...this.audience(actor), ...this.around(actor).npcs.filter((id) => valueOf(this.world, id, "condition") !== "dead")];
    const { world: next, word } = fold(this.world, target, this.name(target), witnesses);
    this.world = next;
    if (word === null) return `${capitalize(this.name(target))} settles alone, unwitnessed. No word is born.`;
    this.broadcastRoom(actor, `${capitalize(this.name(target))} passes into legend. A word is born: '${word}'.`, events);
    return `You mourn ${this.name(target)} into vocabulary. You and the other witnesses now carry the word '${word}' — \`invoke\` it.`;
  }

  /** `invoke <word>` — compose a folded word you carry; the word is a real predicate now. */
  private invokeWord(actor: string, query: string): string {
    const self = bodyOf(this.world, actor);
    const word = query.trim() || wordFor("");
    if (!carriesWordId(this.world, self, word)) return `You do not carry the word '${word}'.`;
    const origin = valueOf(this.world, word, "from-entity");
    this.world = practise(this.world, self, "magic");
    return `You speak '${word}'. The fold answers — ${origin === null ? "an echo of what settled" : `the memory of ${this.name(origin)}`} moves through you.`;
  }

  /** `vocabulary` — the words the world has folded so far (the tower's standing word-stock). */
  private vocabularyCmd(actor: string): string {
    const words = vocabularyOf(this.world);
    if (words.length === 0) return "The world has folded no words yet. Mourn the fallen to make language.";
    const carried = new Set((valueOf(this.world, bodyOf(this.world, actor), "carries-word") ?? "").split(",").filter(Boolean));
    return ["The world's vocabulary:", ...words.map((w) => `  ${w}${carried.has(w) ? " (yours)" : ""}`)].join("\n");
  }

  /** `unfold <word>` — resurrection: re-expand a word you carry into a new entity here. */
  private unfoldCmd(actor: string, query: string): string {
    const self = bodyOf(this.world, actor);
    const word = query.trim();
    if (!carriesWordId(this.world, self, word)) return `You do not carry the word '${word}' to unfold.`;
    const place = this.here(self);
    if (place === null) return "You are nowhere to unfold a being into.";
    const { world: next, entity } = unfold(this.world, word, place);
    this.world = next;
    return `You unfold '${word}'. A new being — ${entity} — takes shape, made from the word that was made from a thing.`;
  }

  /** Apply one command, mutating the world; mark affected subjects dirty; emit overheard
   *  events to other actors; return the acting actor's own line. */
  private apply(actor: string, line: string, dirty: Set<string>, events: SceneEvent[]): string | null {
    const trimmed = line.trim();
    if (!trimmed) return null;
    if (!this.players.has(actor)) {
      this.join(actor, this.startRoom);
      dirty.add(actor);
      dirty.add(this.startRoom);
    }
    const [head, ...rest] = trimmed.split(/\s+/);
    const verb = (head ?? "").toLowerCase();
    const arg = rest.join(" ");
    const touch = (...ids: (string | null)[]): void => { for (const id of ids) if (id !== null) dirty.add(id); };

    if (verb.startsWith("@")) return this.creatorCommand(actor, verb.slice(1), arg, touch);
    // Expand a personal alias (guarding against an alias to itself).
    const expansion = valueOf(this.world, actor, `alias:${verb}`);
    if (expansion !== null && expansion !== "" && expansion.split(/\s+/)[0]?.toLowerCase() !== verb) {
      return this.apply(actor, `${expansion} ${arg}`.trim(), dirty, events);
    }
    if (DIRECTIONS[verb] !== undefined && !arg) return this.go(actor, DIRECTIONS[verb]!, touch);
    // A muted player's voice carries nowhere.
    if (SPEECH_VERBS.has(verb) && valueOf(this.world, actor, "muted") === "true") return "Your voice is silenced.";
    // The genre toolkit is optional: with `genre: false` its verbs are not offered (a game
    // command of the same name may still claim it, else it is unknown).
    if (this.game.genre === false && GENRE_VERBS.has(verb)) {
      const command = this.game.commands?.[verb];
      return command !== undefined ? command(this.gameContext(events), actor, arg) : `You don't know how to "${verb}". Try "help".`;
    }

    switch (verb) {
      case "look": case "l":
        return arg ? this.examine(actor, arg) : this.describe(actor);
      case "examine": case "x": case "inspect":
        return this.examine(actor, arg);
      case "go": case "move": case "walk":
        return this.go(actor, DIRECTIONS[arg.toLowerCase()] ?? arg.toLowerCase(), touch);
      case "exits":
        return this.exitsLine(actor);
      case "search": case "rummage":
        return this.search(actor);
      case "mind": case "cabinet": case "faculties":
        return cabinetReport(this.world, bodyOf(this.world, actor));
      case "eat": case "consume":
        return this.eat(actor, arg);
      case "regard": case "commune": case "introspect":
        return this.regard(actor, arg);
      case "contemplate": case "think": case "reflect": {
        const self = bodyOf(this.world, actor);
        const { world, message } = beginThought(this.world, self, arg.trim().toLowerCase(), this.lastTick, this.thoughtSignals(self));
        this.world = world;
        return message;
      }
      case "thoughts": case "musings": case "psyche":
        return thoughtReport(this.world, bodyOf(this.world, actor), this.lastTick, this.thoughtSignals(bodyOf(this.world, actor)));
      case "campaign": case "saga": case "journey":
        return campaignReport(OFF_SEASON, numberOf(this.world, bodyOf(this.world, actor), "campaign:off-season", 0), this.campaignView(bodyOf(this.world, actor)));
      case "standing": case "reputation": case "rep": {
        const self = bodyOf(this.world, actor);
        const bl = bountyLine(this.world, self);
        return reputationReport(this.world, self, this.cat.factions) + (bl === null ? "" : `\n${bl}`);
      }
      case "pay": case "bounty": case "yield":
        return this.payBountyCmd(bodyOf(this.world, actor));
      case "enter": case "instance":
        return this.enterInstance(actor, arg, touch);
      // ── predication world-sim ──
      case "afford": case "actions": case "can":
        return this.affordList(actor, arg);
      case "inhabit": case "possess": case "become":
        return this.inhabitCmd(actor, arg);
      case "release": case "uninhabit": case "unpossess":
        return this.releaseCmd(actor);
      case "history": case "entanglements": case "past":
        return this.historyCmd(actor);
      case "eulogize": case "mourn":
        return this.eulogize(actor, arg, events);
      case "invoke":
        return this.invokeWord(actor, arg);
      case "vocabulary": case "lexicon": case "words":
        return this.vocabularyCmd(actor);
      case "unfold": case "resurrect":
        return this.unfoldCmd(actor, arg);
      case "speak":
        return this.speak(actor, arg, events);
      case "learn":
        return this.learn(actor, arg);
      case "languages": case "tongues":
        return this.languages(actor);
      case "lock": case "unlock":
        return this.lockDoor(actor, arg, verb === "lock");
      case "take": case "get": case "pick":
        return this.take(actor, arg.replace(/^up\s+/, ""), touch);
      case "drop":
        return this.drop(actor, arg, touch);
      case "give":
        return this.give(actor, arg, touch);
      case "inventory": case "inv": case "i":
        return this.inventory(actor);
      case "wield": case "wear": case "equip":
        return this.equip(actor, arg);
      case "unwield": case "unwear": case "remove": case "unequip":
        return this.unequip(actor, arg);
      case "read":
        return this.read(actor, arg);
      case "open": case "close":
        return this.setOpen(actor, arg, verb === "open");
      case "buy":
        return this.buy(actor, arg, touch);
      case "sell":
        return this.sell(actor, arg, touch);
      case "list": case "wares":
        return this.wares(actor);
      case "say": case "'":
        return this.say(actor, arg, events);
      case "emote": case "me": case ":":
        return this.emote(actor, arg, events);
      case "tell": case "whisper":
        return this.tell(actor, arg, events);
      case "chat": case "ooc": case "gossip":
        return this.chat(actor, arg, events);
      case "board": case "embark":
        return this.board(actor, arg, touch);
      case "disembark": case "ashore": case "land":
        return this.disembark(actor, touch);
      case "sail": case "helm":
        return this.sail(actor, arg, touch, events);
      case "ships": case "vessels":
        return this.shipsHere(actor);
      case "rent":
        return this.rentShip(actor, arg, touch);
      case "buyship": case "purchase":
        return this.buyShip(actor, arg, touch);
      case "build": case "lay":
        return this.build(actor, arg.replace(/^(down|a|an)\s+/i, ""), touch);
      case "craft": case "make":
        return this.craft(actor, arg.replace(/^(a|an|some)\s+/i, ""), touch);
      case "recipes":
        return `You can craft: ${Object.keys(this.cat.recipes).join(", ")}.`;
      case "fish": case "forage": case "chop": case "mine": case "quarry":
        return this.gather(actor, this.cat.gatherVerbs[verb]!, touch);
      case "construct": case "raise": case "erect":
        return this.construct(actor, arg, touch);
      case "cure": case "smoke":
        return this.cure(actor);
      case "structures": case "blueprints":
        return ["You can raise (with materials in hand):", ...Object.values(STRUCTURES).map((s) => `  ${s.id.padEnd(11)} — ${s.name} (${costOf(s)})`)].join("\n");
      case "gather": case "harvest":
        return this.gather(actor, arg.trim().toLowerCase(), touch);
      case "scan": case "lookout":
        return this.scan(actor);
      case "survey": case "ecology":
        return this.survey(actor);
      case "propose":
        return this.propose(actor, arg, events);
      case "support": case "second":
        return this.support(actor, arg, events);
      case "laws": case "commons":
        return this.laws();
      case "industrialize": case "rig": case "trawl":
        return this.industrialize(actor, arg, touch);
      case "program": case "orders": case "script":
        return this.program(actor, arg);
      case "define": case "inscribe":
        return this.defineSpell(actor, arg);
      case "cast": case "invoke":
        return this.castSpell(actor, arg, events);
      case "spells": case "spellbook":
        return this.spellbook(actor);
      case "automate":
        return this.automate(actor, arg);
      case "unautomate": case "stop":
        return this.unautomate(actor);
      case "talk": case "greet": case "ask":
        return this.talk(actor, arg, events);
      case "attack": case "kill": case "hit":
        return this.attack(actor, arg, dirty, events);
      case "status": case "score": case "health": case "hp":
        return this.status(actor);
      case "quests": case "journal": case "errands":
        return this.quests();
      case "skills": case "abilities":
        return this.skills(actor);
      case "who": case "players": case "online":
        return this.who();
      case "time": case "weather": case "when":
        return timeReport(this.world);
      case "form": case "band":
        return this.formParty(actor);
      case "join": case "follow":
        return this.joinPartyCmd(actor, arg, verb === "follow", events);
      case "party":
        return this.partyChannel(actor, arg, events);
      case "leave": case "unfollow":
        return this.leavePartyCmd(actor);
      case "found":
        return this.foundGuildCmd(actor, arg);
      case "enlist":
        return this.enlistCmd(actor, arg, events);
      case "guild":
        return arg.trim() === "" ? this.guildRoster(actor) : this.guildChannel(actor, arg, events);
      case "resign":
        return this.resignCmd(actor, events);
      case "sheet": case "character": case "xp":
        return this.sheet(actor);
      case "profess": case "profession":
        return this.professCmd(actor, arg);
      case "alias":
        return this.aliasCmd(actor, arg);
      case "mail": case "send":
        return this.sendMail(actor, arg, events);
      case "inbox": case "readmail":
        return this.readMail(actor);
      case "help": case "?": case "commands":
        return HELP;
      default: {
        // A soul emote (smile, wave at the harbormaster, ...).
        if (this.cat.souls[verb] !== undefined) return this.performSoul(actor, verb, arg, events);
        // A bare word naming an exit of the current room is a move (e.g. `aft`, `seaward`).
        const here = this.here(actor);
        if (!arg && here !== null && this.content.rooms[here]?.exits?.[verb] !== undefined) {
          return this.go(actor, verb, touch);
        }
        // A verb the GAME contributes — the SDK's custom commands (engine verbs took precedence).
        const command = this.game.commands?.[verb];
        if (command !== undefined) return command(this.gameContext(events), actor, arg);
        return `You don't know how to "${verb}". Try "help".`;
      }
    }
  }

  private exitsLine(actor: string): string {
    const room = this.content.rooms[this.here(actor) ?? ""];
    const entries = Object.entries(room?.exits ?? {});
    if (!entries.length) return "There is no way out of here.";
    return entries.map(([dir, dest]) => `${dir} -> ${this.name(dest)}`).join("\n");
  }

  private go(actor: string, direction: string, touch: (...ids: (string | null)[]) => void): string {
    const from = this.here(actor);
    const room = this.content.rooms[from ?? ""];
    const dest = room?.exits?.[direction];
    if (dest === undefined) return `You can't go ${direction} from here.`;
    if (from !== null) {
      const door = this.doorBlocking(from, direction);
      if (door !== null) return `${capitalize(this.name(door))} is ${valueOf(this.world, door, "door-state") ?? "closed"}. (try 'open ${this.name(door).replace(/^(the|a|an)\s+/, "")}')`;
    }
    this.world = engineGo(this.world, actor, dest);
    if (this.players.has(actor)) this.world = practise(this.world, actor, "navigation"); // wayfaring is a skill
    touch(actor, from, dest);
    return this.describe(actor);
  }

  private examine(actor: string, query: string): string {
    if (!query) return "Examine what?";
    const roomId = this.here(actor);
    const { items, npcs } = this.around(actor);
    const candidates = [...new Set([roomId ?? "", ...items, ...npcs, ...contentsOf(this.world, actor)])].filter(Boolean);
    const id = this.resolve(query, candidates);
    if (id === null) return `You don't see "${query}" here.`;
    const thing = this.content.rooms[id] ?? this.content.things[id];
    const base = thing?.description ?? `You look at ${this.name(id)}, but there's nothing more to say.`;
    if (this.content.things[id]?.kind === "npc" && valueOf(this.world, id, "condition") !== "dead") {
      return `${base}\nThey seem ${valueOf(this.world, id, "mood") ?? moodOf(this.world, id)}.`;
    }
    return base;
  }

  private take(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    if (!query) return "Take what?";
    const { items, room } = this.around(actor);
    const id = this.resolve(query, [...items, ...this.openContents(actor)]);
    if (id === null) return `There is no "${query}" here to take.`;
    if (!this.content.isTakeable(id)) return `You can't take ${this.name(id)}.`;
    this.world = engineTake(this.world, actor, id);
    // The composition leaves residue: actor and item are now entangled (F8).
    this.world = entangle(this.world, actor, id, "held");
    touch(actor, id, room);
    return `You take ${this.name(id)}.`;
  }

  private drop(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    if (!query) return "Drop what?";
    const id = this.resolve(query, contentsOf(this.world, actor));
    if (id === null) return `You aren't carrying "${query}".`;
    this.world = engineDrop(this.world, actor, id);
    touch(actor, id, this.here(actor));
    return `You drop ${this.name(id)}.`;
  }

  private give(actor: string, arg: string, touch: (...ids: (string | null)[]) => void): string {
    const toMatch = arg.match(/^(.*)\s+to\s+(.*)$/i);
    const itemQuery = toMatch ? toMatch[1]! : arg.split(/\s+/).slice(1).join(" ");
    const whoQuery = toMatch ? toMatch[2]! : (arg.split(/\s+/)[0] ?? "");
    const item = this.resolve(itemQuery, contentsOf(this.world, actor));
    if (item === null) return `You aren't carrying "${itemQuery}".`;
    const who = this.resolve(whoQuery, this.around(actor).npcs);
    if (who === null) return `There is no "${whoQuery}" here to give to.`;
    this.world = engineGive(this.world, actor, item, who);
    touch(actor, item, who);
    const base = `You give ${this.name(item)} to ${this.name(who)}.`;
    // An emergent demand (a μ-quest the Director minted from need) completes by *type*: the
    // recipient `wants` a tag and the given thing carries it. Checked before authored quests.
    const fulfilled = this.fulfilDemand(actor, item, who);
    if (fulfilled !== null) return `${base}\n${fulfilled}`;
    // An authored μ-quest completes exactly when its constructed element now exists in the world.
    const completed = this.content.quests.find(
      (q) => q.give === item && q.to === who && placeOf(this.world, q.give) === q.to,
    );
    if (completed === undefined) return base;
    this.world = awardXp(this.world, actor, 25).world;
    return `${base}\n${completed.reward}`;
  }

  /**
   * Fulfil an NPC's standing demand: if `who` `wants` a tag the given `item` carries, the μ-element
   * exists — relieve the need, pay the reward, raise standing with the NPC's faction, clear the
   * demand. Returns the line the giver sees, or null when there was no matching demand.
   */
  private fulfilDemand(actor: string, item: string, who: string): string | null {
    const want = valueOf(this.world, who, "wants");
    if (want === null || want === "" || !this.tagsOf(item).includes(want)) return null;
    const reward = numberOf(this.world, who, "want-reward", 5);
    this.world = tell(this.world, [
      { e: actor, a: "coin", v: String(numberOf(this.world, actor, "coin", 0) + reward) },
      { e: who, a: "wants", v: "" },
      { e: who, a: "want-reward", v: "0" },
    ]);
    if (want === "edible") this.world = relieve(this.world, who, "hunger");
    for (const f of factionsOfTags(this.tagsOf(who))) this.world = shiftStanding(this.world, actor, f, 6, this.cat.factions);
    this.world = awardXp(this.world, actor, 10).world;
    return `${capitalize(this.name(who))} takes it gratefully and presses ${reward} coin into your hand.`;
  }

  // ── parties, guilds, advancement ───────────────────────────────────────────

  /** Resolve an online player by id, slug, or substring (not the asker). */
  private resolvePlayer(query: string, actor: string): string | null {
    const q = query.trim().toLowerCase();
    if (q === "") return null;
    return [...this.players].find((p) => p !== actor && (p === q || p.replace(/^player-/, "") === q || p.toLowerCase().includes(q))) ?? null;
  }

  private partyMembers(leader: string): string[] {
    return [...this.players].filter((p) => p === leader || partyOf(this.world, p) === leader);
  }

  private formParty(actor: string): string {
    this.world = joinParty(this.world, actor, actor);
    return `You form a band. Others here may 'join ${this.name(actor).replace(/^player-/, "")}'.`;
  }

  private joinPartyCmd(actor: string, arg: string, asFollow: boolean, events: SceneEvent[]): string {
    const target = this.resolvePlayer(arg, actor);
    if (target === null) return `There is no player "${arg}" abroad to join.`;
    const leader = partyOf(this.world, target) ?? target;
    this.world = joinParty(this.world, actor, leader);
    if (asFollow) this.world = follow(this.world, actor, target);
    events.push({ k: "message", to: leader, text: `${capitalize(this.name(actor))} joins the band.` });
    return `You join ${this.name(target)}'s band${asFollow ? " and fall in behind them" : ""}.`;
  }

  private partyChannel(actor: string, message: string, events: SceneEvent[]): string {
    if (message.trim() === "") return "Say what to the band?";
    const leader = partyOf(this.world, actor);
    if (leader === null) return "You aren't in a band — 'form' one, or 'join' someone.";
    const line = `[band] ${capitalize(this.name(actor))}: ${message}`;
    for (const m of this.partyMembers(leader)) if (m !== actor) events.push({ k: "message", to: m, text: line });
    return line;
  }

  private leavePartyCmd(actor: string): string {
    this.world = leaveParty(this.world, actor);
    return "You leave the band and walk alone.";
  }

  /** Followers fall in with their leader each tick. */
  private followTick(dirty: Set<string>, events: SceneEvent[]): void {
    for (const actor of this.players) {
      const leader = followingOf(this.world, actor);
      if (leader === null) continue;
      const leaderPlace = placeOf(this.world, leader);
      if (leaderPlace !== null && leaderPlace !== placeOf(this.world, actor)) {
        this.world = engineGo(this.world, actor, leaderPlace);
        dirty.add(actor);
        events.push({ k: "message", to: actor, text: `You follow ${this.name(leader)} to ${this.name(leaderPlace)}.` });
      }
    }
  }

  private guildMembers(guild: string): string[] {
    return [...this.players].filter((p) => guildOf(this.world, p) === guild);
  }

  private resolveGuild(query: string): string | null {
    const q = query.trim().toLowerCase();
    const guilds = new Set([...this.players].map((p) => guildOf(this.world, p)).filter((g): g is string => g !== null));
    for (const g of guilds) if (g === guildId(q) || guildName(this.world, g).toLowerCase().includes(q)) return g;
    return null;
  }

  private foundGuildCmd(actor: string, name: string): string {
    if (name.trim() === "") return "Found a guild by what name?";
    if (guildOf(this.world, actor) !== null) return "You already belong to a guild; resign first.";
    const cost = 50;
    const coin = numberOf(this.world, actor, "coin", 0);
    if (coin < cost) return `Founding a guild costs ${cost} coin; you have ${coin}.`;
    const { world } = foundGuild(this.world, actor, name.trim());
    this.world = tell(world, [{ e: actor, a: "coin", v: String(coin - cost) }]);
    return `You found ${name.trim()} and take its helm. (-${cost} coin)`;
  }

  private enlistCmd(actor: string, arg: string, events: SceneEvent[]): string {
    const guild = this.resolveGuild(arg);
    if (guild === null) return `There is no guild "${arg}".`;
    if (guildOf(this.world, actor) !== null) return "Resign your current guild first.";
    this.world = enroll(this.world, actor, guild);
    for (const m of this.guildMembers(guild)) if (m !== actor) events.push({ k: "message", to: m, text: `${capitalize(this.name(actor))} enlists in ${guildName(this.world, guild)}.` });
    return `You enlist in ${guildName(this.world, guild)}.`;
  }

  private guildChannel(actor: string, message: string, events: SceneEvent[]): string {
    const guild = guildOf(this.world, actor);
    if (guild === null) return "You belong to no guild. 'found <name>' or 'enlist <guild>'.";
    const line = `[${guildName(this.world, guild)}] ${capitalize(this.name(actor))}: ${message}`;
    for (const m of this.guildMembers(guild)) if (m !== actor) events.push({ k: "message", to: m, text: line });
    return line;
  }

  private guildRoster(actor: string): string {
    const guild = guildOf(this.world, actor);
    if (guild === null) return "You belong to no guild.";
    const members = this.guildMembers(guild).map((m) => `  ${capitalize(this.name(m))}${guildLeader(this.world, guild) === m ? " (leader)" : ""}`);
    return [`${guildName(this.world, guild)} — ${members.length} member(s):`, ...members].join("\n");
  }

  private resignCmd(actor: string, events: SceneEvent[]): string {
    const guild = guildOf(this.world, actor);
    if (guild === null) return "You belong to no guild.";
    this.world = resign(this.world, actor);
    for (const m of this.guildMembers(guild)) events.push({ k: "message", to: m, text: `${capitalize(this.name(actor))} resigns from ${guildName(this.world, guild)}.` });
    return `You resign from ${guildName(this.world, guild)}.`;
  }

  /** Award experience; announce a newly earned title to the actor. */
  private gainXp(actor: string, amount: number, events: SceneEvent[]): void {
    const { world, newTitle } = awardXp(this.world, actor, amount);
    this.world = world;
    if (newTitle !== null) events.push({ k: "message", to: actor, text: `✦ You rise to ${newTitle}.` });
  }

  /** The full character sheet — title, vitals, skills, guild, band. */
  private sheet(actor: string): string {
    const xp = xpOf(this.world, actor);
    const profession = professionOf(this.world, actor);
    const trade = profession === null ? "" : `, ${this.cat.professions[profession]?.title ?? profession}`;
    const lines = [`${capitalize(this.name(actor))} — ${titleFor(xp)}${trade} (${xp} xp)`, this.status(actor).split("\n")[0]];
    const guild = guildOf(this.world, actor);
    if (guild !== null) lines.push(`Guild: ${guildName(this.world, guild)}${guildLeader(this.world, guild) === actor ? " (leader)" : ""}`);
    const party = partyOf(this.world, actor);
    if (party !== null) lines.push(`Band: ${party === actor ? "yours" : `led by ${this.name(party)}`}`);
    const skills = this.skills(actor);
    if (!skills.startsWith("You have practised")) lines.push(skills);
    return lines.join("\n");
  }

  // ── search, languages, doors ───────────────────────────────────────────────

  /** Whether a thing is present but unfound — hidden and not yet revealed by searching. */
  private isHidden(id: string): boolean {
    return this.tagsOf(id).includes("hidden") && valueOf(this.world, id, "revealed") !== "true";
  }

  /** Search the room for hidden things — skill-gated; success reveals one and trains searching. */
  private search(actor: string): string {
    const room = this.here(actor);
    if (room === null) return "There is nowhere to search.";
    this.world = practise(this.world, actor, "searching");
    const hidden = contentsOf(this.world, room).filter((id) => this.isHidden(id));
    if (hidden.length === 0) return "You search the place over and turn up nothing hidden.";
    if (rngFor(worldSeed(this.world), worldTime(this.world), hashStr(actor)) > 0.25 + skillBonus(this.world, actor, "searching") * 0.6) return "You search, but whatever's hidden here eludes you — for now.";
    const found = hidden[0]!;
    this.world = tell(this.world, [{ e: found, a: "revealed", v: "true" }]);
    return `You uncover ${this.name(found)}!`;
  }

  /** Whether an actor (or NPC) speaks a tongue — everyone has the common speech. */
  private knows(actor: string, language: string): boolean {
    return language === "common" || valueOf(this.world, actor, `language:${language}`) === "true";
  }

  /** Speak in a named tongue — clear to those who know it, garbled to those who do not (per fiber). */
  private speak(actor: string, arg: string, events: SceneEvent[]): string {
    const [language, ...rest] = arg.split(/\s+/);
    const message = rest.join(" ");
    if (language === undefined || message === "") return "Speak which tongue, and what? (e.g. 'speak harbor-cant hello')";
    if (!this.knows(actor, language)) return `You don't speak ${language}.`;
    const clear = `${capitalize(this.name(actor))} says in ${language}, "${message}"`;
    for (const other of this.audience(actor)) {
      events.push({ k: "message", to: other, text: this.knows(other, language) ? clear : `${capitalize(this.name(actor))} says something in ${language}: "${garble(message)}"` });
    }
    return `You say in ${language}, "${message}"`;
  }

  /** Learn a tongue from a co-located speaker of it. */
  private learn(actor: string, arg: string): string {
    const language = arg.trim().toLowerCase();
    if (language === "" || language === "common") return "Learn which tongue?";
    if (this.knows(actor, language)) return `You already speak ${language}.`;
    const teacher = this.around(actor).npcs.find((id) => this.knows(id, language));
    if (teacher === undefined) return `No one here speaks ${language} to teach you.`;
    this.world = tell(this.world, [{ e: actor, a: `language:${language}`, v: "true" }]);
    return `${capitalize(this.name(teacher))} teaches you the rudiments of ${language}.`;
  }

  /** The tongues an actor speaks. */
  private languages(actor: string): string {
    const known = ["common"];
    for (const fact of perceive(this.world, actor).facts) {
      if (fact.e === actor && fact.a.startsWith("language:") && fact.v === "true" && fact.charge === "potential") known.push(fact.a.slice("language:".length));
    }
    return `You speak: ${[...new Set(known)].join(", ")}.`;
  }

  /** A door in the room that guards a direction and is not open, or null. */
  private doorBlocking(room: string, direction: string): string | null {
    for (const id of contentsOf(this.world, room)) {
      if (!this.tagsOf(id).includes("door")) continue;
      if (this.tagsOf(id).includes(`guards:${direction}`) && valueOf(this.world, id, "door-state") !== "open") return id;
    }
    return null;
  }

  /** Whether the actor holds the key a door names (`key:<itemid>` tag). */
  private hasKey(actor: string, door: string): boolean {
    const keyTag = this.tagsOf(door).find((t) => t.startsWith("key:"));
    if (keyTag === undefined) return true; // no key required
    const keyId = keyTag.slice("key:".length);
    return contentsOf(this.world, actor).includes(keyId);
  }

  /** Lock or unlock a door — needs its key in hand. */
  private lockDoor(actor: string, query: string, locking: boolean): string {
    if (!query) return locking ? "Lock what?" : "Unlock what?";
    const id = this.resolve(query, this.around(actor).items.filter((x) => this.tagsOf(x).includes("door")));
    if (id === null) return `There is no door "${query}" here.`;
    if (!this.hasKey(actor, id)) return `You don't have the key to ${this.name(id)}.`;
    this.world = tell(this.world, [{ e: id, a: "door-state", v: locking ? "locked" : "closed" }]);
    return locking ? `You lock ${this.name(id)}.` : `You unlock ${this.name(id)}.`;
  }

  // ── in-world creator tools (build the world from inside, persisted) ─────────

  /** Grant an actor the creator capability (server/admin use). */
  grantCreator(actor: string): void {
    this.world = tell(this.world, [{ e: actor, a: "creator", v: "true" }]);
    this.players.add(actor);
  }

  /** Rebuild one authored edit's *content* (rooms/things); world facts come from the snapshot. */
  private realizeAuthorContent(op: AuthorOp): void {
    const rooms = this.content.rooms as Record<string, RoomContent>;
    const things = this.content.things as Record<string, ThingContent>;
    switch (op.kind) {
      case "room":
        rooms[op.id] = { id: op.id, name: op.name, description: op.description, exits: { ...op.exits }, tags: ["place", "authored"] };
        break;
      case "thing":
        things[op.id] = { id: op.id, name: op.name, description: op.description, location: op.location, tags: ["item", "takeable", "authored"], kind: "item", speech: undefined, evasive: false, text: undefined };
        break;
      case "exit":
        if (rooms[op.room] !== undefined) (rooms[op.room]!.exits as Record<string, string>)[op.dir] = op.dest;
        break;
      case "describe":
        if (rooms[op.id] !== undefined) rooms[op.id] = { ...rooms[op.id]!, description: op.description };
        else if (things[op.id] !== undefined) things[op.id] = { ...things[op.id]!, description: op.description };
        break;
      case "rename":
        if (rooms[op.id] !== undefined) rooms[op.id] = { ...rooms[op.id]!, name: op.name };
        else if (things[op.id] !== undefined) things[op.id] = { ...things[op.id]!, name: op.name };
        break;
      case "tag":
        if (rooms[op.id] !== undefined) rooms[op.id] = { ...rooms[op.id]!, tags: [...rooms[op.id]!.tags, op.tag] };
        else if (things[op.id] !== undefined) things[op.id] = { ...things[op.id]!, tags: [...things[op.id]!.tags, op.tag] };
        break;
    }
  }

  /** The world facts an authored edit asserts (exits, placements) — told live, persisted. */
  private authorFacts(op: AuthorOp): readonly { e: string; a: string; v: string }[] {
    if (op.kind === "room") return Object.entries(op.exits).map(([, dest]) => ({ e: op.id, a: "exit", v: dest }));
    if (op.kind === "exit") return [{ e: op.room, a: "exit", v: op.dest }];
    if (op.kind === "thing") return [{ e: op.id, a: "located-in", v: op.location }];
    return [];
  }

  /** Apply a creator edit: realize its content, tell its facts, and record it for persistence. */
  private applyAuthor(op: AuthorOp): void {
    this.realizeAuthorContent(op);
    const facts = this.authorFacts(op);
    if (facts.length > 0) this.world = tell(this.world, facts);
    this.authored.push(op);
  }

  /**
   * `construct <structure> <direction>` — Minecraft survival-building: a player who carries the
   * materials raises a new, owned, persistent room attached to where they stand. It uses the same
   * authored-content path as the creator's `@dig`, but is *paid for* in timber, iron, and granite.
   */
  private construct(actor: string, arg: string, touch: (...ids: (string | null)[]) => void): string {
    const parts = arg.trim().split(/\s+/);
    const key = (parts[0] ?? "").toLowerCase();
    const direction = (parts[1] ?? "").toLowerCase();
    const structure = STRUCTURES[key];
    if (structure === undefined) return `You don't know how to build "${key}". You can raise: ${Object.keys(STRUCTURES).join(", ")}.`;
    const here = this.here(actor);
    if (here === null) return "You are nowhere to build from.";
    if (direction === "") return `Build ${structure.name} in which direction? (e.g. 'construct ${key} north')`;
    if (this.content.rooms[here]?.exits?.[direction] !== undefined) return `There is already a way ${direction} from here — build elsewhere.`;
    // Tally and reserve the carried materials the structure needs (by item tag).
    const have: Record<string, number> = {};
    const byMaterial: Record<string, string[]> = {};
    for (const id of contentsOf(this.world, actor)) {
      for (const mat of Object.keys(structure.needs)) {
        if (this.tagsOf(id).includes(mat)) { have[mat] = (have[mat] ?? 0) + 1; (byMaterial[mat] ??= []).push(id); }
      }
    }
    const { ok, missing } = shortfall(structure, have);
    if (!ok) return `You can't yet raise ${structure.name} (needs ${costOf(structure)}). You want ${missing.join(", ")}.`;
    // Consume the materials, raise the room (persisted), tag it, and deed it to the builder.
    const consume: { e: string; a: string; v: string }[] = [];
    for (const [mat, n] of Object.entries(structure.needs)) for (let i = 0; i < n; i++) consume.push({ e: byMaterial[mat]![i]!, a: "located-in", v: "nothing" });
    this.world = tell(this.world, consume);
    const id = `built-${structure.id}-${this.authored.length + 1}`;
    const reverse = REVERSE[direction] ?? "back";
    this.applyAuthor({ kind: "room", id, name: structure.name, description: structure.description, exits: { [reverse]: here } });
    this.applyAuthor({ kind: "exit", room: here, dir: direction, dest: id });
    for (const tag of structure.tags) if (tag !== "place") this.applyAuthor({ kind: "tag", id, tag });
    this.world = tell(this.world, [{ e: id, a: "owner", v: actor }, { e: id, a: "built-by", v: actor }]);
    this.world = practise(this.world, actor, structure.skill);
    touch(actor, here, id);
    return `You raise ${structure.name} to the ${direction} — ${costOf(structure)} well spent. It is yours, and it will stand.`;
  }

  /** Dispatch a creator command (`@dig`, `@describe`, ...) — only a creator may shape the world. */
  private creatorCommand(actor: string, op: string, arg: string, touch: (...ids: (string | null)[]) => void): string {
    if (valueOf(this.world, actor, "creator") !== "true") return "Only a creator may shape the world.";
    const here = this.here(actor);
    switch (op) {
      case "dig": {
        const [direction, ...nameParts] = arg.split(/\s+/);
        const name = nameParts.join(" ");
        if (direction === undefined || name === "") return "Usage: @dig <direction> <room name>";
        if (here === null) return "You are nowhere to dig from.";
        const id = `room-${slug(name)}-${this.authored.length + 1}`;
        const reverse = REVERSE[direction] ?? "back";
        this.applyAuthor({ kind: "room", id, name, description: `${capitalize(name)} — newly dug, bare as yet. '@describe here <words>' to give it shape.`, exits: { [reverse]: here } });
        this.applyAuthor({ kind: "exit", room: here, dir: direction, dest: id });
        touch(here, id);
        return `You dig ${direction} from here to ${name}.`;
      }
      case "describe": case "desc": {
        const [target, ...rest] = arg.split(/\s+/);
        const text = rest.join(" ");
        if (target === undefined || text === "") return "Usage: @describe <here|thing> <words>";
        const id = target === "here" ? here : this.resolve(target, this.creatorTargets(actor));
        if (id === null) return `No "${target}" to describe here.`;
        this.applyAuthor({ kind: "describe", id, description: text });
        return `You describe ${this.name(id)}.`;
      }
      case "name": {
        const [target, ...rest] = arg.split(/\s+/);
        const text = rest.join(" ");
        if (target === undefined || text === "") return "Usage: @name <here|thing> <new name>";
        const id = target === "here" ? here : this.resolve(target, this.creatorTargets(actor));
        if (id === null) return `No "${target}" to name here.`;
        this.applyAuthor({ kind: "rename", id, name: text });
        return `You name it ${text}.`;
      }
      case "create": case "make": {
        if (arg.trim() === "" || here === null) return "Usage: @create <item name>";
        const id = `item-${slug(arg)}-${this.authored.length + 1}`;
        this.applyAuthor({ kind: "thing", id, name: arg.trim(), description: `${capitalize(arg.trim())}, freshly conjured.`, location: here });
        touch(actor, id, here);
        return `You create ${arg.trim()} here.`;
      }
      case "exit": {
        const [direction, dest] = arg.split(/\s+/);
        if (direction === undefined || dest === undefined || here === null) return "Usage: @exit <direction> <room-id>";
        if (this.content.rooms[dest] === undefined) return `There is no room "${dest}".`;
        this.applyAuthor({ kind: "exit", room: here, dir: direction, dest });
        return `You open a way ${direction} to ${this.name(dest)}.`;
      }
      case "tag": {
        const [target, tag] = arg.split(/\s+/);
        const id = target === "here" ? here : this.resolve(target ?? "", this.creatorTargets(actor));
        if (id === null || tag === undefined) return "Usage: @tag <here|thing> <tag>";
        this.applyAuthor({ kind: "tag", id, tag });
        return `You tag ${this.name(id)} '${tag}'.`;
      }
      // ── moderation / admin ──
      case "kick": {
        const target = this.resolvePlayer(arg, actor);
        if (target === null) return `No player "${arg}" online.`;
        this.players.delete(target);
        return `You kick ${capitalize(this.name(target))} from the world.`;
      }
      case "mute": case "unmute": {
        const target = this.resolvePlayer(arg, actor);
        if (target === null) return `No player "${arg}" online.`;
        this.world = tell(this.world, [{ e: target, a: "muted", v: op === "mute" ? "true" : "false" }]);
        return op === "mute" ? `You silence ${capitalize(this.name(target))}.` : `You restore ${capitalize(this.name(target))}'s voice.`;
      }
      case "teleport": case "tp": {
        const [whoQuery, dest] = arg.split(/\s+/);
        const target = this.resolvePlayer(whoQuery ?? "", actor);
        if (target === null || dest === undefined) return "Usage: @teleport <player> <room-id>";
        if (this.content.rooms[dest] === undefined) return `No room "${dest}".`;
        this.world = engineGo(this.world, target, dest);
        touch(target, dest);
        return `You whisk ${capitalize(this.name(target))} to ${this.name(dest)}.`;
      }
      case "summon": {
        const target = this.resolvePlayer(arg, actor);
        if (target === null || here === null) return "Usage: @summon <player>";
        this.world = engineGo(this.world, target, here);
        touch(target, here);
        return `You summon ${capitalize(this.name(target))} to your side.`;
      }
      case "stats": {
        const m = this.metrics();
        return `Server: ${m.players} online, ${m.rooms} rooms, ${m.things} things, tick ${m.tick}.`;
      }
      default:
        return `Unknown creator command "@${op}". Try @dig @describe @name @create @exit @tag @kick @mute @teleport @summon @stats.`;
    }
  }

  private creatorTargets(actor: string): string[] {
    const here = this.here(actor);
    return [...(here === null ? [] : [here, ...contentsOf(this.world, here)]), ...contentsOf(this.world, actor)];
  }

  // ── professions, aliases, mail ─────────────────────────────────────────────

  /** Take up a trade — recording the profession and grounding its skills. */
  private professCmd(actor: string, name: string): string {
    const key = name.trim().toLowerCase();
    if (key === "") return `Profess which trade? ${Object.keys(this.cat.professions).join(", ")}.`;
    const prof = this.cat.professions[key];
    if (prof === undefined) return `There is no trade "${name}". Trades: ${Object.keys(this.cat.professions).join(", ")}.`;
    this.world = profess(this.world, actor, key, this.cat.professions);
    return `You take up the trade of ${prof.title}; its skills (${prof.skills.join(", ")}) come easier to your hand.`;
  }

  /** Set or clear a personal command alias. */
  private aliasCmd(actor: string, arg: string): string {
    const space = arg.indexOf(" ");
    const name = (space === -1 ? arg : arg.slice(0, space)).trim().toLowerCase();
    const command = space === -1 ? "" : arg.slice(space + 1).trim();
    if (name === "") return "Usage: alias <name> <command>  ('alias <name>' to clear)";
    if (command === "") {
      this.world = tell(this.world, [{ e: actor, a: `alias:${name}`, v: "" }]);
      return `Alias '${name}' cleared.`;
    }
    this.world = tell(this.world, [{ e: actor, a: `alias:${name}`, v: command }]);
    return `Alias set: '${name}' → ${command}`;
  }

  private mailbox(actor: string): string {
    return `${actor}-mailbox`;
  }

  /** Send a letter to a player (online or not) — it waits in their mailbox. */
  private sendMail(actor: string, arg: string, events: SceneEvent[]): string {
    const [whoQuery, ...rest] = arg.split(/\s+/);
    const body = rest.join(" ");
    if (whoQuery === undefined || body === "") return "Usage: mail <player> <message>";
    const to = this.resolvePlayer(whoQuery, actor) ?? `player-${slug(whoQuery.replace(/^player-/, ""))}`;
    const box = this.mailbox(to);
    const id = `mail-${to}-${contentsOf(this.world, box).length + 1}`;
    this.world = tell(this.world, [
      { e: id, a: "located-in", v: box },
      { e: id, a: "mail-from", v: actor },
      { e: id, a: "mail-body", v: body },
    ]);
    if (this.players.has(to)) events.push({ k: "message", to, text: `✉ A letter arrives from ${capitalize(this.name(actor))}. ('inbox' to read.)` });
    return `Your letter is away to ${whoQuery.replace(/^player-/, "")}.`;
  }

  /** Read the letters in your mailbox. */
  private readMail(actor: string): string {
    const mail = contentsOf(this.world, this.mailbox(actor));
    if (mail.length === 0) return "Your mailbox is empty.";
    const lines = [`You have ${mail.length} letter(s):`];
    for (const id of mail) {
      const from = (valueOf(this.world, id, "mail-from") ?? "someone").replace(/^player-/, "");
      lines.push(`  from ${capitalize(from)}: ${valueOf(this.world, id, "mail-body") ?? ""}`);
    }
    return lines.join("\n");
  }

  /** The players currently in the world. */
  private who(): string {
    const names = [...this.players].map((id) => capitalize(this.name(id))).sort();
    return names.length === 0 ? "No one else is about." : [`${names.length} abroad in Farstone:`, ...names.map((n) => `  ${n}`)].join("\n");
  }

  /** The actor's craft skills (with milestone tiers) and the faculties of their Cabinet — one
   *  Project-Gorgon-style sheet where everything is skillful and everything grows by doing. */
  private skills(actor: string): string {
    const skillLines: string[] = [];
    for (const fact of perceive(this.world, actor).facts) {
      if (fact.e === actor && fact.a.startsWith("skill:") && fact.charge === "potential") {
        const lvl = Number(fact.v);
        skillLines.push(`  ${fact.a.slice("skill:".length).padEnd(14)} ${String(lvl).padStart(3)}/100  (${skillTier(lvl)})`);
      }
    }
    const out: string[] = [skillLines.length ? "Your skills (everything is skillful — they grow by doing):" : "You have practised no craft skills yet."];
    if (skillLines.length) out.push(...skillLines.sort());
    out.push("", "Your faculties (the Cabinet — inner senses that keen with use):");
    for (const f of FACULTIES) {
      const l = facultyLevel(this.world, actor, f.key);
      out.push(`  ${f.name.padEnd(14)} ${String(l).padStart(3)}/${FACULTY_MAX}`);
    }
    return out.join("\n");
  }

  /** `eat` / `consume` — eating is a skill (Gourmandise): a finer palate draws more from food. */
  private eat(actor: string, query: string): string {
    if (!query) return "Eat what?";
    const id = this.resolve(query, contentsOf(this.world, actor));
    if (id === null) return `You aren't carrying "${query}".`;
    if (!this.tagsOf(id).includes("edible")) return `You can't eat ${this.name(id)}.`;
    const nutrition = numericTag(this.tagsOf(id), "nutrition") ?? 2;
    const palate = 1 + effectiveBonus(this.world, actor, "gourmandise"); // a trained palate gets more from a meal
    const gain = Math.max(1, Math.round(nutrition * palate));
    const hp = numberOf(this.world, actor, "health", 0);
    const max = numberOf(this.world, actor, "max-health", hp);
    this.world = tell(this.world, [
      { e: id, a: "located-in", v: "nothing" }, // the food is consumed — leaves the world
      { e: actor, a: "health", v: String(Math.min(max, hp + gain)) },
    ]);
    this.world = practise(this.world, actor, "gourmandise");
    return `You eat ${this.name(id)}. It restores ${gain}${palate > 1.05 ? " — your palate makes the most of it" : ""}.`;
  }

  /** The quest journal: authored μ-quests, plus the live demands the Director has minted from need. */
  private quests(): string {
    const lines: string[] = [];
    for (const q of this.content.quests) {
      const done = placeOf(this.world, q.give) === q.to;
      lines.push(`  [${done ? "x" : " "}] ${q.name} — ${q.description}`);
    }
    // Emergent errands: any NPC whose need the Director has posted as a standing demand.
    for (const id of Object.keys(this.content.things)) {
      const want = valueOf(this.world, id, "wants");
      if (want === null || want === "" || valueOf(this.world, id, "condition") === "dead") continue;
      const reward = numberOf(this.world, id, "want-reward", 0);
      const what = want === "edible" ? "something to eat" : want;
      lines.push(`  [ ] ${capitalize(this.name(id))} needs ${what} — bring it and they'll pay ${reward} coin.`);
    }
    return lines.length === 0 ? "You have no errands." : ["Errands:", ...lines].join("\n");
  }

  private inventory(actor: string): string {
    const ids = contentsOf(this.world, actor);
    const wielded = valueOf(this.world, actor, "wielding");
    const worn = valueOf(this.world, actor, "wearing");
    if (!ids.length) return "You are carrying nothing.";
    const mark = (id: string): string =>
      id === wielded ? " (wielded)" : id === worn ? " (worn)" : "";
    return ["You are carrying:", ...ids.map((id) => `  ${this.name(id)}${mark(id)}`)].join("\n");
  }

  // ── equipment ──────────────────────────────────────────────────────────────

  /** Wield a weapon or wear armor you are carrying. */
  private equip(actor: string, query: string): string {
    if (!query) return "Wield or wear what?";
    const id = this.resolve(query, contentsOf(this.world, actor));
    if (id === null) return `You aren't carrying "${query}".`;
    const tags = this.tagsOf(id);
    if (tags.includes("weapon")) {
      this.world = tell(this.world, [{ e: actor, a: "wielding", v: id }]);
      return `You wield ${this.name(id)}.`;
    }
    if (tags.includes("armor")) {
      this.world = tell(this.world, [{ e: actor, a: "wearing", v: id }]);
      return `You put on ${this.name(id)}.`;
    }
    return `You can't wield or wear ${this.name(id)}.`;
  }

  /** Stop wielding/wearing something. */
  private unequip(actor: string, query: string): string {
    const wielded = valueOf(this.world, actor, "wielding");
    const worn = valueOf(this.world, actor, "wearing");
    const held = [wielded, worn].filter((x): x is string => x !== null && x !== "nothing");
    const id = query ? this.resolve(query, held) : held[0] ?? null;
    if (id === null) return query ? `You aren't using "${query}".` : "You aren't wielding or wearing anything.";
    if (id === wielded) {
      this.world = tell(this.world, [{ e: actor, a: "wielding", v: "nothing" }]);
      return `You lower ${this.name(id)}.`;
    }
    this.world = tell(this.world, [{ e: actor, a: "wearing", v: "nothing" }]);
    return `You take off ${this.name(id)}.`;
  }

  /** Read the words on a perceivable thing. */
  private read(actor: string, query: string): string {
    if (!query) return "Read what?";
    const id = this.resolve(query, [...this.around(actor).items, ...this.openContents(actor), ...contentsOf(this.world, actor)]);
    if (id === null) return `You don't see "${query}" here.`;
    const text = this.content.things[id]?.text;
    return text === undefined ? `There is nothing written on ${this.name(id)}.` : `${capitalize(this.name(id))} reads:\n${text}`;
  }

  // ── containers ───────────────────────────────────────────────────────────────

  /** The contents of every open container in the actor's room — reachable to take/read. */
  private openContents(actor: string): string[] {
    const room = this.here(actor);
    if (room === null) return [];
    const out: string[] = [];
    for (const id of contentsOf(this.world, room)) {
      if (this.tagsOf(id).includes("container") && valueOf(this.world, id, "open") === "true") {
        out.push(...contentsOf(this.world, id));
      }
    }
    return out;
  }

  /** Open or close a container in the room or your hands. */
  private setOpen(actor: string, query: string, open: boolean): string {
    if (!query) return open ? "Open what?" : "Close what?";
    const id = this.resolve(query, [...this.around(actor).items, ...contentsOf(this.world, actor)]);
    if (id === null) return `You don't see "${query}" here.`;
    if (this.tagsOf(id).includes("door")) {
      if (open && valueOf(this.world, id, "door-state") === "locked") return `${capitalize(this.name(id))} is locked — find its key and 'unlock' it.`;
      this.world = tell(this.world, [{ e: id, a: "door-state", v: open ? "open" : "closed" }]);
      return `You ${open ? "open" : "close"} ${this.name(id)}.`;
    }
    if (!this.tagsOf(id).includes("container")) return `${capitalize(this.name(id))} isn't something you can ${open ? "open" : "close"}.`;
    this.world = tell(this.world, [{ e: id, a: "open", v: open ? "true" : "false" }]);
    const inside = open ? contentsOf(this.world, id) : [];
    const reveal = inside.length ? ` Inside: ${inside.map((x) => this.name(x)).join(", ")}.` : open ? " It is empty." : "";
    return `You ${open ? "open" : "close"} ${this.name(id)}.${reveal}`;
  }

  // ── economy ────────────────────────────────────────────────────────────────

  /** The co-located shopkeeper NPC, if any. */
  private shopkeeper(actor: string): string | null {
    return this.around(actor).npcs.find((id) => this.tagsOf(id).includes("shop")) ?? null;
  }

  /** The ware types a shop sells (from its `sells:<type>` tags). */
  private sellsTypes(shop: string): string[] {
    return this.tagsOf(shop).filter((t) => t.startsWith("sells:")).map((t) => t.slice("sells:".length)).filter((id) => this.cat.wares[id] !== undefined);
  }

  /** The room tags of a shop's locale — what bends its regional price/stock baselines. */
  private shopLocaleTags(shop: string): readonly string[] {
    const room = placeOf(this.world, shop);
    return room === null ? [] : this.tagsOf(room);
  }

  /** A shop's regional price baseline for a ware (cheap at the good's source, dear away from it). */
  private localPriceBase(shop: string, type: string): number {
    return regionalPriceBase(this.cat.wares[type]!, this.shopLocaleTags(shop));
  }

  /** A shop's regional stock baseline for a ware (deep at the source, thin away). */
  private localStockBase(shop: string, type: string): number {
    return regionalStockBase(this.cat.wares[type]!, this.shopLocaleTags(shop));
  }

  /** The exact (unrounded) price a shop holds for a ware — its regional base plus demand pressure. */
  private warePriceRaw(shop: string, type: string): number {
    return numberOf(this.world, shop, `price:${type}`, this.localPriceBase(shop, type));
  }

  /** The price charged/shown for a ware — the raw price rounded, at least 1. */
  private warePrice(shop: string, type: string): number {
    return Math.max(1, Math.round(this.warePriceRaw(shop, type)));
  }

  /** What the Thought Cabinet reads off a character and the world to offer Thoughts. */
  private thoughtSignals(actor: string): ThoughtSignals {
    let topSkill = 0;
    for (const f of factsOf(this.world, actor)) if (f.a.startsWith("skill:")) topSkill = Math.max(topSkill, Number(f.v) || 0);
    return {
      season: seasonOf(this.world),
      seenContradiction: valueOf(this.world, actor, "seen-contradiction") === "true",
      topSkill,
      chapelStanding: standingOf(this.world, actor, "chapel"),
      marshStanding: standingOf(this.world, actor, "marsh"),
    };
  }

  /** The interior agent: advance each player's internalizing Thought; announce one that fixes. */
  private thoughtTick(events: SceneEvent[]): void {
    for (const player of this.players) {
      const { world, finished } = internalizeStep(this.world, player, this.lastTick);
      this.world = world;
      if (finished !== null) events.push({ k: "message", to: player, text: `A thought settles into you — ${finished.name}. ${finished.conclusion}` });
    }
  }

  /** The per-player snapshot the campaign's stages read off the world the player has changed. */
  private campaignView(actor: string): CampaignView {
    let topSkill = 0, faculties = 0;
    for (const f of factsOf(this.world, actor)) {
      if (f.a.startsWith("skill:")) topSkill = Math.max(topSkill, Number(f.v) || 0);
      if (f.a.startsWith("faculty:")) faculties = Math.max(faculties, Number(f.v) || 0);
    }
    const ownsBuilt = Object.keys(this.content.rooms).some((r) => valueOf(this.world, r, "owner") === actor);
    const permit = valueOf(this.world, "the-dredging-permit", "decision-status");
    let topStanding = 0;
    for (const fac of Object.keys(this.cat.factions)) topStanding = Math.max(topStanding, standingOf(this.world, actor, fac));
    const thoughtsFixed = THOUGHTS.filter((t) => thoughtIsFixed(this.world, actor, t.id)).length;
    return { coin: numberOf(this.world, actor, "coin", 0), topSkill, faculties, ownsBuilt, permitResolved: permit !== null && permit !== "contested", topStanding, thoughtsFixed };
  }

  /** The campaign agent: advance each player through any stages they've now met; announce each. */
  private campaignTick(events: SceneEvent[]): void {
    for (const player of this.players) {
      let idx = numberOf(this.world, player, "campaign:off-season", 0);
      const view = this.campaignView(player);
      let stage = stageAt(OFF_SEASON, idx);
      while (stage !== null && stage.done(view)) {
        idx += 1;
        this.world = tell(this.world, [
          { e: player, a: "campaign:off-season", v: String(idx) },
          { e: player, a: "coin", v: String(numberOf(this.world, player, "coin", 0) + stage.reward) },
        ]);
        const next = stageAt(OFF_SEASON, idx);
        events.push({ k: "message", to: player, text: `❖ ${OFF_SEASON.name} — "${stage.title}" complete (+${stage.reward} coin).${next === null ? " The campaign is won — you are a pillar of the harbor." : ` Next: ${next.title} — ${next.task}`}` });
        stage = next;
      }
    }
  }

  /** `pay` / `bounty` — settle your bounty with a Watch member standing here. */
  private payBountyCmd(actor: string): string {
    const watch = this.around(actor).npcs.find((id) => factionsOfTags(this.tagsOf(id)).includes("watch") && valueOf(this.world, id, "condition") !== "dead");
    if (watch === undefined) return "There is no one of the Watch here to answer to.";
    const { world, message } = payBounty(this.world, actor, this.cat.factions);
    this.world = world;
    return message;
  }

  /** An actor's standing with an entity, read off its factions (the worst, if it has several). */
  private dispositionTo(actor: string, entity: string): { standing: number; faction: string | null } {
    const facs = factionsOfTags(this.tagsOf(entity));
    if (facs.length === 0) return { standing: 0, faction: null };
    let faction = facs[0]!;
    let standing = standingOf(this.world, actor, faction);
    for (const f of facs) { const v = standingOf(this.world, actor, f); if (v < standing) { standing = v; faction = f; } }
    return { standing, faction };
  }

  /** The price an actor actually pays here — the board price bent by their standing with the shop. */
  private chargedPrice(actor: string, shop: string, type: string): number {
    return Math.max(1, Math.round(this.warePriceRaw(shop, type) * priceMultiplier(this.dispositionTo(actor, shop).standing)));
  }

  /** A shopkeeper's live offer board: each ware type's current price and stock. */
  private wares(actor: string): string {
    const shop = this.shopkeeper(actor);
    if (shop === null) return "There is no shop here.";
    const types = this.sellsTypes(shop);
    if (types.length === 0) return `${capitalize(this.name(shop))} has nothing for sale.`;
    const { standing, faction } = this.dispositionTo(actor, shop);
    const note = faction === null ? "" : ` — ${dispositionOf(standing)} toward you`;
    const lines = [`${capitalize(this.name(shop))} offers (prices move with trade${note}):`];
    if (!willTrade(standing)) return `${capitalize(this.name(shop))} looks you over and turns away — they'll not deal with the likes of you.`;
    for (const type of types) {
      const stock = Math.floor(numberOf(this.world, shop, `stock:${type}`, this.localStockBase(shop, type)));
      lines.push(`  ${this.cat.wares[type]!.name} — ${this.chargedPrice(actor, shop, type)} coin  (${stock} in stock)`);
    }
    lines.push(`You have ${numberOf(this.world, actor, "coin", 0)} coin.`);
    return lines.join("\n");
  }

  /** Register the content of a market-bought item from its ware type (also used on restore). */
  private registerMarketItem(id: string, type: string): void {
    const ware = this.cat.wares[type];
    if (ware === undefined) return;
    const things = this.content.things as Record<string, ThingContent>;
    things[id] = { id, name: ware.name, description: ware.description, location: undefined, tags: [...ware.tags], kind: "item", speech: undefined, evasive: false, text: undefined };
  }

  /** Buy a ware from a shop — the price rises with demand, the stock falls. */
  private buy(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    if (!query) return "Buy what?";
    const shop = this.shopkeeper(actor);
    if (shop === null) return "There is no shop here.";
    const q = query.trim().toLowerCase();
    const type = this.sellsTypes(shop).find((t) => t === q || this.cat.wares[t]!.name.toLowerCase().includes(q));
    if (type === undefined) return `${capitalize(this.name(shop))} isn't selling "${query}". (try 'wares')`;
    const stock = Math.floor(numberOf(this.world, shop, `stock:${type}`, this.localStockBase(shop, type)));
    if (stock <= 0) return `${capitalize(this.name(shop))} is out of ${this.cat.wares[type]!.name}.`;
    const { standing } = this.dispositionTo(actor, shop);
    if (!willTrade(standing)) return `${capitalize(this.name(shop))} won't sell to you — you've burned that bridge.`;
    const price = this.chargedPrice(actor, shop, type);
    const coin = numberOf(this.world, actor, "coin", 0);
    if (coin < price) return `You can't afford ${this.cat.wares[type]!.name} (${price} coin); you have ${coin}.`;
    const id = `${type}-m${this.spawned.length + 1}`;
    this.registerMarketItem(id, type);
    this.spawned.push({ kind: "market", id, type });
    this.world = tell(this.world, [
      { e: id, a: "located-in", v: actor },
      { e: actor, a: "coin", v: String(coin - price) },
      { e: shop, a: "coin", v: String(numberOf(this.world, shop, "coin", 0) + price) },
      { e: shop, a: `stock:${type}`, v: String(stock - 1) },
      { e: shop, a: `price:${type}`, v: String(Math.round(this.warePriceRaw(shop, type) * BUY_PRESSURE * 100) / 100) },
    ]);
    touch(actor, id, shop);
    return `You buy ${this.cat.wares[type]!.name} for ${price} coin. (${coin - price} left)`;
  }

  /** Sell to a shop — a catalog ware moves the price down; anything else fetches its value. */
  private sell(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    if (!query) return "Sell what?";
    const shop = this.shopkeeper(actor);
    if (shop === null) return "There is no shop here.";
    const id = this.resolve(query, contentsOf(this.world, actor));
    if (id === null) return `You aren't carrying "${query}".`;
    const shopCoin = numberOf(this.world, shop, "coin", 0);
    const type = wareTypeOfTags(this.tagsOf(id), this.cat.wares);
    let pay: number;
    if (type !== null) {
      pay = Math.max(1, Math.round(this.warePrice(shop, type) * SELL_RATIO));
      if (shopCoin < pay) return `${capitalize(this.name(shop))} can't afford ${this.name(id)} right now.`;
      this.world = tell(this.world, [
        { e: shop, a: `stock:${type}`, v: String(Math.floor(numberOf(this.world, shop, `stock:${type}`, this.localStockBase(shop, type))) + 1) },
        { e: shop, a: `price:${type}`, v: String(Math.round(this.warePriceRaw(shop, type) * SELL_PRESSURE * 100) / 100) },
      ]);
    } else {
      pay = numericTag(this.tagsOf(id), "value") ?? 0;
      if (pay <= 0) return `${capitalize(this.name(shop))} doesn't want ${this.name(id)}.`;
      if (shopCoin < pay) return `${capitalize(this.name(shop))} can't afford ${this.name(id)}.`;
    }
    this.world = engineGive(this.world, actor, id, shop);
    this.world = tell(this.world, [
      { e: actor, a: "coin", v: String(numberOf(this.world, actor, "coin", 0) + pay) },
      { e: shop, a: "coin", v: String(numberOf(this.world, shop, "coin", 0) - pay) },
    ]);
    touch(actor, id, shop);
    return `You sell ${this.name(id)} for ${pay} coin.`;
  }

  /** Each market tick, prices and stock ease back toward their baselines (mean reversion). */
  private marketTick(tick: number): void {
    for (const [id, thing] of Object.entries(this.content.things)) {
      if (thing.kind !== "npc" || !thing.tags.includes("shop") || tick % 5 !== id.length % 5) continue;
      const localTags = this.shopLocaleTags(id);
      for (const type of this.sellsTypes(id)) {
        const ware = this.cat.wares[type]!;
        // Mean-revert toward this shop's *regional* baseline, not a global one — so the fishing quay
        // and downtown hold persistently different fish prices, and a trader can run the difference.
        const priceBase = regionalPriceBase(ware, localTags);
        const stockBase = regionalStockBase(ware, localTags);
        const price = numberOf(this.world, id, `price:${type}`, priceBase);
        const stock = numberOf(this.world, id, `stock:${type}`, stockBase);
        this.world = tell(this.world, [
          { e: id, a: `price:${type}`, v: String(Math.round(easeToward(price, priceBase, 0.25) * 10) / 10) },
          { e: id, a: `stock:${type}`, v: String(Math.min(stockBase, Math.round(easeToward(stock, stockBase, 0.34)))) },
        ]);
      }
    }
  }

  /** Speak aloud: heard by every other actor in the room. */
  private say(actor: string, words: string, events: SceneEvent[]): string {
    if (!words) return "Say what?";
    const heard = `${this.name(actor)} says, "${words}"`;
    for (const other of this.audience(actor)) events.push({ k: "message", to: other, text: heard });
    return `You say, "${words}"`;
  }

  /** Act out something: a third-person line heard by everyone in the room, you included. */
  private emote(actor: string, action: string, events: SceneEvent[]): string {
    if (!action) return "Emote what?";
    const line = `${this.name(actor)} ${action}`;
    for (const other of this.audience(actor)) events.push({ k: "message", to: other, text: line });
    return line;
  }

  /** Speak privately to one co-located actor: `tell <who> <words>`. */
  private tell(actor: string, arg: string, events: SceneEvent[]): string {
    const [whoQuery, ...rest] = arg.split(/\s+/);
    const words = rest.join(" ");
    if (!whoQuery || !words) return "Tell whom what?";
    const who = this.resolve(whoQuery, [...this.audience(actor), ...this.around(actor).npcs]);
    if (who === null) return `There is no "${whoQuery}" here.`;
    if (this.players.has(who)) events.push({ k: "message", to: who, text: `${this.name(actor)} tells you, "${words}"` });
    return `You tell ${this.name(who)}, "${words}"`;
  }

  /** A soul emote — rendered to the actor, the room, and (when aimed) the target. */
  private performSoul(actor: string, verb: string, arg: string, events: SceneEvent[]): string {
    const def = this.cat.souls[verb]!;
    const actorName = capitalize(this.name(actor));
    if (arg.trim() !== "") {
      const target = this.resolve(arg, [...this.around(actor).npcs, ...this.audience(actor)]);
      if (target === null) return `There is no "${arg}" here to ${verb} at.`;
      const targetName = this.name(target);
      for (const other of this.audience(actor)) if (other !== target) events.push({ k: "message", to: other, text: fillSoul(def.roomAt, actorName, targetName) });
      if (this.players.has(target)) events.push({ k: "message", to: target, text: fillSoul(def.targetAt, actorName, targetName) });
      return fillSoul(def.selfAt, actorName, targetName);
    }
    for (const other of this.audience(actor)) events.push({ k: "message", to: other, text: fillSoul(def.room, actorName) });
    return fillSoul(def.self, actorName);
  }

  /** The global out-of-character chat channel — heard by every logged-in player. */
  private chat(actor: string, message: string, events: SceneEvent[]): string {
    if (message.trim() === "") return "Chat what?";
    const line = `[chat] ${capitalize(this.name(actor))}: ${message}`;
    for (const player of this.players) if (player !== actor) events.push({ k: "message", to: player, text: line });
    return line;
  }

  // ── conversation as a ludics cut (DESIGN §4.5) ─────────────────────────────

  /**
   * An NPC's conversation behaviour as a `@emsenn/gaming` ludics **design** — not a
   * script. A responsive NPC *receives* (an Opponent design at the root locus), so the
   * cut with the player's opening (a Proponent design) converges to the daimon — the
   * conversation lands. An evasive NPC *talks past you* (a Proponent design), so the
   * cut never collides into the daimon — the conversation provably gets stuck. The
   * landing is computed by `converges`, never read off a flag.
   */
  private conversationDesign(npc: string): Design {
    const rootKey = locusKey(root());
    const thing = this.content.things[npc];
    if (thing === undefined || thing.kind !== "npc") return daimon();
    return designFromActs(new Map([[rootKey, thing.evasive ? "proponent" : "opponent"]]));
  }

  /** Talk to a co-located NPC: a cut between the player's opening design and the NPC's. */
  private talk(actor: string, query: string, events: SceneEvent[]): string {
    if (!query) return "Talk to whom?";
    const npc = this.resolve(query, this.around(actor).npcs);
    if (npc === null) return `There is no "${query}" here to talk to.`;
    const opening = designFromActs(new Map([[locusKey(root()), "proponent"]]));
    if (!converges(opening, this.conversationDesign(npc))) {
      return `${capitalize(this.name(npc))} talks past you, lost in their own world; the conversation goes nowhere.`;
    }
    const line = this.content.things[npc]?.speech ?? "...";
    this.broadcastRoom(actor, `${this.name(actor)} speaks with ${this.name(npc)}.`, events, [npc]);
    const said = `${capitalize(this.name(npc))} turns to you. "${line}"`;
    // The Cabinet listens in: the player's faculties read the NPC beneath the words (DESIGN §4.5
    // is the cut; this is who hears it). Only the player's own mind, seeded for exact replay.
    if (this.players.has(actor)) {
      const whispers = dialogueLines(this.world, actor, this.dialogueView(npc), worldSeed(this.world), worldTime(this.world));
      this.world = practise(this.world, actor, "conversation"); // talking is itself a skill (Gorgon)
      if (whispers.length) {
        for (const key of new Set(whispers.map((w) => w.faculty))) this.world = practiseFaculty(this.world, actor, key);
        return [said, "", ...whispers.map(renderWhisper)].join("\n");
      }
    }
    return said;
  }

  /**
   * `regard` / `commune` — read the interiority of *any* entity (person, creature, object, room).
   * Agential realism: everything is a fiber, so everything has an inner life; the agential cut is
   * enacted here — you read it only as far as your own faculties reach. Regarding keens the senses.
   */
  private regard(actor: string, query: string): string {
    if (!query) return "Regard what? (anyone or anything here — even the room, even a blade)";
    const self = bodyOf(this.world, actor);
    const here = this.here(self);
    const candidates = [...new Set([here ?? "", ...this.around(self).items, ...this.around(self).npcs, ...contentsOf(this.world, self)])].filter(Boolean);
    const target = this.resolve(query, candidates) ?? (query.trim().toLowerCase() === "me" || query.trim().toLowerCase() === "self" ? self : null);
    if (target === null) return `There is no "${query}" here to regard.`;
    const view = this.regardView(target);
    if (view.beliefs.length > 0 && this.players.has(actor) && valueOf(this.world, actor, "seen-contradiction") !== "true") this.world = tell(this.world, [{ e: actor, a: "seen-contradiction", v: "true" }]);
    const whispers = regardLines(this.world, actor, view, worldSeed(this.world), worldTime(this.world));
    // Regarding another is itself an exercise of the inward senses.
    if (this.players.has(actor)) { this.world = practiseFaculty(this.world, actor, "empathy"); this.world = practiseFaculty(this.world, actor, "inland-empire"); }
    if (whispers.length === 0) return `You regard ${this.name(target)}, but your senses are too dull to read its inner life. (train your faculties)`;
    return [`You attend closely to ${this.name(target)}:`, "", ...whispers.map(renderWhisper)].join("\n");
  }

  /** Assemble the interiority lens over any entity — mood, need, ⊤ beliefs, intra-action marks, keenness. */
  private regardView(id: string): RegardView {
    const isNpc = this.content.things[id]?.kind === "npc";
    const needs: [string, number][] = [["hunger", numberOf(this.world, id, "need:hunger", 0)], ["rest", numberOf(this.world, id, "need:rest", 0)], ["company", numberOf(this.world, id, "need:company", 0)]];
    const top = needs.reduce((a, b) => (b[1] > a[1] ? b : a), ["", 0] as [string, number]);
    const beliefs: string[] = [];
    const marks: string[] = [];
    for (const f of factsOf(this.world, id)) {
      if (f.a.startsWith("belief:") && f.v === "stable") beliefs.push(f.a.slice("belief:".length));
      if (f.a === "entangled") { const k = f.v.slice(0, f.v.indexOf(":")); if (k) marks.push(k); }
    }
    // The entity's own sharpest faculty (it perceives, too) — named when notably keen.
    let keen: { name: string; level: number } | null = null;
    for (const fac of FACULTIES) { const l = facultyLevel(this.world, id, fac.key); if (l >= 8 && (keen === null || l > keen.level)) keen = { name: fac.name, level: l }; }
    return {
      name: this.name(id),
      kind: this.content.things[id]?.kind ?? (this.content.rooms[id] !== undefined ? "room" : "thing"),
      mood: valueOf(this.world, id, "mood") ?? (isNpc ? moodOf(this.world, id) : null),
      topNeed: top[1] >= 8 ? top[0] : null,
      beliefs,
      entanglements: marks,
      keenFaculty: keen?.name ?? null,
    };
  }

  /** Assemble the conversation lens over an NPC — its mood, pressing need, demand, and any ⊤ belief. */
  private dialogueView(npc: string): DialogueView {
    const needs: [string, number][] = [["hunger", numberOf(this.world, npc, "need:hunger", 0)], ["rest", numberOf(this.world, npc, "need:rest", 0)], ["company", numberOf(this.world, npc, "need:company", 0)]];
    const top = needs.reduce((a, b) => (b[1] > a[1] ? b : a), ["", 0] as [string, number]);
    const wants = valueOf(this.world, npc, "wants");
    const contested = factsOf(this.world, npc).some((f) => f.a.startsWith("belief:") && f.v === "stable");
    return {
      name: this.name(npc),
      mood: valueOf(this.world, npc, "mood") ?? (this.content.things[npc]?.kind === "npc" ? moodOf(this.world, npc) : null),
      topNeed: top[1] >= 8 ? top[0] : null,
      wants: wants === null || wants === "" ? null : wants,
      contestedBelief: contested,
    };
  }

  // ── ships and sailing ─────────────────────────────────────────────────────

  /** The players currently in any of a ship's rooms. */
  private aboard(ship: string): string[] {
    const out: string[] = [];
    for (const room of this.content.ships[ship]?.rooms ?? []) {
      for (const occ of contentsOf(this.world, room)) if (this.players.has(occ)) out.push(occ);
    }
    return out;
  }

  /** The navigable sea lanes leading off an ocean cell or dock. */
  private seaLanes(pos: string): string {
    const lanes = Object.entries(this.content.rooms[pos]?.exits ?? {}).filter(
      ([, dest]) => isOcean(this.content, dest) || isDock(this.content, dest),
    );
    if (!lanes.length) return "There are no sea lanes from here.";
    return `Sea lanes: ${lanes.map(([dir, dest]) => `${dir} (${this.name(dest)})`).join(", ")}.`;
  }

  /** The view across the water from a cell — the cell, its lanes, and other ships on it. */
  private waterView(pos: string, ship: string | null): string {
    const room = this.content.rooms[pos];
    const lines = [`On the water: ${room?.name ?? pos}`, room?.description ?? "", this.seaLanes(pos)];
    for (const other of shipsAt(this.world, this.content, pos)) {
      if (other !== ship) lines.push(`  ${this.name(other)} rides the swell nearby.`);
    }
    return lines.filter(Boolean).join("\n");
  }

  /** Look out over the sea — from a ship's deck or a dock. */
  private scan(actor: string): string {
    const ship = aboardShip(this.world, actor);
    if (ship !== null) {
      const pos = shipPosition(this.world, ship);
      return pos === null ? "Only void surrounds the ship." : this.waterView(pos, ship);
    }
    const place = this.here(actor);
    if (place !== null && isDock(this.content, place)) return this.waterView(place, null);
    return "There is no sea in sight to scan.";
  }

  /** List the ships floating where the actor stands. */
  private shipsHere(actor: string): string {
    const place = this.here(actor);
    if (place === null) return "You are nowhere.";
    const here = shipsAt(this.world, this.content, place);
    if (!here.length) return "There are no ships here.";
    return ["Ships here:", ...here.map((id) => `  ${this.name(id)} — a ${valueOf(this.world, id, "class") ?? "vessel"}`)].join("\n");
  }

  /** Climb aboard a ship floating where you stand. */
  private board(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    const place = this.here(actor);
    if (place === null) return "You are nowhere to board from.";
    const here = shipsAt(this.world, this.content, place);
    if (!here.length) return "There is no ship here to board.";
    const id = query ? this.resolve(query, here) : here[0] ?? null;
    if (id === null) return `There is no ship "${query}" here.`;
    const deck = this.content.ships[id]?.deckRoom;
    if (deck === undefined) return `You can't find a way aboard ${this.name(id)}.`;
    this.world = engineGo(this.world, actor, deck);
    touch(actor, place, deck);
    return `You climb aboard ${this.name(id)}.\n${this.describe(actor)}`;
  }

  /** Step ashore from a ship — only possible when it is at a dock, not in open water. */
  private disembark(actor: string, touch: (...ids: (string | null)[]) => void): string {
    const ship = aboardShip(this.world, actor);
    if (ship === null) return "You aren't aboard a ship.";
    const pos = shipPosition(this.world, ship);
    if (pos === null) return "The ship is nowhere — there is nothing to step onto.";
    if (isOcean(this.content, pos)) return "You'd have to swim for it — bring the ship to a dock first.";
    const room = this.here(actor);
    this.world = engineGo(this.world, actor, pos);
    touch(actor, room, pos);
    return `You step off ${this.name(ship)} onto ${this.name(pos)}.\n${this.describe(actor)}`;
  }

  /** Steer the ship from its helm — one functional move that carries everyone aboard. */
  private sail(actor: string, query: string, touch: (...ids: (string | null)[]) => void, events: SceneEvent[]): string {
    const room = this.here(actor);
    const ship = aboardShip(this.world, actor);
    if (ship === null || room === null) return "You aren't aboard a ship.";
    if (!isHelm(this.content, room)) return "You must be at the helm to steer.";
    if (!this.canCommand(actor, ship)) return `${capitalize(this.name(ship))} isn't yours to command — rent or buy her first.`;
    const pos = shipPosition(this.world, ship);
    if (pos === null) return "The ship is adrift in the void.";
    if (!query) return `Sail which way? ${this.seaLanes(pos)}`;
    const dir = DIRECTIONS[query.toLowerCase()] ?? query.toLowerCase();
    const dest = this.content.rooms[pos]?.exits?.[dir];
    if (dest === undefined) return `There is no sea lane ${dir} from here. ${this.seaLanes(pos)}`;
    if (!isOcean(this.content, dest) && !isDock(this.content, dest)) return `You can't sail ${dir} — ${this.name(dest)} is not navigable water.`;
    this.world = engineGo(this.world, ship, dest);
    this.world = practise(this.world, actor, "sailing");
    touch(ship, pos, dest);
    for (const occ of this.aboard(ship)) if (occ !== actor) events.push({ k: "message", to: occ, text: `${capitalize(this.name(ship))} comes about and sails ${dir}.` });
    return `You bring ${this.name(ship)} ${dir}.\n${this.waterView(dest, ship)}`;
  }

  /**
   * Give a ship standing orders in the relational Lisp — `program <ship> <code>`. The
   * code is stored as the ship's `autopilot` fact and run every tick (see
   * `autopilotTurn`). Empty code clears her orders. Bad syntax is refused up front.
   */
  private program(actor: string, arg: string): string {
    const space = arg.indexOf(" ");
    const shipQuery = space === -1 ? arg : arg.slice(0, space);
    const code = space === -1 ? "" : arg.slice(space + 1).trim();
    const aboard = aboardShip(this.world, actor);
    const place = this.here(actor);
    const candidates = [...(aboard === null ? [] : [aboard]), ...(place === null ? [] : shipsAt(this.world, this.content, place))];
    const ship = this.resolve(shipQuery, candidates);
    if (ship === null) return `There is no ship "${shipQuery}" to program here.`;
    if (!this.canCommand(actor, ship)) return `${capitalize(this.name(ship))} isn't yours to program — rent or buy her first.`;
    if (code === "") {
      this.world = tell(this.world, [{ e: ship, a: "autopilot", v: "nothing" }]);
      return `You strike ${this.name(ship)}'s standing orders. She'll drift until told otherwise.`;
    }
    try {
      readLisp(code);
    } catch (error) {
      return `${capitalize(this.name(ship))}'s logic-engine balks: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.world = tell(this.world, [{ e: ship, a: "autopilot", v: code }]);
    return `You inscribe ${this.name(ship)}'s standing orders:\n  ${code}`;
  }

  // ── ocean ecology and at-sea industry (Eco) ───────────────────────────────

  /** The ocean cell an actor surveys — their ship's position, or the dock they stand on. */
  private oceanCellOf(actor: string): string | null {
    const ship = aboardShip(this.world, actor);
    if (ship !== null) {
      const pos = shipPosition(this.world, ship);
      return pos !== null && isOcean(this.content, pos) ? pos : null;
    }
    const place = this.here(actor);
    return place !== null && isOcean(this.content, place) ? place : null;
  }

  /** Read the ecological state of the surrounding waters — and the whole region they form. */
  private survey(actor: string): string {
    const cell = this.oceanCellOf(actor);
    if (cell === null) return "You can only survey the ocean from on the water.";
    let report = ecologyReport(this.world, cell);
    // The region's health is FORMED from its cells by the knowledge-join (inverse-limit):
    // some thriving, some dead → the whole reads `stable`, contested.
    const region = valueOf(this.world, cell, "part-of");
    if (region !== null) {
      const folded = aggregateCharge(this.world, region, "ecology");
      const word = folded === "potential" ? "healthy" : folded === "active" ? "in decline" : folded === "stable" ? "torn — some waters thrive while others die" : "unknown";
      report += `\nAcross ${this.name(region)} entire, the sea reads ${word}.`;
    }
    return report;
  }

  /** The number of supporters needed to enact a law — a majority of those abroad. */
  private quorum(): number {
    return Math.max(1, Math.ceil(this.players.size / 2));
  }

  /** Propose a commons law — a pollution cap or fishing quota — for the harbor to back. */
  private propose(actor: string, arg: string, events: SceneEvent[]): string {
    const [name, valueText] = arg.split(/\s+/);
    if (name === undefined || !isLaw(name, this.cat.laws)) return `Propose what? Laws: ${this.cat.laws.join(", ")} — e.g. 'propose pollution-cap 8'.`;
    const value = Number(valueText);
    if (!Number.isFinite(value) || value < 0) return `Propose a number, e.g. 'propose ${name} 8'.`;
    this.world = propose(this.world, name, value);
    this.world = support(this.world, name, actor); // the proposer backs their own motion
    const line = `${capitalize(this.name(actor))} proposes a ${name.replace("-", " ")} of ${value}. Say 'support ${name}' to back it (${supporterCount(this.world, name)}/${this.quorum()}).`;
    for (const player of this.players) if (player !== actor) events.push({ k: "message", to: player, text: line });
    return this.maybeEnact(name, events) ?? line;
  }

  /** Back a pending proposal; if it reaches quorum, it becomes law for all. */
  private support(actor: string, arg: string, events: SceneEvent[]): string {
    const name = arg.trim();
    if (!isLaw(name, this.cat.laws)) return `Support which law? ${this.cat.laws.join(", ")}.`;
    if (proposalValue(this.world, name) === null) return `There is no ${name.replace("-", " ")} proposed right now.`;
    this.world = support(this.world, name, actor);
    const enacted = this.maybeEnact(name, events);
    if (enacted !== null) return enacted;
    const line = `${capitalize(this.name(actor))} backs the ${name.replace("-", " ")} (${supporterCount(this.world, name)}/${this.quorum()}).`;
    for (const player of this.players) if (player !== actor) events.push({ k: "message", to: player, text: line });
    return `You back the ${name.replace("-", " ")} (${supporterCount(this.world, name)}/${this.quorum()}).`;
  }

  /** Enact a proposal if it has reached quorum, announcing it to all; else null. */
  private maybeEnact(law: Law, events: SceneEvent[]): string | null {
    if (supporterCount(this.world, law) < this.quorum()) return null;
    const value = proposalValue(this.world, law);
    this.world = enact(this.world, law);
    const line = `⚖ The harbor enacts a ${law.replace("-", " ")} of ${value}. It is now the law of the commons.`;
    for (const player of this.players) events.push({ k: "message", to: player, text: line });
    return line;
  }

  /** The current laws and any pending proposals on the commons. */
  private laws(): string {
    const lines = ["The commons:"];
    for (const law of this.cat.laws) {
      const enacted = lawValue(this.world, law);
      const pending = proposalValue(this.world, law);
      lines.push(`  ${law.replace("-", " ")}: ${enacted === null ? "none in force" : String(enacted)}${pending === null ? "" : ` (proposed: ${pending}, ${supporterCount(this.world, law)}/${this.quorum()})`}`);
    }
    return lines.join("\n");
  }

  /**
   * Rig a ship for at-sea industry (a trawler). Industry exists ONLY at sea — never on
   * Farstone island. The trawler hauls fish as she sails, but the catch fouls the water:
   * profit and pollution are the same act, and the polluted sea is everyone's.
   */
  private industrialize(actor: string, arg: string, touch: (...ids: (string | null)[]) => void): string {
    const ship = aboardShip(this.world, actor);
    if (ship === null) return "You can only build industry aboard a ship, out at sea.";
    if (!this.canCommand(actor, ship)) return `${capitalize(this.name(ship))} isn't yours to rig.`;
    const cell = shipPosition(this.world, ship);
    if (cell === null || !isOcean(this.content, cell)) return "You must be out on the open water to rig industry — never in harbor, never ashore.";
    const kind = arg.trim().toLowerCase() === "off" || arg.trim().toLowerCase() === "stop" ? "nothing" : "trawler";
    this.world = tell(this.world, [{ e: ship, a: "industry", v: kind }]);
    touch(ship);
    return kind === "nothing"
      ? `You strike ${this.name(ship)}'s rig. She fishes no more.`
      : `You rig ${this.name(ship)} as a trawler. She'll haul the deep as she sails — but the sea will pay for it.`;
  }

  /** Each tick, rigged ships at sea haul fish (coin to the owner) and foul their cell. */
  private industryTick(dirty: Set<string>, events: SceneEvent[]): void {
    for (const ship of Object.keys(this.content.ships)) {
      if (valueOf(this.world, ship, "industry") !== "trawler") continue;
      const cell = shipPosition(this.world, ship);
      if (cell === null || !isOcean(this.content, cell)) continue;
      const owner = valueOf(this.world, ship, "owner");
      const cap = lawValue(this.world, "pollution-cap");
      const overCap = cap !== null && pollutionOf(this.world, cell) >= cap;
      if (overCap) {
        // The commons has spoken: industry past the cap is fined and throttled — no more
        // pollution this tick, and the owner pays the penalty.
        if (owner !== null && owner !== "nothing") this.world = tell(this.world, [{ e: owner, a: "coin", v: String(Math.max(0, numberOf(this.world, owner, "coin", 0) - 5)) }]);
        dirty.add(ship);
        for (const occ of this.aboard(ship)) events.push({ k: "message", to: occ, text: `The trawler is idled — the waters here are over the pollution cap, and the harbor fines you 5 coin.` });
        continue;
      }
      const { world: drawn, caught } = drawFish(this.world, cell, 2);
      this.world = drawn;
      this.world = emitPollution(this.world, cell, 2);
      dirty.add(cell);
      dirty.add(ship);
      if (caught > 0 && owner !== null && owner !== "nothing") {
        this.world = tell(this.world, [{ e: owner, a: "coin", v: String(numberOf(this.world, owner, "coin", 0) + caught * 2) }]);
      }
      for (const occ of this.aboard(ship)) events.push({ k: "message", to: occ, text: caught > 0 ? `The trawler hauls ${caught} fish aboard; an oily sheen spreads on the swell.` : `The trawler's nets come up empty — the waters here are fished out.` });
    }
  }

  /** Advance the world clock; when a new phase dawns, NPCs keep their routines. */
  private clockAndRoutines(dirty: Set<string>, events: SceneEvent[]): void {
    const crossing = phaseChangesAt(this.world);
    this.world = advanceClock(this.world, this.game.weather);
    dirty.add("the-world");
    if (!crossing) return;
    const phase = phaseOf(this.world);
    for (const [id, thing] of Object.entries(this.content.things)) {
      if (thing.kind !== "npc" || valueOf(this.world, id, "condition") === "dead") continue;
      const tag = thing.tags.find((t) => t.startsWith(`routine:${phase}:`));
      if (tag === undefined) continue;
      const dest = tag.slice(`routine:${phase}:`.length);
      const cur = placeOf(this.world, id);
      if (cur === dest || this.content.rooms[dest] === undefined) continue;
      this.world = engineGo(this.world, id, dest);
      dirty.add(id);
      if (cur !== null) dirty.add(cur);
      dirty.add(dest);
      for (const occ of contentsOf(this.world, dest)) if (this.players.has(occ) && occ !== id) events.push({ k: "message", to: occ, text: `${capitalize(this.name(id))} arrives.` });
      for (const occ of cur === null ? [] : contentsOf(this.world, cur)) if (this.players.has(occ)) events.push({ k: "message", to: occ, text: `${capitalize(this.name(id))} departs.` });
    }
  }

  /** Each tick, the ocean lives: every ocean cell's fish grow, pollution decays, health settles. */
  private ecologyTick(tick: number): void {
    const eco = this.game.ecology;
    if (eco === undefined) return; // ecology is a game-declared system, not an engine default
    for (const [roomId, room] of Object.entries(this.content.rooms)) {
      if (!room.tags.includes(eco.tag)) continue;
      if (tick % 3 !== roomId.length % 3) continue;
      this.world = ecologyStep(this.world, roomId);
    }
  }

  private readonly fieldGraphs = new Map<string, WorldGraph>();
  /** The connectivity sub-graph a field diffuses over — built once, its exact Laplacian cached. */
  private fieldGraph(spec: FieldSpec): WorldGraph {
    let g = this.fieldGraphs.get(spec.name);
    if (g !== undefined) return g;
    const adjacency: Record<string, string[]> = {};
    for (const [roomId, room] of Object.entries(this.content.rooms)) {
      if (!room.tags.includes(spec.overTag)) continue;
      adjacency[roomId] = Object.values(room.exits).filter((d) => this.content.rooms[d]?.tags.includes(spec.overTag));
    }
    g = worldGraph(adjacency);
    this.fieldGraphs.set(spec.name, g);
    return g;
  }

  /**
   * The field agent: every scalar field the game declares diffuses one step across its
   * sub-graph by the exact graph-Laplacian heat flow (`@emsenn/fizzos/fields`). A field flows
   * from full rooms to empty neighbours, conserving its total. The engine knows nothing of
   * what a field *means* — pollution, scent, heat — only that the game declared it.
   */
  private diffuseFields(): void {
    for (const spec of this.game.fields ?? []) {
      const wg = this.fieldGraph(spec);
      if (wg.roomIds.length < 2) continue;
      const field: Record<string, number> = {};
      for (const id of wg.roomIds) field[id] = numberOf(this.world, id, spec.predicate, 0);
      const next = diffuse(wg, field, spec.rate);
      const facts = wg.roomIds
        .filter((id) => Math.abs((next[id] ?? 0) - field[id]!) > 1e-4)
        .map((id) => ({ e: id, a: spec.predicate, v: String(Math.round((next[id] ?? 0) * 100) / 100) }));
      if (facts.length > 0) this.world = tell(this.world, facts);
    }
  }

  // ── in-world Lisp: spells & automations ────────────────────────────────────

  /** Inscribe a named spell — a relational-Lisp program the caster can later invoke. */
  private defineSpell(actor: string, arg: string): string {
    const space = arg.indexOf(" ");
    const name = (space === -1 ? arg : arg.slice(0, space)).trim().toLowerCase();
    const code = space === -1 ? "" : arg.slice(space + 1).trim();
    if (name === "") return "Define what? Usage: define <name> <lisp>, e.g. 'define recall (move self the-jetty)'.";
    if (code === "") {
      this.world = tell(this.world, [{ e: actor, a: `spell:${name}`, v: "" }]);
      return `You unlearn the spell '${name}'.`;
    }
    try {
      readLisp(code);
    } catch (error) {
      return `That incantation won't parse: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.world = tell(this.world, [{ e: actor, a: `spell:${name}`, v: code }]);
    return `You inscribe the spell '${name}'. Cast it with 'cast ${name}'.`;
  }

  /** Cast a known spell: run its program against the world as the caster; trains magic. */
  private castSpell(actor: string, arg: string, events: SceneEvent[]): string {
    const name = arg.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const code = valueOf(this.world, actor, `spell:${name}`);
    if (code === null || code === "") return `You know no spell '${name}'. ('spells' lists yours.)`;
    try {
      const { world, log } = runProgram(code, this.world, actor, this.content);
      this.world = world;
      this.world = practise(this.world, actor, "magic");
      for (const line of log) events.push({ k: "message", to: actor, text: `✶ ${line}` });
      return `You cast '${name}'.`;
    } catch (error) {
      return `The spell '${name}' fizzles: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /** The spells an actor has inscribed. */
  private spellbook(actor: string): string {
    const names: string[] = [];
    for (const fact of perceive(this.world, actor).facts) {
      if (fact.e === actor && fact.a.startsWith("spell:") && fact.v !== "" && fact.charge === "potential") names.push(fact.a.slice("spell:".length));
    }
    return names.length === 0 ? "Your spellbook is empty. 'define <name> <lisp>' to inscribe one." : `Spells: ${names.sort().join(", ")}.`;
  }

  /** Set a standing automation — a Lisp program run for you each tick (a personal trigger). */
  private automate(actor: string, code: string): string {
    if (code.trim() === "") return "Automate what? Usage: automate <lisp> — runs each tick. 'unautomate' to stop.";
    try {
      readLisp(code);
    } catch (error) {
      return `That won't parse: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.world = tell(this.world, [{ e: actor, a: "automation", v: code.trim() }]);
    return "Your standing automation is set; it runs each tick. 'unautomate' to stop.";
  }

  private unautomate(actor: string): string {
    this.world = tell(this.world, [{ e: actor, a: "automation", v: "" }]);
    return "Your automation is cleared.";
  }

  /** Each tick, run every player's standing automation against the world. */
  private automationTick(events: SceneEvent[]): void {
    for (const actor of this.players) {
      const code = valueOf(this.world, actor, "automation");
      if (code === null || code === "") continue;
      try {
        const { world, log } = runProgram(code, this.world, actor, this.content);
        this.world = world;
        for (const line of log) events.push({ k: "message", to: actor, text: `⟳ ${line}` });
      } catch { /* a faulty automation is inert this tick, never fatal */ }
    }
  }

  /** Whether an actor may steer a ship: its owner, or its current renter. */
  private canCommand(actor: string, ship: string): boolean {
    return valueOf(this.world, ship, "owner") === actor || valueOf(this.world, ship, "rented-by") === actor;
  }

  /** Reconstruct the content of one spawned thing from its record (apply + restore). */
  private realizeSpawn(record: SpawnRecord): void {
    switch (record.kind) {
      case "ship": this.registerShip(record.id, record.klass); break;
      case "craft": this.registerCrafted(record.id, record.recipe, record.quality); break;
      case "harvest": this.registerHarvested(record.id, record.resource); break;
      case "market": this.registerMarketItem(record.id, record.type); break;
      case "cured": this.registerCured(record.id); break;
    }
  }

  /** Register a cured (smoked) fish — preserved food that keeps and trades dearer than fresh. */
  private registerCured(id: string): void {
    const things = this.content.things as Record<string, ThingContent>;
    things[id] = { id, name: "a smoked fish", description: "A fish cured hard over alder smoke; it keeps through the lean months and trades dear — the off-season's larder.", location: undefined, tags: ["item", "takeable", "edible", "nutrition:6", "preserved", "value:8"], kind: "item", speech: undefined, evasive: false, text: undefined };
  }

  /** `cure` / `smoke` — at a smokehouse or forge, turn a fresh fish into preserved smoked fish. */
  private cure(actor: string): string {
    const room = this.here(actor);
    if (room === null || !this.tagsOf(room).some((t) => t === "smokehouse" || t === "forge" || t === "craft")) {
      return "You need a smokehouse to cure fish. Build one: 'construct smokehouse <direction>'.";
    }
    const fish = contentsOf(this.world, actor).find((id) => this.tagsOf(id).includes("fish") && this.tagsOf(id).includes("edible") && !this.tagsOf(id).includes("preserved"));
    if (fish === undefined) return "You have no fresh fish to cure.";
    this.world = tell(this.world, [{ e: fish, a: "located-in", v: "nothing" }]); // the fresh fish is consumed
    const id = `cured-${this.spawned.length + 1}`;
    this.registerCured(id);
    this.spawned.push({ kind: "cured", id });
    this.world = tell(this.world, [{ e: id, a: "located-in", v: actor }]);
    this.world = practise(this.world, actor, "cooking");
    return "You smoke the fish over the slow alder fire. It keeps now — smoked fish, worth more than fresh, and proof against the lean months.";
  }

  /** Register the content of a harvested raw material (also used on restore). */
  private registerHarvested(id: string, resource: string): void {
    const node = this.cat.resources[resource];
    if (node === undefined) return;
    const things = this.content.things as Record<string, ThingContent>;
    things[id] = { id, name: node.item.name, description: node.item.description, location: undefined, tags: [...node.item.tags], kind: "item", speech: undefined, evasive: false, text: undefined };
  }

  /** Gather a resource from a node in this room — depletes the node, trains the skill. */
  private gather(actor: string, resource: string, touch: (...ids: (string | null)[]) => void): string {
    const node = this.cat.resources[resource];
    if (node === undefined) return `You can't gather "${resource}". Try: ${Object.keys(this.cat.resources).join(", ")}.`;
    const room = this.here(actor);
    if (room === null || !this.tagsOf(room).includes(`node:${resource}`)) return `There is no ${resource} to gather here.`;
    // Fish draw from the cell's LIVING ecological stock — overfish it and it collapses.
    if (resource === "fish") {
      if (isFoul(weatherOf(this.world)) && rngFor(worldSeed(this.world), worldTime(this.world), hashStr(actor)) < 0.5) return "The foul weather drives the fish deep — you cast in vain.";
      const { world: drawn, caught } = drawFish(this.world, room, 1);
      if (caught <= 0) return "The waters here are fished out — let the stock recover.";
      this.world = drawn;
    } else {
      const remaining = numberOf(this.world, room, `yield:${resource}`, node.max);
      if (remaining <= 0) return `The ${resource} here is worked out — give it time to recover.`;
      this.world = tell(this.world, [{ e: room, a: `yield:${resource}`, v: String(remaining - 1) }]);
    }
    const id = `${resource}-${this.spawned.length + 1}`;
    this.registerHarvested(id, resource);
    this.spawned.push({ kind: "harvest", id, resource });
    this.world = tell(this.world, [{ e: id, a: "located-in", v: actor }]);
    this.world = practise(this.world, actor, node.skill);
    touch(actor, id, room);
    const left = resource === "fish" ? `${fishStock(this.world, room)} fish left here` : `${numberOf(this.world, room, `yield:${resource}`, node.max)} left here`;
    return `You gather ${this.name(id)}. (${left})`;
  }

  /** Regrow depleted resource nodes a unit at a time, on each node's own cadence. */
  private regrowNodes(tick: number): void {
    for (const [roomId, room] of Object.entries(this.content.rooms)) {
      for (const tag of room.tags) {
        if (!tag.startsWith("node:")) continue;
        const resource = tag.slice("node:".length);
        const node = this.cat.resources[resource];
        if (node === undefined || tick % node.regrowEvery !== roomId.length % node.regrowEvery) continue;
        const current = numberOf(this.world, roomId, `yield:${resource}`, node.max);
        if (current < node.max) this.world = tell(this.world, [{ e: roomId, a: `yield:${resource}`, v: String(current + 1) }]);
      }
    }
  }

  /** Register the content of a crafted item from its recipe + quality (also used on restore). */
  private registerCrafted(id: string, recipeName: string, quality: number): void {
    const recipe = this.cat.recipes[recipeName];
    if (recipe === undefined) return;
    const things = this.content.things as Record<string, ThingContent>;
    things[id] = {
      id,
      name: recipe.output.name,
      description: recipe.output.description,
      location: undefined,
      tags: [...recipe.output.tags, `quality:${quality}`],
      kind: "item",
      speech: undefined,
      evasive: false,
      text: undefined,
    };
  }

  /** Craft an item: consume the inputs (linear A⊗B⊸C), produce the good, train the skill. */
  private craft(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    const recipe = this.cat.recipes[query.trim().toLowerCase()];
    if (recipe === undefined) return `You don't know how to craft "${query}". Recipes: ${Object.keys(this.cat.recipes).join(", ")}.`;
    const place = this.here(actor);
    if (recipe.station !== undefined && (place === null || !this.tagsOf(place).includes(recipe.station))) {
      return `You need a ${recipe.station} to craft ${recipe.name}.`;
    }
    const inventory = contentsOf(this.world, actor);
    if (recipe.tool !== undefined && !inventory.some((id) => this.tagsOf(id).includes(recipe.tool!))) {
      return `You need a ${recipe.tool} in hand to craft ${recipe.name}.`;
    }
    const consume: string[] = [];
    for (const input of recipe.inputs) {
      const matches = inventory.filter((id) => this.tagsOf(id).includes(input.tag) && !consume.includes(id));
      if (matches.length < input.count) return `Crafting ${recipe.name} needs ${input.count} ${input.tag}; you have ${matches.length}.`;
      consume.push(...matches.slice(0, input.count));
    }
    const quality = 5 + Math.round(skillBonus(this.world, actor, recipe.skill) * 20);
    const id = `${recipe.output.id}-${this.spawned.length + 1}`;
    this.registerCrafted(id, recipe.name, quality);
    this.spawned.push({ kind: "craft", id, recipe: recipe.name, quality });
    this.world = tell(this.world, [
      { e: id, a: "located-in", v: actor },
      // the inputs are used up — linearity, enforced by the same conservation as everything else.
      ...consume.map((c) => ({ e: c, a: "located-in", v: "consumed" })),
    ]);
    this.world = practise(this.world, actor, recipe.skill);
    this.world = awardXp(this.world, actor, 3).world;
    touch(actor, id);
    return `You craft ${this.name(id)} — quality ${quality}.`;
  }

  /** Award build XP — kept tiny here; the real reward is the hull. */
  private buildXp(actor: string): void {
    this.world = awardXp(this.world, actor, 20).world;
  }

  /** Lay down the content (rooms, ship record) of a built ship from its class template. */
  private registerShip(shipId: string, klass: string): void {
    const tmpl = this.cat.shipClasses[klass];
    if (tmpl === undefined) return;
    const rooms = this.content.rooms as Record<string, RoomContent>;
    const ships = this.content.ships as Record<string, ShipContent>;
    const things = this.content.things as Record<string, ThingContent>;
    const roomIds: string[] = [];
    let deckRoom: string | undefined;
    let helmRoom: string | undefined;
    for (const room of tmpl.rooms) {
      const rid = `${shipId}-${room.suffix}`;
      const exits: Record<string, string> = {};
      for (const [dir, sfx] of Object.entries(room.exits ?? {})) exits[dir] = `${shipId}-${sfx}`;
      rooms[rid] = {
        id: rid,
        name: room.name,
        description: room.description,
        exits,
        tags: ["place", "ship-room", ...(room.deck ? ["deck"] : []), ...(room.helm ? ["helm"] : [])],
      };
      roomIds.push(rid);
      if (room.deck) deckRoom = rid;
      if (room.helm) helmRoom = rid;
    }
    const name = `a ${klass}`;
    things[shipId] = { id: shipId, name, description: `A ${klass}, freshly built.`, location: undefined, tags: ["ship", `class:${klass}`], kind: "vessel", speech: undefined, evasive: false, text: undefined };
    ships[shipId] = { id: shipId, name, class: klass, deckRoom, helmRoom, rooms: roomIds, price: undefined, rent: undefined };
  }

  /** Build a boat at a dock from timber and coin — the progression ladder of hulls. */
  private build(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    const klass = query.trim().toLowerCase();
    const tmpl = this.cat.shipClasses[klass];
    if (tmpl === undefined) return `You don't know how to build a "${query}". Known hulls: ${Object.keys(this.cat.shipClasses).join(", ")}.`;
    // A sea-station is built ON the water (from a ship at sea); a ship at a dock.
    let place: string | null;
    if (klass === "station") {
      const ship = aboardShip(this.world, actor);
      place = ship !== null ? shipPosition(this.world, ship) : this.here(actor);
      if (place === null || !isOcean(this.content, place)) return "A sea-station is built out on the open water, from a ship — never ashore.";
    } else {
      place = this.here(actor);
      if (place === null || !isDock(this.content, place)) return "You can only lay down a hull at a dock or boatyard.";
    }
    const coin = numberOf(this.world, actor, "coin", 0);
    if (coin < tmpl.cost) return `Building a ${klass} costs ${tmpl.cost} coin; you have ${coin}.`;
    const timber = contentsOf(this.world, actor).filter((id) => this.tagsOf(id).includes("timber"));
    if (timber.length < tmpl.timber) return `A ${klass} needs ${tmpl.timber} timber; you are carrying ${timber.length}. Gather more.`;
    const shipId = `${klass}-${this.spawned.length + 1}`;
    this.registerShip(shipId, klass);
    this.spawned.push({ kind: "ship", id: shipId, klass });
    const facts = [
      { e: shipId, a: "located-in", v: place },
      { e: shipId, a: "owner", v: actor },
      { e: shipId, a: "class", v: klass },
      { e: shipId, a: "hull", v: String(tmpl.hull) }, { e: shipId, a: "max-hull", v: String(tmpl.hull) },
      { e: shipId, a: "speed", v: String(tmpl.speed) }, { e: shipId, a: "cargo-capacity", v: String(tmpl.cargo) },
      { e: actor, a: "coin", v: String(coin - tmpl.cost) },
      // a sea-station is born working: it trawls and fouls its cell until struck.
      ...(klass === "station" ? [{ e: shipId, a: "industry", v: "trawler" }] : []),
      // join each new room to the ship with a functional `part-of` fact, so everyone
      // aboard moves with her and the snapshot carries the joinery for restore.
      ...tmpl.rooms.map((room) => ({ e: `${shipId}-${room.suffix}`, a: "part-of", v: shipId })),
      // the timber is worked into her hull — it leaves your hands and becomes the ship.
      ...timber.slice(0, tmpl.timber).map((id) => ({ e: id, a: "located-in", v: shipId })),
    ];
    this.world = tell(this.world, facts);
    this.buildXp(actor);
    touch(actor, shipId, place);
    return `You lay down and launch ${this.name(shipId)} at ${this.name(place)} — a ${klass}, hull ${tmpl.hull}, hold ${tmpl.cargo}. She's yours. Board her and sail.`;
  }

  /** Hire a ship floating here for a voyage — pay its rent, gain the helm. */
  private rentShip(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    const place = this.here(actor);
    if (place === null) return "You are nowhere.";
    const id = this.resolve(query, shipsAt(this.world, this.content, place));
    if (id === null) return `There is no ship "${query}" here to hire.`;
    const rent = this.content.ships[id]?.rent;
    if (rent === undefined) return `${capitalize(this.name(id))} is not for hire.`;
    const owner = valueOf(this.world, id, "owner");
    if (owner !== null && owner !== "nothing" && owner !== actor) return `${capitalize(this.name(id))} belongs to someone else.`;
    const renter = valueOf(this.world, id, "rented-by");
    if (renter !== null && renter !== "nothing" && renter !== actor) return `${capitalize(this.name(id))} is already hired out.`;
    const coin = numberOf(this.world, actor, "coin", 0);
    if (coin < rent) return `Hiring ${this.name(id)} costs ${rent} coin; you have ${coin}.`;
    this.world = tell(this.world, [{ e: actor, a: "coin", v: String(coin - rent) }, { e: id, a: "rented-by", v: actor }]);
    touch(actor, id);
    return `You hire ${this.name(id)} for ${rent} coin. She answers your hand now. (${coin - rent} left)`;
  }

  /** Buy a ship floating here outright — pay its price, take ownership. */
  private buyShip(actor: string, query: string, touch: (...ids: (string | null)[]) => void): string {
    const place = this.here(actor);
    if (place === null) return "You are nowhere.";
    const id = this.resolve(query, shipsAt(this.world, this.content, place));
    if (id === null) return `There is no ship "${query}" here to buy.`;
    const price = this.content.ships[id]?.price;
    if (price === undefined) return `${capitalize(this.name(id))} is not for sale.`;
    const owner = valueOf(this.world, id, "owner");
    if (owner === actor) return `You already own ${this.name(id)}.`;
    if (owner !== null && owner !== "nothing") return `${capitalize(this.name(id))} already has an owner.`;
    const coin = numberOf(this.world, actor, "coin", 0);
    if (coin < price) return `${capitalize(this.name(id))} costs ${price} coin; you have only ${coin}.`;
    this.world = tell(this.world, [
      { e: actor, a: "coin", v: String(coin - price) },
      { e: id, a: "owner", v: actor },
      { e: id, a: "rented-by", v: "nothing" },
    ]);
    touch(actor, id);
    return `You buy ${this.name(id)} for ${price} coin. She's yours now. (${coin - price} left)`;
  }

  // ── combat ───────────────────────────────────────────────────────────────

  /** Send a line to every other actor in the room, optionally excluding some ids. */
  private broadcastRoom(actor: string, text: string, events: SceneEvent[], except: readonly string[] = []): void {
    const skip = new Set(except);
    for (const other of this.audience(actor)) if (!skip.has(other)) events.push({ k: "message", to: other, text });
  }

  private status(actor: string): string {
    const h = numberOf(this.world, actor, "health", PLAYER_HEALTH);
    const mh = numberOf(this.world, actor, "max-health", PLAYER_HEALTH);
    const atk = numberOf(this.world, actor, "attack", PLAYER_ATTACK);
    const condition = valueOf(this.world, actor, "condition") ?? "alive";
    const coin = numberOf(this.world, actor, "coin", 0);
    const wielded = valueOf(this.world, actor, "wielding");
    const worn = valueOf(this.world, actor, "wearing");
    const gear = [
      wielded && wielded !== "nothing" ? `wielding ${this.name(wielded)}` : null,
      worn && worn !== "nothing" ? `wearing ${this.name(worn)}` : null,
    ].filter(Boolean).join(", ");
    return `Health: ${h}/${mh}   Attack: ${atk}   Coin: ${coin}   (${condition})${gear ? `\n${gear}` : ""}`;
  }

  /** Strike a co-located target: damage folds its `health` cell; at zero it dies. */
  private attack(actor: string, query: string, dirty: Set<string>, events: SceneEvent[]): string {
    if (!query) return "Attack what?";
    const target = this.resolve(query, [...this.around(actor).npcs, ...this.audience(actor)]);
    if (target === null) return `There is no "${query}" here to attack.`;
    if (target === actor) return "You can't attack yourself.";
    if (valueOf(this.world, target, "condition") === "dead") return `${capitalize(this.name(target))} is already dead.`;
    // Violence entangles: the blow leaves residue on both fibers (F8).
    this.world = entangle(this.world, actor, target, "fought");
    // And it costs you: striking a faction's own sinks your standing with them (and lifts their
    // rivals — the paraconsistent landscape). A player can't please the watch and the smugglers both.
    if (this.players.has(actor)) for (const f of factionsOfTags(this.tagsOf(target))) this.world = shiftStanding(this.world, actor, f, -25, this.cat.factions);
    const result = this.strike(actor, target, dirty, events);
    // Crime: assaulting the innocent (a player, or a non-aggressor NPC) where the law reaches flags
    // a bounty and angers the Watch — repeat it and their own reputation-hatred hunts you (PvP ward).
    const room = this.here(actor);
    const innocent = this.players.has(target) || !isHostile(this.tagsOf(target));
    if (this.players.has(actor) && innocent && room !== null && isLawfulArea(this.tagsOf(room))) {
      const murdered = valueOf(this.world, target, "condition") === "dead";
      this.world = flagCrime(this.world, actor, murdered ? "murder" : "assault", this.cat.factions);
      this.broadcastRoom(actor, `Someone cries out for the Watch — ${this.name(actor)} has drawn blood on ${murdered ? "and killed " : ""}${this.name(target)}!`, events, []);
    }
    return result;
  }

  /** The tags of a thing (room or item/npc) in content. */
  private tagsOf(id: string): readonly string[] {
    return this.content.things[id]?.tags ?? this.content.rooms[id]?.tags ?? [];
  }

  /** The extra damage from a held, wielded weapon (0 when unarmed). */
  private weaponDamage(actor: string): number {
    const w = valueOf(this.world, actor, "wielding");
    if (w === null || w === "nothing" || placeOf(this.world, w) !== actor) return 0;
    return numericTag(this.tagsOf(w), "weapon-damage") ?? 1;
  }

  /** The damage mitigated by held, worn armor (0 when unarmored). */
  private armorProtection(actor: string): number {
    const a = valueOf(this.world, actor, "wearing");
    if (a === null || a === "nothing" || placeOf(this.world, a) !== actor) return 0;
    return numericTag(this.tagsOf(a), "armor-protection") ?? 0;
  }

  /** One blow: fold the target's health down; witness it in the room; resolve death. */
  private strike(attacker: string, target: string, dirty: Set<string>, events: SceneEvent[]): string {
    // skill in fighting adds up to +50% to a blow; the attacker trains by striking.
    const raw = numberOf(this.world, attacker, "attack", PLAYER_ATTACK) + this.weaponDamage(attacker);
    const skilled = raw * (1 + 0.5 * effectiveBonus(this.world, attacker, "fighting")); // anatomy synergy sharpens the blow
    const damage = Math.max(Math.round(skilled) - this.armorProtection(target), 1);
    this.world = practise(this.world, attacker, "fighting");
    const after = Math.max(numberOf(this.world, target, "health", PLAYER_HEALTH) - damage, 0);
    this.world = tell(this.world, [{ e: target, a: "health", v: String(after) }]);
    const room = this.here(attacker);
    dirty.add(attacker);
    dirty.add(target);
    if (room !== null) dirty.add(room);
    this.broadcastRoom(attacker, `${capitalize(this.name(attacker))} strikes ${this.name(target)} for ${damage}!`, events, [target]);
    if (this.players.has(target)) {
      events.push({ k: "message", to: target, text: `${capitalize(this.name(attacker))} strikes you for ${damage}! (${after} health left)` });
    }
    if (after <= 0) {
      this.die(target, dirty, events);
      if (this.players.has(attacker)) this.gainXp(attacker, 10, events);
      return `You strike ${this.name(target)} for ${damage}. ${capitalize(this.name(target))} falls!`;
    }
    return `You strike ${this.name(target)} for ${damage}. (${after} health left)`;
  }

  /** Resolve a death: drop the slain's gear, witness the fall; players respawn whole. */
  private die(target: string, dirty: Set<string>, events: SceneEvent[]): void {
    this.world = tell(this.world, [{ e: target, a: "condition", v: "dead" }]);
    const room = this.here(target);
    for (const item of contentsOf(this.world, target)) {
      this.world = engineDrop(this.world, target, item);
      dirty.add(item);
    }
    this.broadcastRoom(target, `${capitalize(this.name(target))} has been slain!`, events);
    if (room !== null) dirty.add(room);
    if (this.players.has(target)) {
      const maxHealth = numberOf(this.world, target, "max-health", PLAYER_HEALTH);
      this.world = engineGo(this.world, target, this.startRoom);
      this.world = tell(this.world, [
        { e: target, a: "health", v: String(maxHealth) },
        { e: target, a: "condition", v: "alive" },
      ]);
      events.push({ k: "message", to: target, text: "Everything goes dark — then you wake where you began, whole again." });
      dirty.add(target);
      dirty.add(this.startRoom);
    }
  }
}

export const HELP = [
  "Commands:",
  "  look / l            — look around the room",
  "  examine <thing>     — look closely (also: x, look <thing>)",
  "  go <dir> / <dir>    — move (north, n, southeast, se, ...)",
  "  exits               — list the ways out",
  "  take <thing>        — pick something up (also: get)",
  "  drop <thing>        — put something down",
  "  give <thing> to <who> — hand something over",
  "  inventory / i       — what you are carrying",
  "  wield / wear <thing>— ready a weapon or armor (also: equip)",
  "  remove <thing>      — stop wielding/wearing (also: unwield, unwear)",
  "  read <thing>        — read what is written on something",
  "  open / close <thing>— open or close a container or door",
  "  lock / unlock <door>— lock or unlock a door (needs its key)",
  "  search              — search the room for hidden things (skill-gated)",
  "  mind                — your cabinet: the inner faculties you perceive through (also: cabinet)",
  "  eat <thing>          — eat something edible; a trained palate (gourmandise) gets more from it",
  "  regard <anything>    — read the inner life of any being or thing, as far as your faculties reach",
  "  quarry               — cut granite where the stone is worked (also: chop/mine/forage/fish)",
  "  construct <what> <dir> — raise a structure from materials you carry; it persists (see: structures)",
  "  standing             — where you stand with the island's factions (also: reputation)",
  "  thoughts             — your Thought Cabinet; 'contemplate <id>' to internalize one (Disco-style)",
  "  campaign             — your long arc on the island: the next stage and how far you've come (also: saga)",
  "  pay                  — settle your bounty with a Watch member here (also: bounty)",
  "  speak <tongue> <words> / learn <tongue> / languages — speech in many tongues",
  "  list                — a shopkeeper's wares (also: wares)",
  "  buy / sell <thing>  — trade with a shopkeeper",
  "  ships               — vessels floating where you stand",
  "  board <ship>        — climb aboard a ship; disembark to step ashore",
  "  rent / purchase <ship> — hire or buy a ship (you must own/hire one to sail it)",
  "  build <class>       — lay down a hull at a dock from timber + coin (raft/dinghy/skiff/lugger)",
  "  fish / chop / mine / forage — gather raw materials from a resource node here",
  "  craft <recipe>      — make a thing from materials (recipes lists them); skills improve with use",
  "  skills              — your practised abilities and their levels",
  "  who                 — who else is playing right now",
  "  sheet               — your character: title, xp, skills, guild, band",
  "  form / join / follow <who> / party <words> / leave — parties",
  "  found / enlist <guild> / guild [<words>] / roster / resign — guilds",
  "  profess <trade>     — take up a profession (fisher/shipwright/smith/cook/trader)",
  "  alias <name> <cmd>  — make a command shortcut",
  "  mail <who> <words> / inbox — send and read letters",
  "  sail <dir>          — steer your ship from its helm; scan to look over the water",
  "  survey              — read the ecology of the surrounding waters (fish, pollution)",
  "  rig / industrialize — rig your ship as a trawler at sea (profit, but it pollutes)",
  "  propose / support <law> — table or back a commons law (pollution-cap, fishing-quota)",
  "  laws                — the commons: laws in force and pending proposals",
  "  program <ship> <lisp>— give a ship standing orders it runs itself each tick",
  "  define <name> <lisp> / cast <name> / spells — inscribe and cast relational-Lisp spells",
  "  automate <lisp> / unautomate — a standing program run for you each tick",
  "  say <words>         — speak aloud (heard in the room)",
  "  emote <action>      — act it out (also: me, :)",
  "  tell <who> <words>  — speak privately to someone here",
  "  chat <words>        — the global out-of-character channel (also: ooc)",
  "  smile / wave / bow ... [<who>] — soul emotes (and many more)",
  "  talk <who>          — strike up a conversation (also: greet)",
  "  attack <who>        — strike a target (also: kill, hit)",
  "  status              — your health and attack (also: score, hp)",
  "  quests              — your errands and whether they're done (also: journal)",
  "  afford <thing>      — the actions a thing's fiber composes with yours (computed, not listed)",
  "  inhabit <entity> / release — play as any fiber; perceive through its predicates",
  "  history             — the entanglements your fiber carries (your past, made geometric)",
  "  eulogize <slain>    — mourn the fallen into a word; vocabulary / invoke / unfold it",
  "  enter <region>      — open a private instance of a region; take 'out' to leave",
  "  help                — this list",
  "  (creators) @dig <dir> <name> / @describe / @name / @create / @exit / @tag — shape the world",
  "  (creators) @kick / @mute / @teleport / @summon / @stats — moderation & ops",
].join("\n");
