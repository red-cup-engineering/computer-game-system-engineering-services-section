// Type declarations for @red-cup-engineering/energy-bank/transfer.
import type { AccountId } from "./accounts.d.ts";
import type { Ledger } from "./ledger.d.ts";

export interface TransferOptions {
  readonly narration?: string;
  /** Permit the source balance to go negative — an explicit credit line. Default false. */
  readonly allowCreditLine?: boolean;
}

/** Move `amount` of `commodity` from one account's ENERGY balance to another's, in a single
 *  balanced entry. Refuses a self-transfer, a non-positive amount, a reused ref, and (unless
 *  `allowCreditLine`) a transfer that would leave the source balance negative. */
export function transferEnergy(
  ledger: Ledger,
  from: AccountId,
  to: AccountId,
  amount: string,
  commodity: string,
  ref: string,
  date: string,
  options?: TransferOptions,
): void;

/** Fund an account's ENERGY balance from an external source. */
export function fundAccount(
  ledger: Ledger,
  source: string,
  to: AccountId,
  amount: string,
  commodity: string,
  ref: string,
  date: string,
  narration?: string,
): void;

/** Debit an account's ENERGY balance for in-game use. */
export function spendFromAccount(
  ledger: Ledger,
  from: AccountId,
  sink: string,
  amount: string,
  commodity: string,
  ref: string,
  date: string,
  options?: TransferOptions,
): void;

// ── pooling ──────────────────────────────────────────────────────────────────────────

export interface PoolMember {
  readonly account: AccountId;
  readonly shares: number;
}

/** A pool is an account (its own `liabilities:energy:*` balance) plus a pure record of member
 *  shares, used only to compute how a later distribution splits. */
export interface Pool {
  readonly account: AccountId;
  readonly members: readonly PoolMember[];
}

export function poolAccountId(namespace: string, poolLocalId: string): AccountId;
export function createPool(poolAccount: AccountId, members?: readonly PoolMember[]): Pool;
export function withMember(pool: Pool, member: PoolMember): Pool;
export function totalShares(pool: Pool): number;
export function poolDistribution(pool: Pool, amount: string): ReadonlyMap<AccountId, string>;

export function contributeToPool(
  ledger: Ledger,
  pool: Pool,
  from: AccountId,
  amount: string,
  commodity: string,
  ref: string,
  date: string,
): void;

export function distributePool(
  ledger: Ledger,
  pool: Pool,
  amount: string,
  commodity: string,
  refPrefix: string,
  date: string,
): void;

// ── selling ──────────────────────────────────────────────────────────────────────────

export function sellEnergy(
  ledger: Ledger,
  from: AccountId,
  to: AccountId,
  amount: string,
  commodity: string,
  priceMemo: string,
  ref: string,
  date: string,
): void;
