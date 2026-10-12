// Type declarations for @red-cup-engineering/footing/store.

export interface Move {
  readonly tick?: number; // optional: some games (durante) derive tick internally, never on the move
  readonly seq: number;
  readonly intent: unknown;
}

export interface RunRecord {
  readonly runId: string;
  readonly date: string;
  readonly actor: string;
  readonly entrantKind?: 'human' | 'agent';
  readonly mode: 'scored' | 'practice';
  readonly seed: string; // hex, canonical -- always server-derived, never client-trusted
  readonly moves: readonly unknown[];
  readonly endedAt: { readonly tick: number; readonly reason: string };
  readonly score: number | null;
  readonly submittedAt: string; // ISO instant -- server bookkeeping timestamp
}

export interface ScoreRecord {
  readonly runId: string;
  readonly date: string;
  readonly actor: string;
  readonly entrantKind?: 'human' | 'agent';
  readonly score: number;
  readonly endedAtTick: number;
  readonly reason: string;
  readonly submittedAt: string;
}

// DailyStore -- the synchronous, node:fs-backed interface openFileDailyStore(root) satisfies.
// See store-factory.d.ts's AsyncStore for the Promise-returning mirror of this same surface.
export interface DailyStore {
  readonly root: string;
  appendRun(rec: RunRecord): void;
  readRunsForDate(date: string): RunRecord[];
  readRunById(date: string, runId: string): RunRecord | null;
  appendScore(rec: ScoreRecord): void;
  readScoresForDate(date: string): ScoreRecord[];
  listRunDates(): string[];
  listScoreDates(): string[];
  hasScoredLock(date: string, actor: string): boolean;
  writeScoredLock(date: string, actor: string, runId: string): void;
}

export function openFileDailyStore(root: string): DailyStore;
