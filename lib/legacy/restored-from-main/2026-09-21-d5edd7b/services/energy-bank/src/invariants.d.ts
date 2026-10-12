// Type declarations for @red-cup-engineering/energy-bank/invariants.
import type { Ledger } from "./ledger.d.ts";

export interface Violation {
  readonly rule: string;
  readonly account?: string;
  readonly commodity?: string;
  readonly detail: string;
}

export function checkBooksBalance(ledger: Ledger): readonly Violation[];

export function checkNoNegativeBalances(
  ledger: Ledger,
  options?: { readonly scope?: string; readonly creditLines?: ReadonlySet<string> },
): readonly Violation[];

export function verifyPayoutInvariant(ledger: Ledger): { readonly holds: boolean; readonly detail: string };

export function checkPayoutInvariant(ledger: Ledger): readonly Violation[];

export function checkAll(
  ledger: Ledger,
  options?: { readonly negativeBalanceScope?: string; readonly creditLines?: ReadonlySet<string> },
): readonly Violation[];
