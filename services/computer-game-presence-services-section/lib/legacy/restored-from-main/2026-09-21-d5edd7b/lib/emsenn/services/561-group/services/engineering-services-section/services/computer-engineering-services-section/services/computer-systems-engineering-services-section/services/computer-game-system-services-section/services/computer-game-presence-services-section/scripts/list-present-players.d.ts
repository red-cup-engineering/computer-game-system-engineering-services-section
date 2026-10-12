import type { PresenceDirectory } from "../src/presence-directory.d.ts";
import type { PresenceSession } from "../src/session.d.ts";

export function listPresentPlayers(directory: PresenceDirectory, gameId?: string): PresenceSession[];
