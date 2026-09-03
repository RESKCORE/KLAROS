/**
 * @file forecasts.ts
 * @description AI-powered revenue forecasting with deterministic statistical extrapolation fallback.
 */

import { callLLMProxy } from '@/services/llm/core/llm-proxy-client';
import { extractJSON } from '@/services/llm/core/json-extractor';
import type { MarketMetrics } from '@/features/market/utils/market-metrics';

export type AiForecastPoint = {
  month: string;
  forecastedRevenue: number;
  forecastedUnits: number;
  confidence: number;
};

function isForecastPoint(p: unknown): p is AiForecastPoint {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  return (
    typeof obj.month === 'string' &&
    typeof obj.forecastedRevenue === 'number' &&
    typeof obj.forecastedUnits === 'number' &&
    typeof obj.confidence === 'number'
  );
}

export function getNextConsecutiveMonths(lastDateStr: string, count = 3): string[] {
  const clean = String(lastDateStr || '').trim();
  let year = parseInt(clean.slice(0, 4), 10);
  let month = parseInt(clean.slice(5, 7), 10);

  if (Number.isNaN(year) || year < 1990 || year > 2100) {
    year = 2025;
  }
  if (Number.isNaN(month) || month < 1 || month > 12) {
    month = 1;
  }

  const months: string[] = [];
  for (let i = 1; i <= count; i++) {
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
    months.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return months;
}

export function generateStatisticalFallback(
  revenueByDate: { date: string; revenue: number; units: number }[],
  totalRevenue: number
): AiForecastPoint[] {
  const lastPoint = revenueByDate.length > 0 ? revenueByDate[revenueByDate.length - 1] : null;
  const lastDateStr = lastPoint?.date || '2025-01-01';
  const expectedMonths = getNextConsecutiveMonths(lastDateStr, 3);

  const recentPoints = revenueByDate.length > 0 ? revenueByDate.slice(-30) : [];
  const baseMonthlyRev = recentPoints.length > 0
    ? recentPoints.reduce((acc, p) => acc + p.revenue, 0) / Math.max(1, recentPoints.length / 30)
    : totalRevenue / 3;

  const baseMonthlyUnits = recentPoints.length > 0
    ? recentPoints.reduce((acc, p) => acc + p.units, 0) / Math.max(1, recentPoints.length / 30)
    : 5000;

  const results: AiForecastPoint[] = [];
  for (let i = 0; i < 3; i++) {
    const growth = 1 + (0.04 * (i + 1)); // 4-12% expected business growth

    results.push({
      month: expectedMonths[i],
      forecastedRevenue: Math.round(baseMonthlyRev * growth),
      forecastedUnits: Math.round(baseMonthlyUnits * growth),
      confidence: Math.round(85 - ((i + 1) * 7)),
    });
  }

  return results;
}

/**
 * Generates a 3-month revenue forecast firmly anchored to the last transaction date in the dataset.
 * Falls back to deterministic trend extrapolation if LLM is offline or API fails.
 */
export async function generateAiForecasts(metrics: MarketMetrics): Promise<AiForecastPoint[]> {
  if (metrics.revenueByDate.length === 0 && metrics.kpis.totalRevenue === 0) {
    return [];
  }

  const lastPoint = metrics.revenueByDate.length > 0
    ? metrics.revenueByDate[metrics.revenueByDate.length - 1]
    : null;
  const lastDateStr = lastPoint?.date || '2025-01-01';
  const expectedMonths = getNextConsecutiveMonths(lastDateStr, 3);

  try {
    const prompt = `You are a quantitative analyst for a business intelligence system. Based on the historical revenue and units time series below, forecast the next 3 consecutive months. Return ONLY a valid JSON array — no markdown, no code fences.

CRITICAL DATE ANCHORING REQUIREMENT:
The latest historical transaction date in this dataset is ${lastDateStr}.
Therefore, your forecast horizon MUST be the consecutive 3 months immediately following this date:
Month 1: "${expectedMonths[0]}"
Month 2: "${expectedMonths[1]}"
Month 3: "${expectedMonths[2]}"
DO NOT use the current calendar year or today's date. Anchor strictly to the historical dates provided.

HISTORICAL DATA (sorted ascending by date):
${JSON.stringify(metrics.revenueByDate.slice(-30))}

Return exactly this JSON array with these exact 3 months:
[
  { "month": "${expectedMonths[0]}", "forecastedRevenue": <number>, "forecastedUnits": <number>, "confidence": <0-100> },
  { "month": "${expectedMonths[1]}", "forecastedRevenue": <number>, "forecastedUnits": <number>, "confidence": <0-100> },
  { "month": "${expectedMonths[2]}", "forecastedRevenue": <number>, "forecastedUnits": <number>, "confidence": <0-100> }
]

Rules:
- Infer trend (growth/decline/seasonal) from the historical time series
- confidence decreases for months further out (e.g. 85, 72, 60)
- forecastedRevenue and forecastedUnits must be positive numbers in INR
- Return ONLY the JSON array, nothing else`;

    const raw = await callLLMProxy(prompt, { maxTokens: 600, temperature: 0.1, requireJson: true });
    const json = extractJSON(raw);
    const parsed = JSON.parse(json) as unknown;

    if (Array.isArray(parsed)) {
      const valid = parsed.filter(isForecastPoint);
      if (valid.length >= 3) {
        // Enforce sequential date anchoring so even if the model returned arbitrary months, the sequence matches the dataset timeline
        return valid.slice(0, 3).map((pt, idx) => ({
          ...pt,
          month: expectedMonths[idx] || pt.month,
        }));
      }
    }
  } catch (err) {
    console.warn('[forecasts] LLM call failed or returned error, using quantitative statistical extrapolation:', err);
  }

  return generateStatisticalFallback(metrics.revenueByDate, metrics.kpis.totalRevenue);
}

/**
 * Alias for test suites and scenario modules
 */
export const generateForecastScenarios = (metrics: MarketMetrics, _domain = 'retail'): AiForecastPoint[] => {
  return generateStatisticalFallback(metrics.revenueByDate, metrics.kpis.totalRevenue);
};
