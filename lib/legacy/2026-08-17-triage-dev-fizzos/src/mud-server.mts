/**
 * `@emsenn/fizzos/mud-server` — the live text-MUD server, on the upstream session carrier.
 *
 * A text MUD is line-in, lines-out per player — exactly what
 * `@emsenn/organizing-with-the-web/session-carrier` transports: `POST /session` logs you
 * in (name → a stable actor, a bearer token), `POST /input` queues a command line, and
 * `GET /stream` is your SSE of output lines. We do not hand-roll identity or a socket; we
 * inherit them. FizzOS supplies only the *game*: a tick loop that drains the queued
 * commands into the sole-writer scene and emits each player's events to *their* session —
 * which is the perception fiber, since the scene already addresses every event to an actor.
 *
 * Identity is the player's name (optionally a secret), resolved to a deterministic actor
 * id, so reconnecting — even after a restart — returns the same character and the same view.
 */
import { createQueuedWebSessionCarrier, type QueuedWebSessionCarrier } from "@emsenn/organizing-with-the-web/session-carrier";
import { type App, type Repr, jsonRepr, mergeApps } from "@emsenn/http-server";
import { FizzosScene, type CommandIntent, type SceneSnapshot } from "./scene.mjs";
import { type Bible, loadBible, startRoomOf } from "./world-load.mjs";
import type { GameDefinition } from "./game.mjs";

/** A stable actor id from a player's display name. */
export function actorIdFor(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug === "" ? "player" : `player-${slug}`;
}

export interface FizzosMudOptions {
  readonly snapshot?: SceneSnapshot;
  readonly intervalMs?: number;
  /** Flood control: the most commands one actor may run in a single tick (default 4). */
  readonly maxCommandsPerTick?: number;
  /** The game that parameterizes the engine (closure rules, fields, affordances). Defaults to Farstone. */
  readonly game?: GameDefinition;
  readonly paths?: { readonly session?: string; readonly input?: string; readonly stream?: string; readonly events?: string };
}

/** The default per-actor command budget per tick — ~20 cmd/s at a 200ms frame, far above human play. */
export const DEFAULT_MAX_COMMANDS_PER_TICK = 4;

/**
 * Flood control for the sole-writer tick: keep at most `cap` commands per actor this tick,
 * preserving order, and report which actors were throttled. Without this, a client could
 * enqueue thousands of lines and a single tick would run them all — starving the
 * authoritative loop. The dropped overflow is simply not run this tick (the client may
 * resend); throttling is per-tick, so a throttled actor is unblocked on the next frame.
 */
export function throttleIntents(
  intents: readonly CommandIntent[],
  cap: number,
): { kept: CommandIntent[]; throttled: readonly string[] } {
  const seen = new Map<string, number>();
  const kept: CommandIntent[] = [];
  const throttled = new Set<string>();
  for (const intent of intents) {
    const count = seen.get(intent.actor) ?? 0;
    if (count < cap) {
      kept.push(intent);
      seen.set(intent.actor, count + 1);
    } else {
      throttled.add(intent.actor);
    }
  }
  return { kept, throttled: [...throttled] };
}

export interface FizzosMud {
  /** The web-server App (login `/session`, input `/input`, stream `/stream`). */
  readonly app: App;
  readonly scene: FizzosScene;
  readonly carrier: QueuedWebSessionCarrier<CommandIntent>;
  /** Advance one tick: drain queued commands, settle the world, emit each player's lines. */
  step(): void;
  /** Begin the interval tick loop (the sole writer). */
  start(intervalMs?: number): void;
  stop(): void;
  snapshot(): SceneSnapshot;
}

/** Build the live text-MUD server on the upstream session carrier. */
export function createFizzosMud(bible: Bible, options: FizzosMudOptions = {}): FizzosMud {
  const { world, content } = loadBible(bible);
  const scene = new FizzosScene(world, content, startRoomOf(bible), options.game);
  if (options.snapshot !== undefined) scene.restore(options.snapshot);

  const carrier = createQueuedWebSessionCarrier<CommandIntent>({
    login: ({ name }) => ({ session: actorIdFor(name) }),
    validateInput: (input) =>
      typeof input.line === "string" && input.line.trim() !== "" ? { k: "command", actor: input.session, line: input.line } : null,
    // On connect, greet the player; the client auto-sends `look` so the join happens
    // through the normal tick (the tick stays the sole writer).
    streamSeed: (session) => ({ out: [`Welcome to Farstone, ${session.replace(/^player-/, "")}. Type 'look' to see, 'help' for commands.`] }),
    ...(options.paths === undefined ? {} : { paths: options.paths }),
  });

  let tick = 0;
  // Observability: live server health and operational metrics, no auth, JSON.
  const opsApp: App = {
    resources: [{
      match: (path: string) => path === "/health" || path === "/metrics",
      methods: ["GET"],
      produces: ["application/json"],
      handler: async (): Promise<Repr> => jsonRepr({ status: "ok", ticks: tick, ...scene.metrics() }),
    }],
  };
  const app = mergeApps(opsApp, carrier.app);

  const cap = options.maxCommandsPerTick ?? DEFAULT_MAX_COMMANDS_PER_TICK;
  const step = (): void => {
    const { kept, throttled } = throttleIntents(carrier.drainInput(), cap);
    const { events } = scene.runTick(tick++, kept);
    const byActor = new Map<string, string[]>();
    for (const event of events) {
      const lines = byActor.get(event.to) ?? [];
      lines.push(event.text);
      byActor.set(event.to, lines);
    }
    // Tell flooded actors to ease off — their overflow was not run this tick.
    for (const actor of throttled) byActor.set(actor, [...(byActor.get(actor) ?? []), "[You're sending commands too fast — slow down.]"]);
    for (const [actor, lines] of byActor) void carrier.emitOutput(actor, lines, { refreshState: false });
  };

  let timer: ReturnType<typeof setInterval> | undefined;
  return Object.freeze({
    app,
    scene,
    carrier,
    step,
    start(intervalMs = options.intervalMs ?? 200) {
      timer = setInterval(step, intervalMs);
      timer.unref?.();
    },
    stop() {
      if (timer !== undefined) clearInterval(timer);
    },
    snapshot: () => scene.snapshot(),
  });
}
