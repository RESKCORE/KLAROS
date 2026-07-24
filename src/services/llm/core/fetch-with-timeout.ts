/**
 * @file fetch-with-timeout.ts
 * @description AbortController-based fetch wrapper.
 *
 * Security / Reliability rationale:
 *   - Without a timeout, a stalled LLM provider connection hangs the browser
 *     Promise chain indefinitely — potentially 2–5 minutes on mobile networks.
 *   - Using AbortController is the only spec-correct way to cancel a fetch()
 *     in-flight; setting a timer and ignoring the response is NOT sufficient
 *     because the connection stays open and wastes sockets.
 *   - We distinguish AbortError from generic network errors so the caller can
 *     log "timed out" vs "network failure" accurately.
 */

/** Default per-request timeout. 12 s is long enough for a cold-start LLM,
 *  short enough that a user doesn't wait forever when a provider is down. */
export const DEFAULT_TIMEOUT_MS = 12_000;

export class RequestTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Request to ${url} timed out after ${timeoutMs}ms`);
    this.name = 'RequestTimeoutError';
  }
}

/**
 * Fetches a resource with an automatic abort after `timeoutMs` milliseconds.
 *
 * @throws {RequestTimeoutError} when the timeout fires before the response arrives.
 * @throws {TypeError}           on genuine network failures (same as bare fetch).
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    // AbortController fires a DOMException with name 'AbortError'
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new RequestTimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timerId);
  }
}
