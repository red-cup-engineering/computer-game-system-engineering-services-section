/**
 * `@emsenn/fizzos/encoding` — the boundary codecs.
 *
 * The FizzOS world, perception, tick, and proposal carriers are charge-valued
 * structures; this module is the only place they cross the process/transport
 * boundary as JSON documents. The package-bin scripts (`scripts/*.mjs`) are thin
 * transport: they decode one boundary document, call a `./world.mjs` / `./running.mjs`
 * function, and encode one boundary document back. Keeping every codec here means the
 * bins carry no domain logic and HTTP/OpenAPI projections (the host's
 * `servePackageBins`) read these same documents rather than inventing a second shape.
 *
 * A charge is a bilattice FOUR value name (`potential` | `active` | `stable` |
 * `absurd`). A world serializes as its settled `e a v charge` facts; decoding folds
 * them straight back (one charge per cell, so the knowledge-join is identity).
 */
import type { ChargeValueName } from "@emsenn/relating";
import {
  canonical as canonicalJson,
  isJsonRecord,
  parseJson,
  requireJsonValue,
  type JsonRecord,
  type JsonValue,
} from "@emsenn/relating/writing";
import { type Fact, type Perception, type PerceivedFact, type World, settledFacts, world } from "./world.mjs";
import type { TickResult } from "./running.mjs";
import type { FizzosProposal, FizzosProposalAssertion, TickConfluence } from "./concurrency.mjs";

const CHARGE_NAMES: ReadonlySet<string> = new Set(["potential", "active", "stable", "absurd"]);

function asCharge(value: JsonValue, where: string): ChargeValueName {
  if (typeof value !== "string" || !CHARGE_NAMES.has(value)) {
    throw new TypeError(`fizzos: ${where} must be one of ${[...CHARGE_NAMES].join(", ")}, got ${JSON.stringify(value)}`);
  }
  return value as ChargeValueName;
}

function field(record: JsonRecord, key: string, where: string): JsonValue {
  const value = record[key];
  if (value === undefined) throw new TypeError(`fizzos: ${where} is missing required field ${key}`);
  return value;
}

function asString(value: JsonValue, where: string): string {
  if (typeof value !== "string") throw new TypeError(`fizzos: ${where} must be a string, got ${JSON.stringify(value)}`);
  return value;
}

function asRecord(value: JsonValue, where: string): JsonRecord {
  if (!isJsonRecord(value)) throw new TypeError(`fizzos: ${where} must be an object, got ${JSON.stringify(value)}`);
  return value;
}

function asArray(value: JsonValue, where: string): readonly JsonValue[] {
  if (!Array.isArray(value)) throw new TypeError(`fizzos: ${where} must be an array, got ${JSON.stringify(value)}`);
  return value;
}

// ── world ────────────────────────────────────────────────────────────────────

/** A world as its settled facts `{ e, a, v, charge }`, sorted canonically. */
export function worldDocument(w: World): JsonValue {
  const facts = settledFacts(w)
    .map((f) => ({ e: f.e, a: f.a, v: f.v, charge: f.charge }))
    .sort((x, y) => {
      const xs = `${x.e}|${x.a}|${x.v}`;
      const ys = `${y.e}|${y.a}|${y.v}`;
      return xs < ys ? -1 : xs > ys ? 1 : 0;
    });
  return { kind: "fizzos.world", facts };
}

/** Decode a world document into a settled world (one charge per cell). */
export function decodeWorld(value: JsonValue): World {
  const record = asRecord(value, "world");
  const facts = asArray(field(record, "facts", "world"), "world.facts").map((entry, i) => decodeFact(entry, `world.facts[${i}]`));
  return world(facts);
}

function decodeFact(value: JsonValue, where: string): Fact {
  const record = asRecord(value, where);
  return {
    e: asString(field(record, "e", where), `${where}.e`),
    a: asString(field(record, "a", where), `${where}.a`),
    v: asString(field(record, "v", where), `${where}.v`),
    charge: asCharge(field(record, "charge", where), `${where}.charge`),
  };
}

// ── perception ─────────────────────────────────────────────────────────────

/** A perceived fact carries its triple and the charge it is settled to in the fiber. */
function perceivedFactDocument(f: PerceivedFact): JsonValue {
  return { e: f.e, a: f.a, v: f.v, charge: f.charge };
}

export function perceptionDocument(p: Perception): JsonValue {
  return {
    kind: p.kind,
    actor: p.actor,
    place: p.place,
    facts: p.facts.map(perceivedFactDocument),
  };
}

// ── proposals ────────────────────────────────────────────────────────────────

/** Decode one tick proposal `{ actor, assertions: [{ e, a, v, charge? }] }`. */
export function decodeProposal(value: JsonValue, where = "proposal"): FizzosProposal {
  const record = asRecord(value, where);
  const assertions = asArray(field(record, "assertions", where), `${where}.assertions`).map((entry, i) => {
    const inner = asRecord(entry, `${where}.assertions[${i}]`);
    const chargeValue = inner["charge"];
    const assertion: FizzosProposalAssertion = {
      e: asString(field(inner, "e", `${where}.assertions[${i}]`), `${where}.assertions[${i}].e`),
      a: asString(field(inner, "a", `${where}.assertions[${i}]`), `${where}.assertions[${i}].a`),
      v: asString(field(inner, "v", `${where}.assertions[${i}]`), `${where}.assertions[${i}].v`),
      ...(chargeValue === undefined ? {} : { charge: asCharge(chargeValue, `${where}.assertions[${i}].charge`) }),
    };
    return assertion;
  });
  return { actor: asString(field(record, "actor", where), `${where}.actor`), assertions };
}

export function decodeProposals(value: JsonValue): readonly FizzosProposal[] {
  return asArray(value, "proposals").map((entry, i) => decodeProposal(entry, `proposals[${i}]`));
}

/** Decode a list of facts `[{ e, a, v, charge? }]` told at a frontier. */
export function decodeFacts(value: JsonValue): readonly Fact[] {
  return asArray(value, "facts").map((entry, i) => {
    const record = asRecord(entry, `facts[${i}]`);
    const chargeValue = record["charge"];
    return {
      e: asString(field(record, "e", `facts[${i}]`), `facts[${i}].e`),
      a: asString(field(record, "a", `facts[${i}]`), `facts[${i}].a`),
      v: asString(field(record, "v", `facts[${i}]`), `facts[${i}].v`),
      ...(chargeValue === undefined ? {} : { charge: asCharge(chargeValue, `facts[${i}].charge`) }),
    } satisfies Fact;
  });
}

// ── tick ─────────────────────────────────────────────────────────────────────

/** A tick's contention as the bigraded H^1 witness summary (no internal carriers). */
export function confluenceDocument(c: TickConfluence): JsonValue {
  return {
    kind: c.kind,
    confluent: c.confluent,
    disagreementRank: c.disagreementRank,
    truthRowConflicts: [...c.truthRowConflicts],
    inconsistencyConflicts: [...c.inconsistencyConflicts],
    heldContradictions: [...c.heldContradictions],
  };
}

export function tickDocument(result: TickResult): JsonValue {
  return {
    kind: result.kind,
    next: worldDocument(result.next),
    contention: confluenceDocument(result.contention),
  };
}

// ── look ───────────────────────────────────────────────────────────────────

/**
 * A look as its perceived fiber plus the polarized arena it observes into: each
 * settled fact that commits a polarity is one event `{ id, polarity }`; cells that
 * commit no polarity are recorded as audited.
 */
export function lookDocument(result: { readonly perception: Perception; readonly observation: { readonly arena: { readonly structure: { readonly events: readonly { readonly id: string; readonly charge: string }[] } }; readonly provenance: { readonly labels: readonly string[] } } }): JsonValue {
  return {
    kind: "fizzos.look",
    perception: perceptionDocument(result.perception),
    observation: {
      events: result.observation.arena.structure.events.map((event) => ({ id: event.id, polarity: event.charge })),
      audited: [...result.observation.provenance.labels],
    },
  };
}

// ── document boundary helpers ─────────────────────────────────────────────────

/** Parse one boundary document into a JSON value. */
export function readDocument(text: string): JsonValue {
  return parseJson(text.trim());
}

/** Encode one JSON value as a canonical boundary document (trailing newline). */
export function writeDocument(value: JsonValue): string {
  return `${canonicalJson(requireJsonValue(value, "fizzos document"))}\n`;
}
