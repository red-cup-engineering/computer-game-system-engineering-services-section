/**
 * The feltos-world readers and the one frame-building algorithm every perception frame is
 * assembled by — shared because farstone.561.group's and tidepool.emsenn.net's own perception.mts
 * files hand-rolled byte-identical copies of all of it, not just the type declarations
 * (perception-types.mts). A game supplies only what actually varies (its frame type, kind, own
 * composed clock report, and own affordances function); everything else — perceive, settle,
 * assemble, admit — happens once, here.
 */
import { contentsOf, evidenceName, perceive, settleSubject, value } from "@red-cup-engineering/feltos/world";
import type { DataType } from "@red-cup-engineering/computer-data-engine";
import { admit, type PerceptionEvent } from "./perception-types.mjs";

/** A subject's display name, falling back to its own id when it declares none. */
export function displayName(world: unknown, subject: string): string {
  const name = value(world, subject, "name");
  return typeof name === "string" ? name : subject;
}

/** A room's exits: every `exit:<direction>` cell settled positive, sorted. */
export function exitsOf(world: unknown, room: string): string[] {
  return settleSubject(world, room)
    .filter((cell) => cell.predicate.startsWith("exit:") && cell.evidence.positiveEvidence)
    .map((cell) => cell.predicate.slice(5))
    .sort();
}

export interface BuildPerceptionFrameOptions {
  /** This game's own frame type, from `createPerceptionFrameType`. */
  frameType: DataType;
  /** This game's frame kind discriminant (matches `frameType`'s own `kind` const). */
  kind: string;
  world: unknown;
  actor: string;
  tick: number;
  recentEvents?: PerceptionEvent[];
  /** This game's own already-composed clock report (whatever it reports beyond, or exactly,
   *  the shared six fields — admit() below is what actually checks it matches `frameType`). */
  clock: Record<string, unknown>;
  /** This game's own affordances function — real per-game capability logic, never shared. */
  affordancesFor: (world: unknown, actor: string, target: string) => string[];
}

/**
 * The one algorithm every feltos/qwzspace perception frame is built by: perceive() the actor's
 * subjects, settle each one's cells, compute affordances per subject, assemble the shared frame
 * shape, and admit() it against the game's own frameType before returning — never construct a
 * frame object by hand and skip the admission check.
 */
export function buildPerceptionFrame(options: BuildPerceptionFrameOptions) {
  const { frameType, kind, world, actor, tick, recentEvents = [], clock, affordancesFor } = options;
  const view = perceive(world, actor);
  const place = view.place;
  const occupants = place === null ? [] : contentsOf(world, place).filter((id) => id !== actor).map((id) => ({ id, name: displayName(world, id) }));
  const subjects = view.subjects.map((id) => ({
    id,
    cells: settleSubject(world, id).map((cell) => ({ predicate: cell.predicate, object: cell.object, evidence: evidenceName(cell) })),
    affordances: affordancesFor(world, actor, id),
  }));
  const frame = {
    kind,
    tick,
    actor,
    place: place === null ? null : {
      id: place,
      name: displayName(world, place),
      description: String(value(world, place, "description") ?? ""),
      exits: exitsOf(world, place),
    },
    occupants,
    subjects,
    clock,
    recentEvents,
  };
  const admitted = admit(frameType, frame);
  if (!admitted.ok) throw new Error(`feltos-perception-frame-service: perception frame shape refused: ${JSON.stringify(admitted.refusal)}`);
  // admit() validates frame against frameType without transforming it; frameType's own DataType<>
  // generic can't carry the caller's specific schema through this function's non-generic
  // `frameType: DataType` parameter, so admitted.value's inferred type is wider than reality —
  // the cast reasserts what is actually true at runtime.
  return admitted.value as typeof frame;
}

/** The qwzspace snapshot-manager entry shape: `{ id, ...buildPerceptionFrame(options) }` so `id`
 *  matches the actor subject and the whole frame rides verbatim inside snapshot.e / delta.c. */
export function perceptionSnapEntry(options: BuildPerceptionFrameOptions): { id: string } & ReturnType<typeof buildPerceptionFrame> {
  return { id: options.actor, ...buildPerceptionFrame(options) };
}
