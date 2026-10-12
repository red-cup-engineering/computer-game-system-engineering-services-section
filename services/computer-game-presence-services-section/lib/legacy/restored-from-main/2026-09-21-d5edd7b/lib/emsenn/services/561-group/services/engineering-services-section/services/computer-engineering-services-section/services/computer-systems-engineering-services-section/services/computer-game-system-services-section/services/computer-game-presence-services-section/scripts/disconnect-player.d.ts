import type { PresenceDirectory } from "../src/presence-directory.d.ts";
import type { PresenceSession } from "../src/session.d.ts";

export function disconnectPlayer(directory: PresenceDirectory, key: string): PresenceSession | null;
