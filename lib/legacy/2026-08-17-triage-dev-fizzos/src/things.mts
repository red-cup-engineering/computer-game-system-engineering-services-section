import { chargeValue, joinKnowledgeValue, type ChargeValueName } from "@emsenn/relating";
import type { Assertion } from "./assertion-world.mjs";

/**
 * A thing's settled charge is a @emsenn/relating bilattice value name; the
 * knowledge-join is relationality's real FOUR-bilattice operation, at the
 * value-name boundary.
 */
const joinCharge = (left: ChargeValueName, right: ChargeValueName): ChargeValueName =>
  joinKnowledgeValue(chargeValue(left), chargeValue(right)).name;

export type FizzosThingAttributeValue = unknown;

export type FizzosThingGrammar = Readonly<{
  nouns?: readonly string[];
  adjectives?: readonly string[];
  pronouns?: Readonly<Record<string, FizzosThingAttributeValue>>;
  [key: string]: FizzosThingAttributeValue | readonly string[] | undefined;
}>;

export type FizzosThingModel = Readonly<{
  id: string;
  name?: string;
  base?: string | readonly string[];
  behaviors?: readonly string[];
  qualities?: readonly string[];
  additiveAttributes?: readonly string[];
  grammar?: FizzosThingGrammar;
  attributes?: Readonly<Record<string, FizzosThingAttributeValue>>;
}>;

export type FizzosThingQuality = Readonly<{
  id: string;
  requires?: readonly string[];
  provides?: readonly string[];
  attributes?: Readonly<Record<string, FizzosThingAttributeValue>>;
  behaviors?: readonly string[];
}>;

export type FizzosThingRegistry = Readonly<{
  models: ReadonlyMap<string, FizzosThingModel> | Readonly<Record<string, FizzosThingModel>>;
  qualities?: ReadonlyMap<string, FizzosThingQuality> | Readonly<Record<string, FizzosThingQuality>>;
}>;

export type FizzosThing = Readonly<{
  id: string;
  name: string;
  bases: readonly string[];
  behaviors: readonly string[];
  qualities: readonly string[];
  additiveAttributes: readonly string[];
  grammar: FizzosThingGrammar;
  attributes: Readonly<Record<string, FizzosThingAttributeValue>>;
  provided: Readonly<Record<string, readonly string[]>>;
}>;

export type FizzosThingComposition = Readonly<{
  thing: FizzosThing;
  process: FizzosThingProcess;
  settled: SettledFizzosThingProcess;
  charge: ChargeValueName;
}>;

export type FizzosThingJudgment = Readonly<{
  name: string;
  value: ChargeValueName;
  reason: string;
  path: string;
}>;

export type FizzosThingProcess = Readonly<{
  id: string;
  assertions: readonly Assertion[];
  judgments: readonly FizzosThingJudgment[];
  metadata: Readonly<{
    source: string;
    bases: readonly string[];
    qualities: readonly string[];
  }>;
}>;

export type SettledFizzosThingProcess = Readonly<{
  process: FizzosThingProcess;
  value: ChargeValueName;
  admitted: boolean;
  vacuous: boolean;
  judgments: readonly FizzosThingJudgment[];
  assertions: readonly Assertion[];
}>;

const ROOT_ADDITIVE: readonly string[] = Object.freeze(["additiveAttributes", "behaviors", "qualities"]);

function readRegistry<T>(registry: ReadonlyMap<string, T> | Readonly<Record<string, T>> | undefined, id: string): T | undefined {
  if (registry === undefined) return undefined;
  return registry instanceof Map ? registry.get(id) : (registry as Readonly<Record<string, T>>)[id];
}

function uniq(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function baseList(model: Pick<FizzosThingModel, "base">): readonly string[] {
  if (model.base === undefined) return Object.freeze([]);
  return Object.freeze(Array.isArray(model.base) ? [...model.base] : [model.base]);
}

function concatValue(left: FizzosThingAttributeValue | undefined, right: FizzosThingAttributeValue): FizzosThingAttributeValue {
  const leftArray = Array.isArray(left) ? left : left === undefined ? [] : [left];
  const rightArray = Array.isArray(right) ? right : [right];
  return Object.freeze([...leftArray, ...rightArray]);
}

function mergeGrammar(left: FizzosThingGrammar, right: FizzosThingGrammar | undefined): FizzosThingGrammar {
  if (right === undefined) return left;
  const out: Record<string, FizzosThingAttributeValue | readonly string[] | undefined> = { ...left };
  for (const [key, value] of Object.entries(right)) {
    if (value === undefined) continue;
    if (key === "nouns" || key === "adjectives") {
      const prior = Array.isArray(out[key]) ? out[key] as readonly string[] : [];
      out[key] = uniq([...prior, ...(value as readonly string[])]);
    } else {
      out[key] = value;
    }
  }
  return Object.freeze(out) as FizzosThingGrammar;
}

export function resolveFizzosThingBases(
  model: FizzosThingModel,
  registry: FizzosThingRegistry,
  seen: readonly string[] = [],
): readonly FizzosThingModel[] {
  const bases: FizzosThingModel[] = [];
  for (const id of baseList(model)) {
    if (seen.includes(id)) throw new Error(`cyclic FizzOS thing base chain: ${[...seen, id].join(" -> ")}`);
    const base = readRegistry(registry.models, id);
    if (base === undefined) throw new Error(`unknown FizzOS thing base: ${id}`);
    bases.push(...resolveFizzosThingBases(base, registry, [...seen, id]), base);
  }
  return Object.freeze(bases);
}

export function mergeFizzosThingModels(models: readonly FizzosThingModel[]): FizzosThing {
  if (models.length === 0) throw new TypeError("mergeFizzosThingModels requires at least one model");
  const attributes: Record<string, FizzosThingAttributeValue> = {};
  let id = "";
  let name = "";
  let grammar: FizzosThingGrammar = Object.freeze({});
  let additive = [...ROOT_ADDITIVE];
  let behaviors: string[] = [];
  let qualities: string[] = [];

  for (const model of models) {
    id = model.id;
    name = model.name ?? (name || model.id);
    additive = [...additive, ...(model.additiveAttributes ?? [])];
    const additiveSet = new Set(additive);
    behaviors = additiveSet.has("behaviors") ? [...behaviors, ...(model.behaviors ?? [])] : [...(model.behaviors ?? behaviors)];
    qualities = additiveSet.has("qualities") ? [...qualities, ...(model.qualities ?? [])] : [...(model.qualities ?? qualities)];
    grammar = mergeGrammar(grammar, model.grammar);
    for (const [key, value] of Object.entries(model.attributes ?? {})) {
      attributes[key] = additiveSet.has(key) ? concatValue(attributes[key], value) : value;
    }
  }

  return Object.freeze({
    id,
    name,
    bases: uniq(models.slice(0, -1).map((model) => model.id)),
    behaviors: uniq(behaviors),
    qualities: uniq(qualities),
    additiveAttributes: uniq(additive),
    grammar,
    attributes: Object.freeze(attributes),
    provided: Object.freeze({}),
  });
}

function applyQualities(thing: FizzosThing, registry: FizzosThingRegistry): FizzosThing {
  const attributes: Record<string, FizzosThingAttributeValue> = { ...thing.attributes };
  const behaviors = [...thing.behaviors];
  const provided = new Map<string, string[]>();

  for (const qualityId of thing.qualities) {
    const quality = readRegistry(registry.qualities, qualityId);
    if (quality === undefined) continue;
    for (const behavior of quality.behaviors ?? []) behaviors.push(behavior);
    for (const providedName of quality.provides ?? []) {
      provided.set(providedName, [...(provided.get(providedName) ?? []), quality.id]);
    }
    for (const [key, value] of Object.entries(quality.attributes ?? {})) {
      attributes[key] = thing.additiveAttributes.includes(key) ? concatValue(attributes[key], value) : value;
    }
  }

  const providedRecord: Record<string, readonly string[]> = {};
  for (const [key, providers] of provided) providedRecord[key] = uniq(providers);

  return Object.freeze({
    ...thing,
    behaviors: uniq(behaviors),
    attributes: Object.freeze(attributes),
    provided: Object.freeze(providedRecord),
  });
}

export function fizzosThingAssertions(thing: FizzosThing): readonly Assertion[] {
  const assertions: Assertion[] = [
    { e: thing.id, a: "kind", v: "fizzos.thing", t: { by: "fizzos.things" } },
    { e: thing.id, a: "name", v: thing.name, t: { by: "fizzos.things" } },
  ];
  for (const base of thing.bases) assertions.push({ e: thing.id, a: "base", v: base, t: { by: "fizzos.things" } });
  for (const behavior of thing.behaviors) assertions.push({ e: thing.id, a: "behavior", v: behavior, t: { by: "fizzos.things" } });
  for (const quality of thing.qualities) assertions.push({ e: thing.id, a: "quality", v: quality, t: { by: "fizzos.things" } });
  for (const [key, value] of Object.entries(thing.attributes)) assertions.push({ e: thing.id, a: key, v: value, t: { by: "fizzos.things" } });
  for (const [name, providers] of Object.entries(thing.provided)) {
    for (const provider of providers) assertions.push({ e: thing.id, a: `provides:${name}`, v: provider, t: { by: "fizzos.things" } });
  }
  return Object.freeze(assertions);
}

function isAdmittedCharge(value: ChargeValueName): boolean {
  return value === "potential";
}

function settleJudgments(judgments: readonly FizzosThingJudgment[]): ChargeValueName {
  let value: ChargeValueName = judgments.length === 0 ? "potential" : "absurd";
  for (const judgment of judgments) value = joinCharge(value, judgment.value);
  return value;
}

function qualityJudgments(thing: FizzosThing, registry: FizzosThingRegistry): readonly FizzosThingJudgment[] {
  const judgments: FizzosThingJudgment[] = [];
  for (const qualityId of thing.qualities) {
    const quality = readRegistry(registry.qualities, qualityId);
    if (quality === undefined) {
      judgments.push({
        name: `quality:${qualityId}`,
        value: "active",
        reason: `unknown quality ${qualityId}`,
        path: `thing:${thing.id}/quality:${qualityId}`,
      });
      continue;
    }
    for (const requirement of quality.requires ?? []) {
      const providers = thing.provided[requirement] ?? [];
      judgments.push({
        name: `requires:${quality.id}:${requirement}`,
        value: providers.length > 0 ? "potential" : "active",
        reason: providers.length > 0 ? `provided by ${providers.join(",")}` : `missing provided procedure ${requirement}`,
        path: `thing:${thing.id}/quality:${quality.id}/requires:${requirement}`,
      });
    }
  }
  for (const [procedure, providers] of Object.entries(thing.provided)) {
    if (providers.length > 1) {
      judgments.push({
        name: `provides:${procedure}`,
        value: "stable",
        reason: `multiple quality providers: ${providers.join(",")}`,
        path: `thing:${thing.id}/provides:${procedure}`,
      });
    }
  }
  return Object.freeze(judgments);
}

export function createFizzosThingProcess(thing: FizzosThing, registry: FizzosThingRegistry): FizzosThingProcess {
  const judgments = qualityJudgments(thing, registry);
  return Object.freeze({
    id: thing.id,
    assertions: fizzosThingAssertions(thing),
    judgments,
    metadata: Object.freeze({
      source: "TAB base-chain + qtOps quality composition",
      bases: thing.bases,
      qualities: thing.qualities,
    }),
  });
}

export function settleFizzosThing(thing: FizzosThing, registry: FizzosThingRegistry): SettledFizzosThingProcess {
  const process = createFizzosThingProcess(thing, registry);
  const value = settleJudgments(process.judgments);
  return Object.freeze({
    process,
    value,
    admitted: isAdmittedCharge(value),
    vacuous: process.judgments.length === 0,
    judgments: process.judgments,
    assertions: process.assertions,
  });
}

export function composeFizzosThing(model: FizzosThingModel, registry: FizzosThingRegistry): FizzosThingComposition {
  const chain = [...resolveFizzosThingBases(model, registry), model];
  const thing = applyQualities(mergeFizzosThingModels(chain), registry);
  const settled = settleFizzosThing(thing, registry);
  return Object.freeze({
    thing,
    process: settled.process,
    settled,
    charge: settled.value,
  });
}
