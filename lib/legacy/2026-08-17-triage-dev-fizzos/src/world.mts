/**
 * The FizzOS world — the settled charge valuation, as a thin composition over the
 * contemporary `@emsenn/animating` assertion-worlds (which themselves settle the
 * `@emsenn/relating` bilattice). FizzOS does not re-implement a world; it *inherits*
 * one and gives it a walkable face.
 *
 * The world is an **assertion-world**: a `Map<entity, assertion trace>`. You never
 * overwrite a fact — you *tell* the world a new assertion and it folds the trace to a
 * settled fixpoint where each `entity predicate value` cell carries a bilattice FOUR
 * charge (`@emsenn/relating`): affirmed (`potential`), denied (`active`),
 * held-contradictory (`stable`), or unknown (`absurd`).
 *
 * Each mechanic is read off the theory and inherited, not coded by hand:
 *   - **CONSERVATION** is `@emsenn/animating`'s *functional supersede*: `located-in`
 *     is a single-valued predicate, so settling keeps only the latest-stamped
 *     location and the old one simply leaves the fiber. A thing is `located-in`
 *     exactly one place because the *type* is functional, not because of bookkeeping.
 *     `take` / `drop` / `give` / `go` are all the one `moveFact`.
 *   - **the FIBER** is the per-subject settled section: an actor perceives only the
 *     restriction of the world to itself, its place, and what is co-located — it never
 *     reads outside its section.
 *   - **paraconsistency** is the bilattice underneath: a cell can settle to `stable`
 *     (held contradiction) without trivializing. That is a substrate capability, for
 *     domains that need it — not a movement/inventory race-resolver.
 */
import type { ChargeValueName } from "@emsenn/relating";
import {
  type Assertion,
  type AssertionTrace,
  type FoldedCell,
  type World as AssertionWorld,
  emptyWorld,
  settle,
} from "./assertion-world.mjs";

/** Animating marks never-admitted keys with this prefix; FizzOS does not author them. */
const INERT_PREFIX = "absurd:";

/** The functional predicate of place: a thing is `located-in` exactly one place. */
export const LOCATED_IN = "located-in";

/**
 * The single-valued predicates settling honors as functional: each names a cell a
 * thing has exactly one of, so the latest-stamped assertion supersedes the rest.
 * `located-in` gives CONSERVATION; the scalar/state predicates (a thing has one
 * health, one condition, wields one weapon) make attributes single-valued the same way.
 */
/** The single-valued (scalar/state) predicates a thing has exactly one of. */
const SCALAR: ReadonlySet<string> = new Set([
  LOCATED_IN, "health", "max-health", "condition", "wielding", "wearing", "attack", "coin", "open",
  // vessels: a room belongs to one ship; a ship has one owner, class, hull, speed, capacity.
  "part-of", "owner", "class", "hull", "max-hull", "speed", "cargo-capacity", "rented-by", "autopilot",
  // NPC interiority: one current mood.
  "mood",
  // ocean ecology: a cell's fish population, pollution burden, capacity, charge-valued health.
  "fish-stock", "pollution", "ecology", "capacity-fish",
  // at-sea industry: a vessel's installed industry.
  "industry",
  // the world clock: the running time, and the current weather.
  "world-time", "weather",
  // world interaction: a found-hidden flag, a door's state.
  "revealed", "door-state",
  // a creator's world-shaping capability.
  "creator",
  // a player's standing automation (a Lisp program run each tick).
  "automation",
  // a chosen profession; a piece of mail's sender and body.
  "profession", "mail-from", "mail-body",
  // moderation: whether a player is muted.
  "muted",
  // predication world-sim: the fiber a player inhabits; the words a fiber carries; a
  // folded word's origin and an unfolded entity's source; the count of unfoldings.
  "playing-as", "carries-word", "from-entity", "from-word", "unfoldings",
  // closure-derived ecology flags: a cell blighted by pollution, or torn (blighted yet teeming).
  "blighted", "torn",
]);

/**
 * A predicate is functional (single-valued, superseded by stamp) if it is a known
 * scalar, or a *family* member: `skill:<name>` (one level each), `need:<name>` (one
 * pressure each), `belief:<cell>` (one held charge each — an NPC's world-model). Family
 * predicates are dynamic, so functionality is decided by prefix, not an enumerated set.
 */
/**
 * Predicates a *game* (not the engine) has declared single-valued, via `registerFunctional`.
 * Additive and monotonic — marking a predicate functional only compacts its trace — so the
 * union across games loaded in one process is always sound.
 */
const GAME_FUNCTIONAL = new Set<string>();

/** Register a game's own scalar predicates as functional, so their traces compact like the engine's. */
export function registerFunctional(predicates: Iterable<string>): void {
  for (const p of predicates) GAME_FUNCTIONAL.add(p);
}

const FUNCTIONAL = (predicate: string): boolean =>
  SCALAR.has(predicate) ||
  GAME_FUNCTIONAL.has(predicate) ||
  predicate.startsWith("skill:") ||
  predicate.startsWith("need:") ||
  predicate.startsWith("belief:") ||
  predicate.startsWith("yield:") ||
  predicate.startsWith("stock:") ||
  predicate.startsWith("price:") ||
  // the commons: one enacted value, one pending proposal, one supporter roll per law.
  predicate.startsWith("law:") ||
  predicate.startsWith("proposal:") ||
  predicate.startsWith("supporters:") ||
  // player social structures: one party, one guild, one followed leader, one XP total.
  predicate.startsWith("party") ||
  predicate.startsWith("guild") ||
  predicate.startsWith("following") ||
  predicate.startsWith("xp") ||
  predicate.startsWith("title") ||
  // a known language is a single yes/no cell per tongue.
  predicate.startsWith("language:") ||
  // a defined spell is one Lisp program per name.
  predicate.startsWith("spell:") ||
  // a command alias is one expansion per name.
  predicate.startsWith("alias:");

/** The source recorded on FizzOS-told assertions. */
const SOURCE = "fizzos";

/** A fact `entity predicate value`, optionally with the charge it is told at (default `potential`). */
export interface Fact {
  readonly e: string;
  readonly a: string;
  readonly v: string;
  readonly charge?: ChargeValueName;
}

/**
 * The world: an `@emsenn/animating` assertion-world plus the monotonic stamp the next
 * told assertion carries, so functional supersession (conservation) sees a strict
 * order without a wall clock.
 */
export interface World {
  readonly kind: "fizzos.engine.world";
  readonly assertions: AssertionWorld;
  readonly seq: number;
}

const sameValue = (object: unknown, v: string): boolean => String(object) === v;

const EMPTY: readonly string[] = Object.freeze([]);

/**
 * Per-world-version memo of the expensive settling work, keyed on the immutable `World`
 * identity. Every `tell` produces a fresh frozen world, so a cache entry is valid for
 * the life of that version and is collected with it (WeakMap). Without this, settling a
 * subject's trace — `O(trace)` per call — ran on every `cellsOf`, and `contentsOf`
 * settled *every* subject, making interest-filtered perception roughly `O(subjects²)`
 * per tick. The memo collapses repeated reads of one world version to `O(1)`.
 */
const fiberCache = new WeakMap<World, Map<string, readonly FoldedCell[]>>();
const subjectCache = new WeakMap<World, readonly string[]>();
const containmentCache = new WeakMap<World, Map<string, string[]>>();

/** The settled fiber of one subject (functional predicates superseded), memoized per world. */
function cellsOf(w: World, entity: string): readonly FoldedCell[] {
  let byEntity = fiberCache.get(w);
  if (byEntity === undefined) {
    byEntity = new Map();
    fiberCache.set(w, byEntity);
  }
  let cells = byEntity.get(entity);
  if (cells === undefined) {
    // Settle this subject's trace *directly* from the map (O(trace)). We deliberately
    // do NOT call animating's `frontier`/`logFor`, which copy and dedupe the whole world
    // on every call — that is O(world) per subject and quadratic over a containment scan.
    const trace = (w.assertions.get(entity) ?? []) as AssertionTrace;
    cells = settle(entity, trace, { functional: FUNCTIONAL }).fiber;
    byEntity.set(entity, cells);
  }
  return cells;
}

/**
 * The current value of a *functional* predicate on an entity, read directly from its
 * trace as the highest-stamped assertion — no fold. Sound because FizzOS only ever
 * positive-asserts functional facts (`located-in`, `health`, `coin`, …); supersession is
 * by stamp, so the latest stamp IS the settled `potential` value. This is the hot path
 * (place lookups, the containment index) and must not pay for a full settle.
 */
function latestFunctional(w: World, entity: string, predicate: string): string | null {
  const trace = w.assertions.get(entity);
  if (trace === undefined) return null;
  let best: string | null = null;
  let bestStamp = Number.NEGATIVE_INFINITY;
  for (const a of trace) {
    if (a.a !== predicate) continue;
    const stamp = typeof a.t === "number" ? a.t : 0;
    if (stamp >= bestStamp) {
      bestStamp = stamp;
      best = String(a.v);
    }
  }
  return best;
}

/** The world's subject ids, memoized per world version — read straight off the map keys. */
function subjectsOf(w: World): readonly string[] {
  let subjects = subjectCache.get(w);
  if (subjects === undefined) {
    const nextSubjects = Object.freeze([...w.assertions.keys()].filter((key) => !key.startsWith(INERT_PREFIX)));
    subjectCache.set(w, nextSubjects);
    subjects = nextSubjects;
  }
  return subjects;
}

/**
 * The `located-in` containment index of a world version: place → the things settled
 * there. Built once per world from the (memoized) per-subject fibers, so `contentsOf`
 * is an `O(1)` map read instead of an `O(subjects)` scan.
 */
function containmentIndex(w: World): ReadonlyMap<string, readonly string[]> {
  let index = containmentCache.get(w);
  if (index !== undefined) return index;
  index = new Map();
  for (const subject of subjectsOf(w)) {
    const place = placeOf(w, subject);
    if (place === null) continue;
    const here = index.get(place);
    if (here === undefined) index.set(place, [subject]);
    else here.push(subject);
  }
  containmentCache.set(w, index);
  return index;
}

/**
 * Tell a frontier of facts onto an assertion-world, each at a strictly increasing stamp.
 * The base map is *shallow*-copied (entries share trace arrays; only the touched entity
 * gets a fresh array), so a tell is O(entities) pointer-copies + O(facts), never the
 * O(world) dedupe `asWorld` would do. Dedup is unnecessary: each stamp is unique.
 */
function append(base: AssertionWorld, startSeq: number, facts: readonly Fact[]): World {
  const assertions: AssertionWorld = new Map(base);
  let seq = startSeq;
  for (const fact of facts) {
    const assertion: Assertion = { e: fact.e, a: fact.a, v: fact.v, t: seq, source: SOURCE };
    const prior: AssertionTrace = assertions.get(fact.e) ?? [];
    // A functional predicate is single-valued: the new assertion supersedes any prior one
    // of the same predicate, and `latestFunctional`/`settle` only ever read the latest. So
    // we drop the superseded history rather than let it grow — otherwise a long-lived mover
    // accrues an O(moves) `located-in` trace and every place read scans all of it. Non-
    // functional predicates keep their full history (the knowledge-join needs every charge).
    const kept: AssertionTrace = FUNCTIONAL(fact.a) ? prior.filter((p: Assertion) => p.a !== fact.a) : prior;
    assertions.set(fact.e, [...kept, assertion]);
    seq += 1;
  }
  return Object.freeze({ kind: "fizzos.engine.world" as const, assertions, seq });
}

/** Build a world from a frontier of facts told at once. */
export function world(facts: readonly Fact[] = []): World {
  return append(emptyWorld(), 0, facts);
}

/**
 * Tell an existing world a new frontier of facts — a state transition. New assertions
 * fold in by the knowledge-join; a told functional location supersedes the old one
 * (conservation). Pure — returns a new world, copying the assertion map first.
 */
export function tell(w: World, facts: readonly Fact[]): World {
  return append(w.assertions, w.seq, facts);
}

/** The settled charge of a fact; `absurd` outside the world's support. */
export function chargeOf(w: World, e: string, a: string, v: string): ChargeValueName {
  for (const cell of cellsOf(w, e)) if (cell.predicate === a && sameValue(cell.object, v)) return cell.value;
  return "absurd";
}

/** Whether a fact is designated — its truth coordinate is present (`potential` or the held-contradiction `stable`). */
export const holds = (w: World, e: string, a: string, v: string): boolean => {
  const c = chargeOf(w, e, a, v);
  return c === "potential" || c === "stable";
};

/** Whether a fact is *contested* — settled to the held contradiction `stable`. */
export const contested = (w: World, e: string, a: string, v: string): boolean => chargeOf(w, e, a, v) === "stable";

// ── place: the functional located-in fiber ──────────────────────────────────

/** The single uncontested place a thing is held to be in (`potential`), or null. */
export function placeOf(w: World, entity: string, predicate: string = LOCATED_IN): string | null {
  return latestFunctional(w, entity, predicate);
}

/** The things held to be in a place (its contents). */
export function contentsOf(w: World, place: string, predicate: string = LOCATED_IN): readonly string[] {
  // The common `located-in` case reads the prebuilt containment index in O(1).
  if (predicate === LOCATED_IN) return containmentIndex(w).get(place) ?? EMPTY;
  const out: string[] = [];
  for (const subject of subjectsOf(w)) {
    for (const cell of cellsOf(w, subject)) {
      if (cell.predicate === predicate && cell.value === "potential" && String(cell.object) === place) {
        out.push(subject);
        break;
      }
    }
  }
  return Object.freeze(out);
}

/**
 * Move a thing to a place along a functional predicate — the linear transfer. Telling
 * the new location supersedes the old (conservation comes from the functional type),
 * so after the move the thing is held in exactly one place. `give` / `take` / `drop` /
 * `go` are all built from this one retraction. `from` is accepted for the historical
 * signature; functional supersession makes it unnecessary.
 */
export function moveFact(w: World, entity: string, to: string, _from: string | null = null, predicate: string = LOCATED_IN): World {
  return tell(w, [{ e: entity, a: predicate, v: to }]);
}

/** An actor picks up an item that is in the actor's place: the item moves into the actor. */
export const take = (w: World, actor: string, item: string): World => moveFact(w, item, actor);
/** An actor drops an item it holds: the item moves into the actor's place. */
export const drop = (w: World, actor: string, item: string): World => moveFact(w, item, placeOf(w, actor) ?? actor);
/** An actor gives an item it holds to a recipient: a linear transfer between actors. */
export const give = (w: World, actor: string, item: string, recipient: string): World => moveFact(w, item, recipient);
/** An actor moves through an exit: the actor relocates to the destination. */
export const go = (w: World, actor: string, destination: string): World => moveFact(w, actor, destination);

// ── perception: the actor's fiber ───────────────────────────────────────────

/** A perceived fact: its triple and the charge it is settled to in the actor's section. */
export interface PerceivedFact {
  readonly e: string;
  readonly a: string;
  readonly v: string;
  readonly charge: ChargeValueName;
}

export interface Perception {
  readonly kind: "fizzos.engine.perception";
  readonly actor: string;
  readonly place: string | null;
  readonly facts: readonly PerceivedFact[];
}

/** Every settled, non-absurd cell of a subject, as perceived facts. */
function subjectFacts(w: World, subject: string): PerceivedFact[] {
  const out: PerceivedFact[] = [];
  for (const cell of cellsOf(w, subject)) {
    if (cell.value === "absurd") continue;
    out.push({ e: subject, a: cell.predicate, v: String(cell.object), charge: cell.value });
  }
  return out;
}

/**
 * What an actor perceives: the restriction of the settled world to the actor's
 * fiber — the facts about the actor, the actor's place, and everything co-located
 * with the actor. An actor never reads outside its section.
 */
export function perceive(w: World, actor: string, predicate: string = LOCATED_IN): Perception {
  const place = placeOf(w, actor, predicate);
  const here = new Set<string>([actor]);
  if (place !== null) {
    here.add(place);
    for (const thing of contentsOf(w, place, predicate)) here.add(thing);
  }
  const facts: PerceivedFact[] = [];
  for (const subject of here) facts.push(...subjectFacts(w, subject));
  return Object.freeze({ kind: "fizzos.engine.perception" as const, actor, place, facts: Object.freeze(facts) });
}

/**
 * Every settled, non-absurd cell of one entity — its full fiber, functional and not.
 * Functional predicates appear once (latest); non-functional predicates appear for every
 * value they hold (the accumulating ones, like a thing's `entangled` residue).
 */
export function factsOf(w: World, entity: string): readonly PerceivedFact[] {
  return subjectFacts(w, entity);
}

/** The single held value of a functional predicate on an entity (`potential`), or null. */
export function valueOf(w: World, entity: string, predicate: string): string | null {
  return latestFunctional(w, entity, predicate);
}

/** A numeric attribute of an entity, or a fallback when unset/non-numeric. */
export function numberOf(w: World, entity: string, predicate: string, fallback = 0): number {
  const raw = valueOf(w, entity, predicate);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/** Every settled, non-absurd cell across the whole world — the boundary-document view. */
export function settledFacts(w: World): readonly PerceivedFact[] {
  const out: PerceivedFact[] = [];
  for (const subject of subjectsOf(w)) out.push(...subjectFacts(w, subject));
  return Object.freeze(out);
}

export function isWorld(value: unknown): value is World {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "fizzos.engine.world";
}
