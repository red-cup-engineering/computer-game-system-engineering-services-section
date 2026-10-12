// Type declarations for @red-cup-engineering/footing/submission.

import type { AsyncStore } from './store-factory.d.ts';

export interface ReplayAccepted {
  readonly rejected: null;
  readonly endedAt: { readonly tick: number; readonly reason: string };
  readonly score: number | null;
}

export interface ReplayRejected {
  readonly rejected: string;
}

export type ReplayResult = ReplayAccepted | ReplayRejected;

export type ReplayFn = (
  date: string,
  submission: { readonly actor: string; readonly entrantKind: string; readonly intentLog: readonly unknown[] },
) => ReplayResult | Promise<ReplayResult>;

export interface SubmitDailyRunOptions {
  readonly store: AsyncStore;
  readonly today: string;
  readonly body: unknown;
  readonly dailySeed: (date: string) => number;
  readonly replayFn: ReplayFn;
  readonly maxLogMoves?: number;
  readonly requireEntrantKind?: boolean;
}

export interface SubmitAccepted {
  readonly rejected: null;
  readonly runId: string;
  readonly date: string;
  readonly actor: string;
  readonly entrantKind: string;
  readonly mode: 'scored' | 'practice';
  readonly endedAt: { readonly tick: number; readonly reason: string };
  readonly score: number | null;
  readonly leaderboardEligible: boolean;
  readonly runRecord: unknown;
  readonly scoreRecord: unknown | null;
}

export interface SubmitRejected {
  readonly rejected: string;
}

export type SubmitResult = SubmitAccepted | SubmitRejected;

export function submitDailyRun(opts: SubmitDailyRunOptions): Promise<SubmitResult>;
