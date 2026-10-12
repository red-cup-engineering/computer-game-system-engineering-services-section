/**
 * `@emsenn/fizzos/federation` — horizontal scale: many authoritative shards, one world.
 *
 * The corpus result (`@emsenn/organizing/operating` federation): **federation IS the
 * multiplicative parallel `‖`** — a federated computer's arena is the tensor-fold of its
 * members', and the disagreement between members is the bigraded H¹ over the federation
 * cover. FizzOS already computes exactly that H¹ per tick (`concurrency.mts`). This module
 * lifts it from one tick to many **shards**: each shard is a `FizzosScene` authoritative over
 * a zone (a set of rooms), all ticking in parallel — the swarm of agents the corpus's
 * `agent →(actuating)→ actuator →…→ swarm` decomposition describes, read at world scale.
 *
 * A player who walks from one shard's zone into another's is **migrated**: their fiber and
 * everything they carry is exported as an entity packet (the design's "a player walks from
 * one server to another by their entity being sent as a message"), dropped from the source,
 * and imported into the destination. Cross-shard consistency on any entity two shards both
 * hold is read with the SAME `tickConfluence` H¹ — not an ad-hoc check; the cohomology that
 * resolves a single tick's conflicts is the cohomology that certifies the federation agrees.
 */
import { FizzosScene, type CommandIntent, type SceneEvent } from "./scene.mjs";
import { type FizzosProposal, proposalSite, tickConfluence } from "./concurrency.mjs";
import { factsOf } from "./world.mjs";

/** A shard: a scene authoritative over a zone — the room ids it owns and ticks. */
export interface Shard {
  readonly name: string;
  readonly scene: FizzosScene;
  readonly zone: ReadonlySet<string>;
}

/** A migration that happened this tick: who crossed, from which shard to which, into which room. */
export interface Migration {
  readonly actor: string;
  readonly from: string;
  readonly to: string;
  readonly room: string;
}

export interface FederationStepResult {
  readonly events: readonly (SceneEvent & { readonly shard: string })[];
  readonly migrations: readonly Migration[];
}

/**
 * A federation of shards. Routes each player's input to the shard that owns the room they
 * stand in, ticks every shard in parallel, then migrates any player who has stepped into
 * another shard's zone. The roster (`where`) maps each player to its current shard.
 */
export class Federation {
  private readonly shards = new Map<string, Shard>();
  private readonly where = new Map<string, string>();
  private readonly inbox = new Map<string, CommandIntent[]>();
  private tick = 0;

  constructor(shards: readonly Shard[]) {
    for (const shard of shards) {
      this.shards.set(shard.name, shard);
      this.inbox.set(shard.name, []);
    }
  }

  /** Which shard owns a room, or null when no shard claims it. */
  shardOfRoom(room: string): string | null {
    for (const shard of this.shards.values()) if (shard.zone.has(room)) return shard.name;
    return null;
  }

  /** Place a player into the federation at a room — they join the shard that owns it. */
  join(actor: string, room: string): string | null {
    const owner = this.shardOfRoom(room);
    if (owner === null) return null;
    this.where.set(actor, owner);
    this.queue(actor, "look");
    return owner;
  }

  /** The shard a player is currently on. */
  shardOf(actor: string): string | null {
    return this.where.get(actor) ?? null;
  }

  /** Queue a command for a player — it runs on whichever shard currently holds them. */
  queue(actor: string, line: string): void {
    const shard = this.where.get(actor);
    if (shard === undefined) return;
    this.inbox.get(shard)!.push({ k: "command", actor, line });
  }

  /**
   * One federated tick: every shard runs its own authoritative tick over its queued input
   * (in parallel — they share no writer), then players who crossed a zone boundary migrate.
   */
  step(): FederationStepResult {
    const events: (SceneEvent & { shard: string })[] = [];
    for (const shard of this.shards.values()) {
      const intents = this.inbox.get(shard.name)!;
      this.inbox.set(shard.name, []);
      const result = shard.scene.runTick(this.tick, intents);
      for (const e of result.events) events.push({ ...e, shard: shard.name });
    }
    this.tick += 1;
    const migrations = this.migrate();
    return Object.freeze({ events: Object.freeze(events), migrations: Object.freeze(migrations) });
  }

  /** Migrate every player who now stands in a room owned by a different shard. */
  private migrate(): Migration[] {
    const moves: Migration[] = [];
    for (const [actor, fromName] of [...this.where]) {
      const from = this.shards.get(fromName)!;
      const room = from.scene.roomOf(actor);
      if (room === null) continue;
      const ownerName = this.shardOfRoom(room);
      if (ownerName === null || ownerName === fromName) continue;
      // The crossing: export the entity packet, drop it from the source, import into the dest.
      const to = this.shards.get(ownerName)!;
      const packet = from.scene.exportActor(actor);
      from.scene.dropPlayer(actor);
      to.scene.importActor(packet, room);
      this.where.set(actor, ownerName);
      moves.push({ actor, from: fromName, to: ownerName, room });
    }
    return moves;
  }

  /**
   * The federation's confluence: read each shard that holds a given entity as a federation
   * site of that entity's settled cells, and run the SAME H¹ a single tick uses. Confluent
   * means every shard agrees on every shared entity — a clean global section. A player caught
   * in two shards with conflicting placement would surface here as a real disagreement class.
   */
  confluenceOf(entity: string): boolean {
    const proposals: FizzosProposal[] = [];
    for (const shard of this.shards.values()) {
      const cells = factsOf(shard.scene.currentWorld(), entity);
      if (cells.length === 0) continue;
      proposals.push({ actor: shard.name, assertions: cells.map((c) => ({ e: c.e, a: c.a, v: c.v })) });
    }
    if (proposals.length < 2) return true; // held by at most one shard — trivially a section
    return tickConfluence(proposals.map(proposalSite)).confluent;
  }
}
