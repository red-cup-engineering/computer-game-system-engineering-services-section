// Type declarations for @red-cup-engineering/footing/bucket-store.

import type { RunRecord, ScoreRecord } from './store.d.ts';
import type { GcsRequestFn, GoogleApiRequestOptions } from './gcs-client.d.ts';

export type { GoogleApiToken, GoogleApiRequestOptions, GcsRequestFn, GcsClientOptions, StoredObject, PutObjectResult, GcsClient } from './gcs-client.d.ts';
export { createGoogleApiRequest, createGcsClient } from './gcs-client.d.ts';

// AsyncStore -- method-for-method mirror of store.d.ts's DailyStore, every return type wrapped
// in Promise. writeScoredLock's contract gains one clause the sync file-store never needed: it
// REJECTS if another caller already holds the lock (GCS's atomic create-only semantics) --
// file-store's single-process posture never had concurrent-process writers to arbitrate between.
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

export interface BucketStoreOptions {
  readonly bucket: string;
  readonly root?: string; // object-name prefix; "" (default) means no prefix
  readonly apiBase?: string;
  readonly request?: GcsRequestFn;
  readonly googleApiRequestOptions?: GoogleApiRequestOptions;
}

export function openBucketDailyStore(opts: BucketStoreOptions): AsyncStore;
