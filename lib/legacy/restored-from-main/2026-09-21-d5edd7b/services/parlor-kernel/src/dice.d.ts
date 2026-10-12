// Type declarations for @red-cup-engineering/parlor-kernel/dice.

import type { Rng } from './seed.d.ts';

export interface RollLogEntry {
  readonly kind: 'dice-roll';
  readonly sides: number;
  readonly dice: readonly number[];
  readonly total: number;
}

export interface DiePmfEntry {
  readonly pip: number;
  readonly probability: number;
}

export interface DiceSumPmfEntry {
  readonly total: number;
  readonly ways: number;
  readonly probability: number;
}

export function rollDie(rng: Rng, sides?: number): number;
export function rollDice(rng: Rng, count: number, sides?: number): number[];
export function diceTotal(dice: readonly number[]): number;
export function faceCounts(dice: readonly number[], sides?: number): number[];
export function rollLogEntry(dice: readonly number[], sides?: number): RollLogEntry;
export function diePmf(sides?: number): DiePmfEntry[];
export function diceSumPmf(count: number, sides?: number): DiceSumPmfEntry[];
