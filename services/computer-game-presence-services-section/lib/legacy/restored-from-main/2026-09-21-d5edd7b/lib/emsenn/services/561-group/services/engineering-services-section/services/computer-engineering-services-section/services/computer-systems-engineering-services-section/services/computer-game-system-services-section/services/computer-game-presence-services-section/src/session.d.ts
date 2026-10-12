export const SESSION_KINDS: Readonly<{ HUMAN: "human"; AGENT: "agent" }>;

export interface PresenceSession {
  key: string;
  gameId: string;
  playerId: string;
  displayName: string;
  kind: "human" | "agent";
  connectedAt: number;
}

export function sessionKey(gameId: string, playerId: string): string;

export function createSession(input: {
  gameId: string;
  playerId: string;
  displayName?: string;
  kind?: "human" | "agent";
  connectedAt?: number;
}): PresenceSession;

export function isSession(x: unknown): x is PresenceSession;

export function listPresent(sessions: Iterable<PresenceSession>, gameId?: string): PresenceSession[];
