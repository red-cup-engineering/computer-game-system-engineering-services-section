/**
 * The agent-legible perception frame every feltos/qwzspace text game hands qwzspace as an
 * entity's render state — one domain concept, declared once through
 * `@red-cup-engineering/computer-system-engine`'s type system instead of each game re-declaring
 * (and re-drifting) the same TypeScript interfaces by hand. Farstone and tidepool both build one
 * from the same real feltos surfaces (`perceive`, `settleSubject`, `evidenceName`) and both hand
 * qwzspace the same top-level shape; the only real per-game variation is the clock, which each
 * game extends with its own fields via `specializeType`.
 *
 * `admit()`ing a constructed frame against its declared type (see `createPerceptionFrameType`)
 * is the actual point of descending from this system rather than only sharing TypeScript
 * interfaces: a shape bug is caught at runtime, in the same place every other admission refusal
 * in the house is caught, not only erased at compile time.
 */
import { admit, defineType, specializeType } from "@red-cup-engineering/computer-system-engine/type-system";

function established(result, what) {
  if (!result.ok) throw new Error(`feltos-perception-frame-service: ${what} failed to establish: ${JSON.stringify(result.refusal)}`);
  return result.value;
}

export const PerceptionCellType = established(defineType({
  id: "feltos.perception.cell@1",
  name: "Perception cell",
  description: "One settled predication cell as an agent-legible entry: predicate, object, and its FOUR evidence name.",
  schema: {
    type: "object",
    required: ["predicate", "object", "evidence"],
    properties: {
      predicate: { type: "string", minLength: 1 },
      object: {},
      evidence: { type: "string", minLength: 1 },
    },
    additionalProperties: false,
  },
  parents: [],
}), "PerceptionCellType");

export const PerceptionSubjectType = established(defineType({
  id: "feltos.perception.subject@1",
  name: "Perception subject",
  description: "One subject in an actor's interest set: its settled cells and the affordances it currently offers that actor.",
  schema: {
    type: "object",
    required: ["id", "cells", "affordances"],
    properties: {
      id: { type: "string", minLength: 1 },
      cells: { type: "array", items: PerceptionCellType.schema },
      affordances: { type: "array", items: { type: "string", minLength: 1 } },
    },
    additionalProperties: false,
  },
  parents: [],
}), "PerceptionSubjectType");

export const PerceptionEventType = established(defineType({
  id: "feltos.perception.event@1",
  name: "Perception event",
  description: "One discrete broadcast event (chat, world banner, ...) carried in a perception frame's recentEvents.",
  schema: {
    type: "object",
    required: ["tick", "channel", "text"],
    properties: {
      tick: { type: "integer" },
      channel: { type: "string", minLength: 1 },
      text: { type: "string" },
    },
    additionalProperties: false,
  },
  parents: [],
}), "PerceptionEventType");

/**
 * The clock fields every feltos world-clock reports, regardless of game. Deliberately left open
 * (`additionalProperties: true`) so a game's own clock report can `specializeType` in its own
 * extra fields (farstone's harborClosed/shellfishClosed/fireDanger) without the base declaration
 * refusing the wider value — that is what makes the intersection in `specializeType` additive
 * rather than a conflict.
 */
export const PerceptionClockType = established(defineType({
  id: "feltos.perception.clock@1",
  name: "Perception clock",
  description: "The common feltos world-clock report fields every game's perception frame carries.",
  schema: {
    type: "object",
    required: ["time", "phase", "season", "tide", "weather", "dryStreak"],
    properties: {
      time: { type: "number" },
      phase: { type: "string", minLength: 1 },
      season: { type: "string", minLength: 1 },
      tide: { type: "string", minLength: 1 },
      weather: { type: "string", minLength: 1 },
      dryStreak: { type: "integer", minimum: 0 },
    },
    additionalProperties: true,
  },
  parents: [],
}), "PerceptionClockType");

/**
 * Specialize the base clock type with a game's own extra fields. `localSchema` supplies only the
 * additional `required`/`properties` beyond the base six; the returned type's extent is the
 * intersection (a value must satisfy both).
 */
export function specializePerceptionClockType(
  id,
  name,
  description,
  localSchema,
) {
  return established(specializeType([PerceptionClockType], {
    id,
    name,
    description,
    schema: { type: "object", additionalProperties: true, ...localSchema },
  }), `specialized clock type ${id}`);
}

const PLACE_SCHEMA = {
  oneOf: [
    { type: "null" },
    {
      type: "object",
      required: ["id", "name", "description", "exits"],
      properties: {
        id: { type: "string", minLength: 1 },
        name: { type: "string" },
        description: { type: "string" },
        exits: { type: "array", items: { type: "string", minLength: 1 } },
      },
      additionalProperties: false,
    },
  ],
};

const OCCUPANT_SCHEMA = {
  type: "object",
  required: ["id", "name"],
  properties: { id: { type: "string", minLength: 1 }, name: { type: "string" } },
  additionalProperties: false,
};

/**
 * Declare one game's own top-level perception-frame type: `kindId` becomes the frame's constant
 * `kind` discriminant, `clockType` is that game's own clock type (the base `PerceptionClockType`
 * directly, or one specialized via `specializePerceptionClockType`). Every other field (place,
 * occupants, subjects, recentEvents) is the shared shape every game uses unchanged.
 */
export function createPerceptionFrameType(kindId, clockType) {
  return established(defineType({
    id: `${kindId}.frame@1`,
    name: `${kindId} perception frame`,
    description: `The agent-legible perception frame for ${kindId}.`,
    schema: {
      type: "object",
      required: ["kind", "tick", "actor", "place", "occupants", "subjects", "clock", "recentEvents"],
      properties: {
        kind: { const: kindId },
        tick: { type: "integer" },
        actor: { type: "string", minLength: 1 },
        place: PLACE_SCHEMA,
        occupants: { type: "array", items: OCCUPANT_SCHEMA },
        subjects: { type: "array", items: PerceptionSubjectType.schema },
        clock: clockType.schema,
        recentEvents: { type: "array", items: PerceptionEventType.schema },
      },
      additionalProperties: false,
    },
    parents: [],
  }), `perception frame type ${kindId}`);
}

export { admit };
