export const PRESENCE_EVENT_KINDS: Readonly<{
  CONNECT: "presence.connect";
  DISCONNECT: "presence.disconnect";
  SUBSCRIBE: "channel.subscribe";
  UNSUBSCRIBE: "channel.unsubscribe";
  BROADCAST: "channel.broadcast";
  TELL: "tell.send";
}>;

export interface PresenceLogEntry {
  seq: number;
  intent: { kind: string; [key: string]: unknown };
  ts?: number;
}

export function createPresenceLog(): PresenceLogEntry[];

export function appendPresenceEvent(
  log: PresenceLogEntry[],
  kind: string,
  payload?: Record<string, unknown>,
  options?: { seq?: number; ts?: number },
): PresenceLogEntry[];

export function encodeIntentLog(log: PresenceLogEntry[]): string;
export function decodeIntentLog(text: string): PresenceLogEntry[];
export function validateIntentLog(data: unknown): { valid: boolean; errors: string[] };
export function canonicalStringify(value: unknown): string;
