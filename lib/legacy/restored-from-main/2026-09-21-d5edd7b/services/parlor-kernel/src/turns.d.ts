// Type declarations for @red-cup-engineering/parlor-kernel/turns.

export interface TurnState<TData = unknown> {
  readonly players: readonly string[];
  readonly activePlayerIndex: number;
  readonly round: number;
  readonly phase: string;
  readonly data: TData;
}

export interface TurnResult<TData = unknown> {
  readonly state: TurnState<TData>;
  readonly events: readonly { readonly kind: string; readonly [key: string]: unknown }[];
}

export type TurnIntent = { readonly kind: string; readonly [key: string]: unknown };

export type TurnHandler<TData = unknown, TIntent extends TurnIntent = TurnIntent> = (
  state: TurnState<TData>,
  intent: TIntent,
) => TurnResult<TData>;

export function createTurnState<TData = unknown>(
  players: readonly string[],
  phase?: string,
  data?: TData,
): TurnState<TData>;
export function activePlayer<TData>(state: TurnState<TData>): string;
export function withData<TData>(state: TurnState<TData>, data: TData): TurnState<TData>;
export function withPhase<TData>(state: TurnState<TData>, phase: string): TurnState<TData>;
export function endTurn<TData>(state: TurnState<TData>): TurnState<TData>;
export function createTurnReducer<TData = unknown, TIntent extends TurnIntent = TurnIntent>(
  handlers: Record<string, TurnHandler<TData, TIntent>>,
): (state: TurnState<TData>, intent: TIntent) => TurnResult<TData>;
