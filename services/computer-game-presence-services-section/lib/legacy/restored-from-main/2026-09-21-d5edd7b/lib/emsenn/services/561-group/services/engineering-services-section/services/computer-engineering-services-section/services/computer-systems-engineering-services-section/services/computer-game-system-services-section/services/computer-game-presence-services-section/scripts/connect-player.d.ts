import type { PresenceDirectory, PresenceClient } from "../src/presence-directory.d.ts";
import type { PresenceSession } from "../src/session.d.ts";

export function connectPlayer(
  directory: PresenceDirectory,
  params: { gameId: string; playerId: string; displayName?: string; kind?: "human" | "agent"; client: PresenceClient },
): { key: string; session: PresenceSession };
