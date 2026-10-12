/**
 * `policy/wander` — the reference deterministic policy for a text-MUD-shaped `gameState`
 * (see `../adapters/telnet.d.ts`'s `TelnetGameState`). See `wanderPolicy`'s own doc.
 */
import { say } from '../dialogue.mjs';

const REPLY_SITUATION = 'chat-idle';

/**
 * `(gameState, persona, rng) => decision` for a text-MUD adapter (see `./index.d.ts`'s `Policy`
 * contract). When `gameState.addressedLines` is non-empty, always replies to the first one with
 * a deterministic `'chat-idle'`-table line via `../dialogue.mjs#say` (not `reactTo` — a persona
 * always answers when spoken to here, unlike the runner's own probabilistic ambient-narration
 * reaction; no new dialogue situation is coined, the existing generic vocabulary is reused
 * as-is). Otherwise picks one of `gameState.room.exits` uniformly via the injected `rng`, or
 * `look` when the current room has no known exits yet.
 * @param {any} gameState the current perception.
 * @param {any} persona the persona deciding.
 * @param {any} rng a seeded rng stream (see `../runner.mjs`'s seeding).
 * @returns {any} the chosen action.
 */
export function wanderPolicy(gameState, persona, rng) {
  const addressed = gameState?.addressedLines?.[0] ?? null;
  if (addressed !== null) {
    const seed = `${persona.seed ?? persona.id}:wander-reply:${rng.int(0, 0x7fffffff)}`;
    const [line] = say(persona, REPLY_SITUATION, { seed, context: { peerName: addressed.from } });
    if (typeof line === 'string' && line.length > 0) {
      return { action: 'say', message: line, respondingTo: addressed };
    }
  }

  const exits = gameState?.room?.exits ?? [];
  if (exits.length === 0) return { action: 'look' };
  return { action: 'go', direction: rng.pick(exits) };
}
