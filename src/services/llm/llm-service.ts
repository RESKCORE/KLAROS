/**
 * @file llm-service.ts
 * @description Public barrel — re-exports everything from the refactored
 * layered architecture so existing import paths stay valid.
 *
 * ┌─ New Architecture ──────────────────────────────────────────────────────┐
 * │                                                                          │
 * │  core/                                                                   │
 * │    types.ts              — shared interfaces                             │
 * │    fetch-with-timeout.ts — AbortController wrapper                      │
 * │    backoff.ts            — sleep + exponential back-off                  │
 * │    json-extractor.ts     — hardened JSON extraction                      │
 * │    llm-proxy-client.ts   — single HTTP client → /api/llm proxy          │
 * │                                                                          │
 * │  domain/                                                                 │
 * │    insights.ts           — generateInsights, generateAiInsightsFromMetrics │
 * │                            generateAiNarrative, askQuestion              │
 * │    mcda-analysis.ts      — generateMcdaAnalysis (iterative retry)        │
 * │    data-parser.ts        — parseDatasetWithAI (injection-hardened)       │
 * │    forecasts.ts          — generateAiForecasts                           │
 * │                                                                          │
 * │  llm-service.ts (this file) — backward-compatible re-exports            │
 * │                                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

// ─── Core utilities ───────────────────────────────────────────────────────────
export { fetchWithTimeout, RequestTimeoutError } from '@/services/llm/core/fetch-with-timeout';
export { sleep, backoffMs } from '@/services/llm/core/backoff';
export { extractJSON } from '@/services/llm/core/json-extractor';
export { callLLMProxy, isProxyConfigured } from '@/services/llm/core/llm-proxy-client';
export type { LLMCallOptions, Provider, FailedAttempt } from '@/services/llm/core/types';

// ─── Domain ───────────────────────────────────────────────────────────────────
export {
  generateInsights,
  generateAiInsightsFromMetrics,
  generateAiNarrative,
  askQuestion,
  type AiStructuredInsight,
} from '@/services/llm/domain/insights';

export { generateMcdaAnalysis } from '@/services/llm/domain/mcda-analysis';

export {
  parseDatasetWithAI,
  type ParsedDataset,
} from '@/services/llm/domain/data-parser';

export {
  generateAiForecasts,
  type AiForecastPoint,
} from '@/services/llm/domain/forecasts';

// ─── Compatibility shim ───────────────────────────────────────────────────────
// The old hasApiKey() checked for VITE_* env vars in the bundle. That pattern
// is now insecure. We replace it with isProxyConfigured() which checks whether
// the /api/llm proxy endpoint is available. Callers that used hasApiKey()
// should migrate to isProxyConfigured(), but we keep the old name pointing at
// the new implementation so nothing breaks during the transition.

export { hasApiKey } from '@/services/llm/core/llm-proxy-client';
export { isProxyConfigured as getAvailableProviders } from '@/services/llm/core/llm-proxy-client';
