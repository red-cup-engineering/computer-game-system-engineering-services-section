// gcs-retry -- a generic retry-with-backoff wrapper for the `(url, init) => Promise<Response>`
// shape gcs-client.mjs uses for every outbound call, ported from the byte-identical module
// Farstone and Tidepool had each independently vendored around this same transport.
//
// Only retries what's actually transient: a thrown network error, or a 5xx/408/429 response.
// 404/400/401/403/412 pass straight through untouched -- a caller's own conditional-write
// contention signal (412) must never be silently absorbed here.
//
// The actual retry loop and its delay are owned by the canonical
// @red-cup-engineering/javascript-node-services-section/retry capability; this module only
// adapts gcs-client's fetch-shaped calls to that capability's Result-shaped operation contract
// and preserves this file's historical option names (sleep/onRetry/onExhausted/jitterRatio/...).

import { retryWithBackoff } from "@red-cup-engineering/javascript-node-services-section/retry";

/**
 * @typedef {{maxAttempts?: number, baseDelayMs?: number, maxDelayMs?: number, jitterRatio?: number, sleep?: (ms: number) => Promise<void>, random?: () => number, isRetryableStatus?: (status: number) => boolean, onRetry?: (info: {attempt: number, maxAttempts: number, url: string, reason: string}) => void, onExhausted?: (info: {attempts: number, url: string, reason: string}) => void}} GcsRetryOptions
 */

function defaultIsRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function defaultOnRetry(info) {
  process.stderr.write(
    `gcs-retry: attempt ${info.attempt}/${info.maxAttempts} failed for ${info.url} (${info.reason}) — retrying\n`,
  );
}

function defaultOnExhausted(info) {
  process.stderr.write(
    `gcs-retry: GIVING UP after ${info.attempts} attempts for ${info.url} (${info.reason}) — surfacing failure, nothing was silently dropped\n`,
  );
}

/**
 * Wraps a `(url, init) => Promise<Response>` request function with bounded, jittered retry.
 * @param {(url: string, init?: RequestInit) => Promise<Response>} request
 * @param {GcsRetryOptions} [opts]
 * @returns {(url: string, init?: RequestInit) => Promise<Response>}
 */
export function withGcsRetry(request, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 4;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError("maxAttempts must be a positive integer");
  }
  const baseDelayMs = opts.baseDelayMs ?? 100;
  const maxDelayMs = opts.maxDelayMs ?? 2_000;
  const jitterRatio = opts.jitterRatio ?? 0.3;
  const random = opts.random ?? Math.random;
  const isRetryableStatus = opts.isRetryableStatus ?? defaultIsRetryableStatus;
  const onRetry = opts.onRetry ?? defaultOnRetry;
  const onExhausted = opts.onExhausted ?? defaultOnExhausted;

  return async function retryingRequest(url, init) {
    const result = await retryWithBackoff({
      operation: async () => {
        let response;
        try {
          response = await request(url, init);
        } catch (error) {
          return { ok: false, refusal: { thrown: error, reason: error instanceof Error ? error.message : String(error) } };
        }
        if (response.ok || !isRetryableStatus(response.status)) return { ok: true, value: response };
        return { ok: false, refusal: { response, reason: `HTTP ${response.status}` } };
      },
      isRetryable(refusal, attempt) {
        onRetry({ attempt, maxAttempts, url, reason: refusal.reason });
        return true; // every refusal reaching here is already transient -- operation() let non-retryable statuses through as `ok: true`
      },
      maxAttempts,
      baseDelayMs,
      backoffFactor: 2,
      maxDelayMs,
      jitter: jitterRatio,
      random,
      ...(opts.sleep ? { delay: opts.sleep } : {}),
    });

    if (result.ok) return result.value; // success, or a non-retryable status (404/400/401/403/412/...) -- pass through untouched
    const { attempts, refusal: lastRefusal } = result.refusal;
    onExhausted({ attempts, url, reason: lastRefusal.reason });
    if (lastRefusal.thrown !== undefined) throw lastRefusal.thrown;
    return lastRefusal.response; // hand back the final non-ok response; callers already know how to turn a bad status into an error
  };
}
