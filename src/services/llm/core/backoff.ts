/**
 * @file backoff.ts
 * @description Retry timing utilities: exponential back-off with jitter.
 *
 * Rationale:
 *   Immediately re-attempting a failed request against a rate-limited endpoint
 *   (HTTP 429) guarantees the retry also receives 429.  Exponential back-off
 *   spaces out retries; ±20% random jitter prevents "thundering herd" when
 *   multiple client sessions hit the same provider simultaneously.
 */

/** Returns a Promise that resolves after `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculates the delay in milliseconds for retry attempt `attempt` (0-indexed).
 *
 * Formula: min(baseMs * 2^attempt, capMs) * U(0.8, 1.0)
 *   attempt=0 → ~800–1000 ms
 *   attempt=1 → ~1600–2000 ms
 *   attempt=2 → ~3200–4000 ms  (capped at capMs)
 *
 * @param attempt - Zero-indexed retry number (0 = first retry after first failure).
 * @param baseMs  - Base delay in milliseconds (default 1000).
 * @param capMs   - Maximum delay ceiling (default 8000).
 */
export function backoffMs(attempt: number, baseMs = 1_000, capMs = 8_000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt), capMs);
  // Jitter: random value in [0.8, 1.0] range
  const jitter = 0.8 + Math.random() * 0.2;
  return Math.round(exponential * jitter);
}
