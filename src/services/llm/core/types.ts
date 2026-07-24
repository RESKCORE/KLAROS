/**
 * @file types.ts
 * @description Shared type contracts for the LLM service layer.
 * Keeping types in a single, import-only file ensures every layer
 * (providers, dispatcher, domain) uses the same surface area with
 * no circular dependencies.
 */

/** The three supported LLM backend providers, in fallback priority order. */
export type Provider = 'groq' | 'openrouter' | 'gemini';

/** Options forwarded to every LLM call. */
export interface LLMCallOptions {
  /** Hard ceiling on tokens in the completion. */
  maxTokens?: number;
  /** Sampling temperature; 0 = deterministic, 1 = creative. */
  temperature?: number;
  /**
   * When true the caller guarantees it will parse the response as JSON.
   * Some providers (e.g. Gemini) can enforce structured output when this flag
   * is set, reducing hallucinated non-JSON wrappers.
   */
  requireJson?: boolean;
}

/** A single entry in the fallback attempt log. */
export interface FailedAttempt {
  provider: Provider | string;
  model: string;
  error: string;
  /** HTTP status if the failure came from the network layer; undefined for timeouts/errors. */
  status?: number;
}
