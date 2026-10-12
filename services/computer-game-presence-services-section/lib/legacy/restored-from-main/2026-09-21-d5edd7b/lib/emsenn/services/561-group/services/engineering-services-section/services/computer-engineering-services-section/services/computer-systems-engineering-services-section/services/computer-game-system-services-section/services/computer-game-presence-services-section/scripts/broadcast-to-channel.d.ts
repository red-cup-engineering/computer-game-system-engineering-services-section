import type { PresenceDirectory } from "../src/presence-directory.d.ts";

export function broadcastToChannel(
  directory: PresenceDirectory,
  channelName: string,
  fromKey: string,
  message: unknown,
): { delivered: number; envelope: { channel: string; from: string; message: unknown; at: number } };
