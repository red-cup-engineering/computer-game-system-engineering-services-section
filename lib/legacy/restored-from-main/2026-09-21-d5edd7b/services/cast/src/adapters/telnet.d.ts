// Type declarations for @red-cup-engineering/cast/adapters/telnet.

import type { Socket } from 'node:net';
import type { Persona } from '../persona.d.ts';
import type { Transport } from '../runner.d.ts';

export interface RoomPerception {
  name: string | null;
  description: string;
  occupants: string[];
  exits: string[];
}

export interface AddressedLine {
  kind: 'tell' | 'say' | 'chat';
  from: string;
  text: string;
}

export interface TelnetGameState {
  room: RoomPerception | null;
  addressedLines: AddressedLine[];
  rawLines: string[];
  ended: boolean;
}

export interface TelnetAdapterConfig {
  host: string;
  port: number;
  /** Injectable socket constructor — defaults to `node:net`'s `connect(port, host)`. */
  socketFactory?: (host: string, port: number) => Socket;
  connectTimeoutMs?: number;
  /** How long the line stream must go quiet before `observe()` resolves. */
  observeQuietMs?: number;
  /** Hard cap on how long `observe()` waits for quiet, even if lines keep arriving. */
  observeMaxWaitMs?: number;
  /** Overrides the addressed-line test; defaults to `isPersonaAddressed`. */
  isAddressed?: (persona: Persona, text: string) => boolean;
}

export function isPersonaAddressed(persona: Persona, text: string): boolean;
export function parseTelnetLines(
  lines: readonly string[],
  persona: Persona,
  isAddressed?: (persona: Persona, text: string) => boolean,
): TelnetGameState;
export function telnetIntentToLine(intent: Record<string, unknown> | null | undefined): string | null;
export function createTelnetAdapter(config: TelnetAdapterConfig): Transport<TelnetGameState>;
