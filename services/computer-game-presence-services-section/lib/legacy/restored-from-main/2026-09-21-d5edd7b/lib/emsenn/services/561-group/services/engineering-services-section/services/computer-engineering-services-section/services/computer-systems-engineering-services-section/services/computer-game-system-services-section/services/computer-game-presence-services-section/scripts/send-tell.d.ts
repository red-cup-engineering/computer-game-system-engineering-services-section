import type { PresenceDirectory } from "../src/presence-directory.d.ts";
import type { Tell } from "../src/tell.d.ts";

export function sendTell(
  directory: PresenceDirectory,
  fromKey: string,
  toKey: string,
  body: string,
): { delivered: boolean; tell: Tell };
