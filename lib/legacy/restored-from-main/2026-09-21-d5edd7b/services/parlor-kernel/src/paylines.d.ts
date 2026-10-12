// Type declarations for @red-cup-engineering/parlor-kernel/paylines.

import type { Rng } from './seed.d.ts';
import type { Reel } from './reels.d.ts';

export type Grid = readonly (readonly string[])[]; // one column (array of `rows` symbols) per reel
export type Payline = readonly number[]; // one row index per reel

export interface PaytableEntry {
  readonly [count: number]: number; // run length -> payout multiplier per unit bet-per-line
}
export interface Paytable {
  readonly [symbol: string]: PaytableEntry;
}
export interface ScatterPaytable {
  readonly [count: number]: number; // scatter count anywhere on the grid -> multiplier of totalBet
}

export function reelWindowAt(reel: Reel, stop: number, rows: number): string[];
export function spinReelWindow(rng: Rng, reel: Reel, rows: number): string[];
export function spinGrid(rng: Rng, reels: readonly Reel[], rows: number): string[][];

export interface EvaluateLineOptions {
  readonly wilds?: readonly string[];
  readonly scatter?: string | null;
  readonly minCount?: number;
}
export interface LineWin {
  readonly symbol: string;
  readonly count: number;
  readonly multiplier: number;
}
export function evaluateLine(grid: Grid, pattern: Payline, paytable: Paytable, opts?: EvaluateLineOptions): LineWin | null;

export interface EvaluateSpinOptions extends EvaluateLineOptions {
  readonly betPerLine?: number;
  readonly totalBet?: number;
  readonly scatterPaytable?: ScatterPaytable;
}
export interface SpinLineWin extends LineWin {
  readonly line: number;
  readonly payout: number;
}
export interface SpinResult {
  readonly lineWins: readonly SpinLineWin[];
  readonly lineTotal: number;
  readonly scatterCount: number;
  readonly scatterPayout: number;
  readonly totalPayout: number;
  readonly totalBet: number;
}
export function evaluateSpin(grid: Grid, paylinesSpec: readonly Payline[], paytable: Paytable, opts?: EvaluateSpinOptions): SpinResult;

export interface MultiLineSlotRTPOptions extends EvaluateSpinOptions {
  readonly scatterTriggerCount?: number;
}
export interface MultiLineSlotRTPResult {
  readonly rtp: number;
  readonly expectedPayout: number;
  readonly combinations: number;
  readonly totalBet: number;
  readonly scatterTriggerProbability: number | null;
  readonly scatterCountDistribution: ReadonlyMap<number, number>;
}
export function computeMultiLineSlotRTP(
  reels: readonly Reel[],
  rows: number,
  paylinesSpec: readonly Payline[],
  paytable: Paytable,
  opts?: MultiLineSlotRTPOptions,
): MultiLineSlotRTPResult;

export function symbolAtRowOdds(reel: Reel, row: number, rows: number, symbol: string): number;
export function computeJackpotOdds(reels: readonly Reel[], rows: number, pattern: Payline, symbol: string): number;
