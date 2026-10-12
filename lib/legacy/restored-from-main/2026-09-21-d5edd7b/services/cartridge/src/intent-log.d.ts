// Type declarations for @561-group/cartridge/intent-log.

export type Intent = Readonly<Record<string, unknown>> & { readonly kind: string };
export type GameEvent = Readonly<Record<string, unknown>> & { readonly kind: string };

export interface LogEntry<TIntent extends Intent = Intent> {
  readonly seq: number;
  readonly intent: TIntent;
  readonly ts?: number;
}

export type IntentLog<TIntent extends Intent = Intent> = readonly LogEntry<TIntent>[];

export interface IntentLogValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function isIntent(x: unknown): x is Intent;
export function isGameEvent(x: unknown): x is GameEvent;
/** The persisted compatibility protocol used by canonicalStringify. */
export const CARTRIDGE_CANONICAL_HASH_PROFILE_V1: "red-cup.cartridge.canonical-hash/1";
export function canonicalStringify(value: unknown): string;
export function validateIntentLog(data: unknown): IntentLogValidationResult;
export function encodeIntentLog<TIntent extends Intent = Intent>(log: IntentLog<TIntent>): string;
export function decodeIntentLog<TIntent extends Intent = Intent>(text: string): IntentLog<TIntent>;
export function appendEntry<TIntent extends Intent = Intent>(
  log: IntentLog<TIntent>,
  intent: TIntent,
  options?: { readonly seq?: number; readonly ts?: number },
): IntentLog<TIntent>;
