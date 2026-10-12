// Type declarations for @red-cup-engineering/footing/gcs-retry.

export interface GcsRetryOptions {
  readonly maxAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly jitterRatio?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  readonly isRetryableStatus?: (status: number) => boolean;
  readonly onRetry?: (info: { attempt: number; maxAttempts: number; url: string; reason: string }) => void;
  readonly onExhausted?: (info: { attempts: number; url: string; reason: string }) => void;
}

export type GcsRetryRequestFn = (url: string, init?: RequestInit) => Promise<Response>;

export function withGcsRetry(request: GcsRetryRequestFn, opts?: GcsRetryOptions): GcsRetryRequestFn;
