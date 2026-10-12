// Type declarations for @red-cup-engineering/parlor-kernel/tally.

export function pigRollOutcome(pip: number): 'bust' | 'continue';

export interface PigTurnResult {
  readonly turnTotal: number;
  readonly busted: boolean;
}
export function foldPigTurn(pips: readonly number[]): PigTurnResult;
export function pigBank(playerScore: number, turnTotal: number): number;

export interface FarkleScoreGroup {
  readonly face: number;
  readonly count: number;
  readonly points: number;
}
export interface FarkleHandScore {
  readonly score: number;
  readonly breakdown: readonly FarkleScoreGroup[];
}
export function scoreFarkleHand(dice: readonly number[]): FarkleHandScore;
export function farkleBust(dice: readonly number[]): boolean;

export type YachtCategory =
  | 'ones' | 'twos' | 'threes' | 'fours' | 'fives' | 'sixes'
  | 'full-house' | 'four-of-a-kind' | 'little-straight' | 'big-straight' | 'choice' | 'yacht';

export const YACHT_CATEGORIES: readonly YachtCategory[];
export function scoreYachtCategory(dice: readonly number[], category: YachtCategory): number;
