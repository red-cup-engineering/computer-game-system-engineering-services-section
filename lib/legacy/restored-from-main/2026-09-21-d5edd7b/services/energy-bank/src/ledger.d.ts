// Type declarations for @red-cup-engineering/energy-bank/ledger.

/** One side of a transaction: an account path and a signed amount in a commodity. */
export interface Posting {
  readonly account: string;
  /** Signed decimal as a string (e.g. "4.99", "-4.99") — exact, never a float. */
  readonly amount: string;
  readonly commodity: string;
}

/** One append-only journal entry: a dated, narrated, balanced set of postings. */
export interface LedgerEntry {
  readonly date: string;
  readonly narration: string;
  readonly postings: readonly Posting[];
  /** Idempotency key, cross-referencing the source order/claim/intent-log entry. */
  readonly ref: string;
}

export interface AuditReport {
  readonly entries: number;
  readonly balanced: boolean;
  readonly malformed: number;
  /** account → commodity → formatted balance, independently recomputed from postings. */
  readonly balances: Record<string, Record<string, string>>;
  readonly journal: string;
}

/** The contract every ledger implementation satisfies. `record` is the only write path and
 *  throws on an unbalanced entry; `all`/`audit` never trust a cached total, only postings. */
export interface Ledger {
  record(entry: LedgerEntry): void;
  has(ref: string): boolean;
  all(): readonly LedgerEntry[];
  audit(): AuditReport;
}

/** Render entries to canonical hledger journal text — the portable, replayable artifact. */
export function journalText(entries: readonly LedgerEntry[]): string;

/** The in-memory, append-only reference implementation of `Ledger`. */
export class MemoryLedger implements Ledger {
  constructor(initial?: readonly LedgerEntry[]);
  all(): readonly LedgerEntry[];
  record(entry: LedgerEntry): void;
  has(ref: string): boolean;
  audit(): AuditReport;
  toJSON(): readonly LedgerEntry[];
}

/** Build a `Ledger`. `initial` seeds the entry list without validation. */
export function createLedger(initial?: readonly LedgerEntry[]): Ledger;
