// Type declarations for @red-cup-engineering/parlor-kernel/board.

export type EdgeKind = 'move' | 'chute' | 'ladder';

export interface BoardEdge {
  readonly from: number;
  readonly to: number;
  readonly kind: EdgeKind;
  readonly delta: number;
}

export interface JumpSpec {
  readonly from: number;
  readonly to: number;
}

export interface Board {
  readonly size: number;
  readonly jumps: ReadonlyMap<number, BoardEdge>;
}

export interface ResolveMoveResult {
  readonly from: number;
  readonly preJump: number;
  readonly landedAt: number;
  readonly jumped: boolean;
  readonly jumpKind: 'chute' | 'ladder' | null;
  readonly path: readonly number[];
}

export function createBoard(size: number, jumps?: readonly JumpSpec[]): Board;
export function edgesFrom(board: Board, node: number): BoardEdge[];
export function jumpAt(board: Board, node: number): BoardEdge | undefined;
export function resolveMove(board: Board, from: number, steps: number): ResolveMoveResult;
export function reachableNodes(board: Board, start: number): number[];
