// Type declarations for @red-cup-engineering/footing/guard.

export const MAX_BODY_BYTES: number;
export const MAX_LOG_MOVES: number;

export function isSafeId(v: unknown): v is string;
export function isEntrantKind(v: unknown): v is 'human' | 'agent';

export type ReadBodyCappedResult = { readonly ok: true; readonly text: string } | { readonly ok: false };

// `req` is any Node Readable-shaped object ('data'/'end'/'error' events) -- deliberately untyped
// against node:http's IncomingMessage so this module has no node:http import of its own.
export function readBodyCapped(req: NodeJS.EventEmitter, maxBytes: number): Promise<ReadBodyCappedResult>;
