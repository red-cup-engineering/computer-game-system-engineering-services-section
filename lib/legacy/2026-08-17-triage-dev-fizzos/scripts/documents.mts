/**
 * Document morphisms for FizzOS package-bin scripts.
 *
 * Each export is a pure `(document) => document` over the engine: it decodes one JSON
 * boundary document with `@emsenn/fizzos/encoding`, calls a `@emsenn/fizzos` module
 * function (the turn `(world, commands) → (world', perceptions)`), and encodes one
 * canonical JSON boundary document back. The thin bins (`./fizzos-*.mjs`) only bind
 * these to the process boundary; the host's `servePackageBins` projects the same
 * documents over HTTP/OpenAPI. No domain logic lives in the bins.
 */
import { LOCATED_IN, look, tell, tick, world } from "@emsenn/fizzos/engine";
import {
  decodeFacts,
  decodeProposals,
  decodeWorld,
  lookDocument,
  readDocument,
  tickDocument,
  worldDocument,
  writeDocument,
} from "@emsenn/fizzos/encoding";
import { isJsonRecord, type JsonRecord, type JsonValue } from "@emsenn/relating/writing";

function requestRecord(document: string): JsonRecord {
  const value = readDocument(document);
  if (!isJsonRecord(value)) throw new TypeError("fizzos: request document must be a JSON object");
  return value;
}

function requireField(record: JsonRecord, key: string): JsonValue {
  const value = record[key];
  if (value === undefined) throw new TypeError(`fizzos: request is missing required field ${key}`);
  return value;
}

function optionalString(record: JsonRecord, key: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new TypeError(`fizzos: ${key} must be a string`);
  return value;
}

function functionalSet(record: JsonRecord): ReadonlySet<string> | undefined {
  const value = record["functional"];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new TypeError("fizzos: functional must be an array of predicate names");
  return new Set(value.map((entry, i) => {
    if (typeof entry !== "string") throw new TypeError(`fizzos: functional[${i}] must be a string`);
    return entry;
  }));
}

/** `{ facts: [{e,a,v,charge?}] }` → the freshly settled world. */
export function worldMorphism(document: string): string {
  const record = requestRecord(document);
  return writeDocument(worldDocument(world(decodeFacts(requireField(record, "facts")))));
}

/** `{ world, facts: [{e,a,v,charge?}] }` → the next world after a told frontier. */
export function tellMorphism(document: string): string {
  const record = requestRecord(document);
  const w = decodeWorld(requireField(record, "world"));
  return writeDocument(worldDocument(tell(w, decodeFacts(requireField(record, "facts")))));
}

/** `{ world, actor, predicate? }` → the look: perceived fiber + observed CGS arena. */
export function lookMorphism(document: string): string {
  const record = requestRecord(document);
  const w = decodeWorld(requireField(record, "world"));
  const actor = optionalString(record, "actor");
  if (actor === undefined) throw new TypeError("fizzos: look requires an actor");
  return writeDocument(lookDocument(look(w, actor, optionalString(record, "predicate") ?? LOCATED_IN)));
}

/** `{ world, proposals: [...], functional? }` → one next world + the H^1 contention witness. */
export function tickMorphism(document: string): string {
  const record = requestRecord(document);
  const w = decodeWorld(requireField(record, "world"));
  const proposals = decodeProposals(requireField(record, "proposals"));
  const functional = functionalSet(record);
  return writeDocument(tickDocument(functional === undefined ? tick(w, proposals) : tick(w, proposals, functional)));
}
