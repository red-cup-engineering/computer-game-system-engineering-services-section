import type { DailyStore, RunRecord, ScoreRecord } from './store.d.ts';

export interface AsyncStore {
  readonly root: string;
  appendRun(rec: RunRecord): Promise<void>;
  readRunsForDate(date: string): Promise<RunRecord[]>;
  readRunById(date: string, runId: string): Promise<RunRecord | null>;
  appendScore(rec: ScoreRecord): Promise<void>;
  readScoresForDate(date: string): Promise<ScoreRecord[]>;
  listRunDates(): Promise<string[]>;
  listScoreDates(): Promise<string[]>;
  hasScoredLock(date: string, actor: string): Promise<boolean>;
  writeScoredLock(date: string, actor: string, runId: string): Promise<void>;
}

export function asAsyncDailyStore(store: DailyStore): AsyncStore;
export function openDailyStoreAuto(root: string): AsyncStore;
