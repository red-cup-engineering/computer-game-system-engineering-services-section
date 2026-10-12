/**
 * `@emsenn/fizzos/predication` — the predication-world-sim heart, realized on the engine.
 *
 * The design (`predication-world-sim.md`) says: everything is a fiber, `respond()` is the
 * universal interaction, and **the available actions are COMPUTED, not listed** — "what can
 * I do?" is "which messages would my fiber compose non-trivially with the entity's fiber?".
 * FizzOS already is a bilattice charge valuation (the FOUR — t/f/⊤/⊥ = potential/active/
 * stable/absurd), a sole-writer settlement tick, and Umwelt perception. This module adds the
 * five capabilities that turn the verb switch inside out:
 *
 *   1. **respond / affordances** — compose two fibers on a channel → a charge; the non-⊥
 *      channels ARE the action menu. Rules-as-data over the fiber, not a hardcoded list.
 *   2. **play as any fiber** — `inhabit` any closed fiber and perceive through its predicates.
 *   3. **history as entanglement** — interactions leave geometric residue (F8): paired
 *      predicates an entity carries, read off its fiber, not a separate log.
 *   4. **closure (rules-as-data)** — `closeWorld` fires forward-chaining world rules to a
 *      fixpoint each tick (Knaster-Tarski), so emergence — including the held ⊤ — comes from
 *      rules, not bespoke passes.
 *   5. **the tower/fold** — a thing that settles WITH WITNESSES folds into a word: a real
 *      vocabulary atom other fibers can `invoke`. Death becomes language. Resurrection unfolds.
 */
import { type World, type Fact, type PerceivedFact, factsOf, numberOf, tell, valueOf } from "./world.mjs";

/** The bilattice FOUR, as the engine names them. `absurd` is ⊥ — outside the Umwelt. */
export type Charge = "potential" | "active" | "stable" | "absurd";

/**
 * A fiber as the predication layer reads it: an entity's kind, its tags, and its cells.
 * The scene supplies this lens over its content + world so this module stays pure.
 */
export interface Fiber {
  readonly id: string;
  readonly kind: string;
  readonly tags: readonly string[];
  has(predicate: string): boolean;
  value(predicate: string): string | null;
  number(predicate: string, fallback?: number): number;
}

// ── 1. respond / affordances ──────────────────────────────────────────────────

/**
 * An affordance is a channel (a message kind) plus how it composes: given the actor's
 * fiber and the target's fiber, what charge does sending this message settle to? `absurd`
 * means the channel does not compose with this target — it is simply absent from the menu.
 */
export interface Affordance {
  readonly channel: string;
  readonly gloss: string;
  compose(actor: Fiber, target: Fiber): Charge;
}

const carriesWord = (f: Fiber, word: string): boolean =>
  f.tags.includes(`word:${word}`) || valueWords(f).includes(word);

/** Words a fiber carries (folded vocabulary it may invoke), from its `carries-word` cells. */
const valueWords = (f: Fiber): readonly string[] => {
  const raw = f.value("carries-word");
  return raw === null || raw === "" ? [] : raw.split(",").filter(Boolean);
};

/**
 * The world's standing affordance vocabulary — rules-as-data. Each reads the target's fiber
 * and yields a charge. This is the COMPUTED action menu: add a channel here, never edit a
 * dispatch. A locked door composes `active` (f — denied) until unlocked; a contested cell
 * composes `stable` (⊤). Everything else that does not fit is `absurd` (⊥) and unlisted.
 */
export const AFFORDANCES: readonly Affordance[] = Object.freeze([
  { channel: "take", gloss: "pick it up",
    compose: (_a, t) => (t.kind === "item" && !t.tags.includes("fixed") ? "potential" : "absurd") },
  { channel: "talk", gloss: "speak with it",
    compose: (_a, t) => (t.kind === "npc" ? "potential" : "absurd") },
  { channel: "attack", gloss: "strike it",
    compose: (_a, t) => (t.kind === "npc" && t.has("health") ? "potential" : "absurd") },
  { channel: "board", gloss: "go aboard",
    compose: (_a, t) => (t.kind === "vessel" || t.has("class") ? "potential" : "absurd") },
  { channel: "read", gloss: "read it",
    compose: (_a, t) => (t.tags.includes("readable") || t.tags.includes("sign") ? "potential" : "absurd") },
  { channel: "open", gloss: "open it",
    compose: (_a, t) => {
      if (t.tags.includes("container")) return t.value("open") === "true" ? "absurd" : "potential";
      if (t.tags.includes("door")) return t.value("door-state") === "locked" ? "active" : "potential";
      return "absurd";
    } },
  { channel: "buy", gloss: "buy from it",
    compose: (_a, t) => (t.tags.some((tag) => tag === "shop" || tag.startsWith("sells:")) ? "potential" : "absurd") },
  { channel: "harvest", gloss: "gather from it",
    compose: (_a, t) => (t.tags.some((tag) => tag.startsWith("node:")) ? "potential" : "absurd") },
  { channel: "eulogize", gloss: "mourn it into legend",
    compose: (_a, t) => (isSettledDead(t) ? "potential" : "absurd") },
  // The tower/fold payoff: a fiber that carries a folded word may invoke it.
  { channel: "invoke", gloss: "invoke a word it carries",
    compose: (a, t) => (valueWords(t).length > 0 || carriesWord(a, "*") ? "potential" : "absurd") },
]);

/** A thing is "settled dead" — closed and inert — when slain, or its health is gone. */
export const isSettledDead = (f: Fiber): boolean =>
  f.value("condition") === "dead" || f.tags.includes("inert") || (f.has("health") && f.number("health", 1) <= 0);

/** A composed channel result: the channel, its gloss, and the charge it settled to. */
export interface Afforded {
  readonly channel: string;
  readonly gloss: string;
  readonly charge: Charge;
}

/**
 * `respond(actor, target, channel)` — compose the two fibers on one channel, returning the
 * settled charge. The universal interaction: a single morphism behind every verb.
 */
export function respond(actor: Fiber, target: Fiber, channel: string, rules: readonly Affordance[] = AFFORDANCES): Charge {
  const rule = rules.find((r) => r.channel === channel);
  return rule === undefined ? "absurd" : rule.compose(actor, target);
}

/**
 * The affordances of a target for an actor — the COMPUTED action menu. Every channel whose
 * composition is non-⊥ (anything but `absurd`), with the charge it carries (so a denied or
 * contested action still shows, marked by its value, rather than silently vanishing).
 */
export function affordances(actor: Fiber, target: Fiber, rules: readonly Affordance[] = AFFORDANCES): Afforded[] {
  const out: Afforded[] = [];
  for (const rule of rules) {
    const charge = rule.compose(actor, target);
    if (charge !== "absurd") out.push({ channel: rule.channel, gloss: rule.gloss, charge });
  }
  return out;
}

// ── 2. play as any fiber ───────────────────────────────────────────────────────

/** The fiber an actor is playing as (the body it inhabits), or itself when un-inhabited. */
export const bodyOf = (w: World, actor: string): string => {
  const v = valueOf(w, actor, "playing-as");
  return v === null || v === "" ? actor : v;
};

/** Assume control of any closed fiber — play as the ship, the tide, the rumor. */
export const inhabit = (w: World, actor: string, entity: string): World => tell(w, [{ e: actor, a: "playing-as", v: entity }]);

/** Return to your own fiber. */
export const release = (w: World, actor: string): World => tell(w, [{ e: actor, a: "playing-as", v: "" }]);

// ── 3. history as entanglement (F8) ────────────────────────────────────────────

/** A geometric residue: two fibers that composed leave a paired predicate on each. */
export interface Entanglement {
  readonly kind: string;
  readonly other: string;
}

/**
 * Leave entanglement residue from a composition — dual-filed onto BOTH fibers (the row
 * lives in the subject's and the object's log, the descent/gluing the design calls for).
 * Non-functional, so it accumulates: an entity's history IS the shape of its fiber.
 */
export function entangle(w: World, a: string, b: string, kind: string): World {
  return tell(w, [
    { e: a, a: "entangled", v: `${kind}:${b}` },
    { e: b, a: "entangled", v: `${kind}:${a}` },
  ]);
}

/** Read an entity's entanglements off its fiber — the geometric record of what shaped it. */
export function entanglementsOf(w: World, entity: string): Entanglement[] {
  const out: Entanglement[] = [];
  for (const fact of factsOf(w, entity)) {
    if (fact.a !== "entangled") continue;
    const idx = fact.v.indexOf(":");
    if (idx < 0) continue;
    out.push({ kind: fact.v.slice(0, idx), other: fact.v.slice(idx + 1) });
  }
  return out;
}

// ── 4. closure (rules-as-data, fired to a fixpoint) ────────────────────────────

/**
 * A closure rule: when its antecedent holds on an entity's fiber, it asserts consequent
 * facts. Fired repeatedly to a fixpoint, so a rule may feed another. Two rules that assert
 * and deny the same cell settle it to `stable` (⊤) — contradiction as a value, not a crash.
 */
export interface ClosureRule {
  readonly id: string;
  when(f: Fiber): boolean;
  then(f: Fiber): readonly Fact[];
}

/**
 * Close a set of entities under the rules — Knaster-Tarski least fixed point. Each round
 * fires every rule whose antecedent holds and whose consequent is not already present; stops
 * when a round adds nothing (or the bound trips). Returns the settled world and what fired.
 */
export function closeWorld(
  w: World,
  entities: readonly string[],
  rules: readonly ClosureRule[],
  lens: (w: World, id: string) => Fiber,
  bound = 16,
): { world: World; fired: readonly string[] } {
  const fired: string[] = [];
  let world = w;
  for (let round = 0; round < bound; round++) {
    const next: Fact[] = [];
    for (const id of entities) {
      const fiber = lens(world, id);
      for (const rule of rules) {
        if (!rule.when(fiber)) continue;
        for (const fact of rule.then(fiber)) {
          if (valueOf(world, fact.e, fact.a) === fact.v) continue; // already settled there
          next.push(fact);
          fired.push(`${rule.id}:${fact.e}`);
        }
      }
    }
    if (next.length === 0) break;
    world = tell(world, next);
  }
  return { world, fired };
}

// ── 5. the tower/fold — death becomes vocabulary ───────────────────────────────

/** The world entity that carries the folded vocabulary (the tower's standing word-stock). */
export const VOCABULARY = "the-vocabulary";

/** A folded word: the name minted, and the entity it was folded from. */
export interface Word {
  readonly word: string;
  readonly from: string;
}

/** The word a fallen entity becomes, drawn from its name (its salient predicate). */
export const wordFor = (name: string): string =>
  `fallen-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

/**
 * Fold a settled entity into vocabulary — the tower advancing (F9). With witnesses (F5.3 —
 * settled AND partnered) the entity becomes a WORD: a real atom in the world's vocabulary
 * that the witnesses carry and can `invoke`. Without witnesses it settles alone (F5.1) and no
 * word is born. Returns the next world and the minted word (null when unwitnessed).
 */
export function fold(w: World, entity: string, name: string, witnesses: readonly string[]): { world: World; word: string | null } {
  if (witnesses.length === 0) return { world: w, word: null };
  const word = wordFor(name);
  const facts: Fact[] = [
    { e: VOCABULARY, a: "word", v: word },
    { e: word, a: "from-entity", v: entity },
  ];
  // Each mourner is partnered to the fold and carries the new word.
  for (const m of witnesses) {
    const had = (valueOf(w, m, "carries-word") ?? "").split(",").filter(Boolean);
    if (!had.includes(word)) facts.push({ e: m, a: "carries-word", v: [...had, word].join(",") });
  }
  let world = tell(w, facts);
  // The witnessing entangles each mourner with the word — the funeral made structural.
  for (const m of witnesses) world = entangle(world, m, word, "mourned");
  return { world, word };
}

/** The words folded into the world's vocabulary so far. */
export function vocabularyOf(w: World): readonly string[] {
  return factsOf(w, VOCABULARY).filter((f) => f.a === "word").map((f) => f.v);
}

/** Whether an entity carries a folded word (and so may invoke it). */
export function carriesWordId(w: World, entity: string, word: string): boolean {
  return (valueOf(w, entity, "carries-word") ?? "").split(",").filter(Boolean).includes(word);
}

/**
 * Unfold a word back into an entity — resurrection (F9 inverse). The new being is MADE FROM
 * the word that was made from an entity: it carries the word as a predicate and the trace of
 * having been vocabulary. Returns the new entity id and the facts that constitute it.
 */
export function unfold(w: World, word: string, place: string): { world: World; entity: string } {
  const entity = `${word}-unfolded-${numberOf(w, word, "unfoldings", 0) + 1}`;
  const world = tell(w, [
    { e: word, a: "unfoldings", v: String(numberOf(w, word, "unfoldings", 0) + 1) },
    { e: entity, a: "from-word", v: word },
    { e: entity, a: "located-in", v: place },
  ]);
  return { world: entangle(world, entity, word, "unfolded-from"), entity };
}
