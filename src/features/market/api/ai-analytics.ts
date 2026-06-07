import type { MarketMetrics } from '@/features/market/utils/market-metrics';
import {
  generateAiInsightsFromMetrics,
  generateAiNarrative,
  generateAiForecasts,
  hasApiKey,
  type AiStructuredInsight,
  type AiForecastPoint,
} from '@/services/llm/llm-service';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type AiAnalytics = {
  narrative: string;
  executiveSummary: string;
  opportunities: AiStructuredInsight['opportunities'];
  riskAlerts: AiStructuredInsight['risk_alerts'];
  anomalies: AiStructuredInsight['anomalies'];
  forecasts: AiForecastPoint[];
  dataQualityNote?: string;
  generatedAt: string;
};

// ─── Cache ─────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v1';
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 hour

function cacheKey(dataSourceId: string): string {
  // Round to current hour so results are stable within a session
  const hourBucket = Math.floor(Date.now() / CACHE_TTL_MS);
  return `klaros:ai-analytics:${CACHE_VERSION}:${dataSourceId}:${hourBucket}`;
}

function readCache(key: string): AiAnalytics | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as AiAnalytics) : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: AiAnalytics): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

// In-memory dedup: prevents parallel identical fetches
const inFlight = new Map<string, Promise<AiAnalytics>>();

// ─── Main Function ─────────────────────────────────────────────────────────────

export async function getAiAnalytics(
  dataSourceId: string,
  metrics: MarketMetrics,
): Promise<AiAnalytics> {
  const key = cacheKey(dataSourceId);

  // 1. Check localStorage cache
  const cached = readCache(key);
  if (cached) {
    console.log('[AiAnalytics] ✅ Returning cached result');
    return cached;
  }

  // 2. Dedup in-flight requests
  const existing = inFlight.get(key);
  if (existing) {
    console.log('[AiAnalytics] Deduping in-flight request');
    return existing;
  }

  // 3. Run all 3 AI calls in parallel
  const promise = (async (): Promise<AiAnalytics> => {
    console.log('[AiAnalytics] 🤖 Running AI analytics in parallel...');

    const [insightsResult, narrativeResult, forecastsResult] = await Promise.allSettled([
      generateAiInsightsFromMetrics(metrics),
      generateAiNarrative(metrics),
      generateAiForecasts(metrics),
    ]);

    const insights = insightsResult.status === 'fulfilled'
      ? insightsResult.value
      : null;
    const narrative = narrativeResult.status === 'fulfilled'
      ? narrativeResult.value
      : '';
    const forecasts = forecastsResult.status === 'fulfilled'
      ? forecastsResult.value
      : [];

    if (insightsResult.status === 'rejected') {
      console.error('[AiAnalytics] Insights failed:', insightsResult.reason);
    }
    if (narrativeResult.status === 'rejected') {
      console.error('[AiAnalytics] Narrative failed:', narrativeResult.reason);
    }
    if (forecastsResult.status === 'rejected') {
      console.error('[AiAnalytics] Forecasts failed:', forecastsResult.reason);
    }

    const result: AiAnalytics = {
      narrative,
      executiveSummary: insights?.executive_summary ?? '',
      opportunities: insights?.opportunities ?? [],
      riskAlerts: insights?.risk_alerts ?? [],
      anomalies: insights?.anomalies ?? [],
      forecasts,
      dataQualityNote: insights?.data_quality_note,
      generatedAt: new Date().toISOString(),
    };

    writeCache(key, result);
    inFlight.delete(key);
    console.log('[AiAnalytics] ✅ AI analytics ready');
    return result;
  })();

  inFlight.set(key, promise);
  return promise;
}

export function hasAiApiKey(): boolean {
  return hasApiKey();
}
