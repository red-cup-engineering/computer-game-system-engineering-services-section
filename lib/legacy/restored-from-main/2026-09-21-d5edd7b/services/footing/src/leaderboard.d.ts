// Type declarations for @red-cup-engineering/footing/leaderboard.

export interface ScoreLike {
  readonly runId: string;
  readonly actor: string;
  readonly score: number;
  readonly endedAtTick: number;
  readonly submittedAt: string; // ISO instant -- server bookkeeping only, never game logic
}

export interface RankedEntry extends ScoreLike {
  readonly rank: number;
}

export function rankLeaderboard(entries: readonly ScoreLike[]): RankedEntry[];
