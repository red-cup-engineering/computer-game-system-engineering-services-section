// Type declarations for @red-cup-engineering/parlor-kernel/disclosure.

export type SpendType = 'reversible' | 'priced' | 'terminal';

export function createClassifier(mapping: Record<string, SpendType>): (kind: string) => SpendType;

export interface NamedCost {
  readonly amount: number;
  readonly resource: string;
  readonly description: string;
}
export function namedCost(amount: number, resource: string, description: string): NamedCost;

export interface RuinDisclosure {
  readonly probability: number;
  readonly text: string;
}
export function ruinDisclosure(
  balance: number,
  stakeAmount: number,
  lossProbability: number,
  ruinThreshold?: number,
): RuinDisclosure;
