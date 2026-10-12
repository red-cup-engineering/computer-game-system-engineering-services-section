import type { PresenceSession } from "./session.d.ts";
import type { ChannelRegistry } from "./channel.d.ts";
import type { Tell } from "./tell.d.ts";
import type { PresenceLogEntry } from "./log.d.ts";

export interface PresenceClient {
  send(obj: unknown): boolean;
}

export interface PresenceDirectory {
  connect(input: {
    gameId: string;
    playerId: string;
    displayName?: string;
    kind?: "human" | "agent";
    client: PresenceClient;
  }): { key: string; session: PresenceSession };
  disconnect(key: string): PresenceSession | null;
  subscribeToChannel(key: string, channelName: string): void;
  broadcastToChannel(
    channelName: string,
    fromKey: string,
    message: unknown,
  ): { delivered: number; envelope: { channel: string; from: string; message: unknown; at: number } };
  sendTell(fromKey: string, toKey: string, body: string): { delivered: boolean; tell: Tell };
  listPresentPlayers(gameId?: string): PresenceSession[];
  log(): PresenceLogEntry[];
  channels(): ChannelRegistry;
  hub: unknown;
}

export function createPresenceDirectory(): PresenceDirectory;
