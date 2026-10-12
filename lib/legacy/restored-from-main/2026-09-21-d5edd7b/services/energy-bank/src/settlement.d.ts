// Type declarations for @red-cup-engineering/energy-bank/settlement.
import type { AccountId } from "./accounts.d.ts";
import type { Ledger } from "./ledger.d.ts";

export interface SettlementRequest {
  readonly id: string;
  readonly account: AccountId;
  /** In the backend's native commodity (USD, HIVE, SATS, …) — never ENERGY. */
  readonly amount: string;
  readonly commodity: string;
  /** "purchase" = money in; "payout" = ENERGY redeemed out. */
  readonly direction: "purchase" | "payout";
}

export interface IntentResult {
  readonly provider: string;
  readonly requestId: string;
  /** e.g. a Lightning invoice, a client_secret — whatever the client needs to act on. */
  readonly instructions: Record<string, unknown>;
}

export interface SettleResult {
  readonly cleared: boolean;
  readonly detail: string;
}

export interface SettlementBackend {
  readonly id: string;
  readonly configured: boolean;
  createIntent(request: SettlementRequest): Promise<IntentResult>;
  /** Verify the money moved (purchase) or authorize + execute the payout (payout direction).
   *  `evidence` is a webhook body, a polled result, or unused, exactly as flickering-delve's
   *  three adapters vary today. */
  settle(request: SettlementRequest, evidence?: unknown): Promise<SettleResult>;
}

export const mockBackend: SettlementBackend;

export interface ZbdConfig {
  readonly apiKey?: string | undefined;
}

/** A ZBD/Lightning-shaped settlement backend STUB. Neither method makes a network call under
 *  any configuration. */
export function zbdBackend(config?: ZbdConfig): SettlementBackend;

/** The best backend for a request: the requested one if configured, else the first other
 *  configured backend, else `mock` if present. */
export function resolveBackend(backends: readonly SettlementBackend[], requestedId?: string): SettlementBackend;

export function availableBackends(
  backends: readonly SettlementBackend[],
): readonly { readonly id: string; readonly configured: boolean }[];

/** Settle a request against a backend, and — only once actually cleared — record the
 *  real-money side to the ledger, idempotently keyed on `request.id`. A `"payout"` is
 *  simulated against a scratch copy of the ledger first and refused if it would break
 *  `verifyPayoutInvariant`; nothing about `ledger` is mutated when refused. */
export function authorizeSettlement(
  ledger: Ledger,
  backend: SettlementBackend,
  request: SettlementRequest,
  date: string,
  evidence?: unknown,
): Promise<SettleResult>;
