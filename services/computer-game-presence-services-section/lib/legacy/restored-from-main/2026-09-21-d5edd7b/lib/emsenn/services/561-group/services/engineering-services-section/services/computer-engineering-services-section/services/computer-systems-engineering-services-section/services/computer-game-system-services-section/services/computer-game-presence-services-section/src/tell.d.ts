export interface Tell {
  fromGameId: string;
  fromPlayerId: string;
  toGameId: string;
  toPlayerId: string;
  body: string;
  sentAt: number;
}

export function createTell(input: {
  fromGameId: string;
  fromPlayerId: string;
  toGameId: string;
  toPlayerId: string;
  body: string;
  sentAt?: number;
}): Tell;

export function isTell(x: unknown): x is Tell;
export function isCrossGame(tell: Pick<Tell, "fromGameId" | "toGameId">): boolean;
