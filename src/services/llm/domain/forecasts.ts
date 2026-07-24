/**
 * @file forecasts.ts
 * @description AI-powered revenue forecasting domain function.
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

/**
 * Generates a 3-month revenue forecast from the last 30 data points.
 * Returns an empty array if there is insufficient history (< 3 data points).
 */
export async function generateAiForecasts(metrics: MarketMetrics): Promise<AiForecastPoint[]> {
  if (metrics.revenueByDate.length < 3) {
    return [];
  }

  const prompt = `You are a quantitative analyst for an Indian retail business. Based on the historical revenue and units time series below, forecast the next 3 months. Return ONLY a valid JSON array — no markdown, no code fences.

NOTE: Revenue values in the data are in Indian Rupees (₹). Return forecastedRevenue as a plain number in INR (no currency symbols in JSON values).

HISTORICAL DATA (sorted ascending by date):
${JSON.stringify(metrics.revenueByDate.slice(-30))}

Return exactly this JSON array (3 items for the next 3 months after the last date in the historical data):
[
  { "month": "YYYY-MM", "forecastedRevenue": <number>, "forecastedUnits": <number>, "confidence": <0-100> },
  { "month": "YYYY-MM", "forecastedRevenue": <number>, "forecastedUnits": <number>, "confidence": <0-100> },
  { "month": "YYYY-MM", "forecastedRevenue": <number>, "forecastedUnits": <number>, "confidence": <0-100> }
]

Rules:
- Infer trend (growth/decline/seasonal) from the time series
- confidence decreases for months further out (e.g. 85, 72, 60)
- forecastedRevenue and forecastedUnits must be positive numbers in INR
- Return ONLY the JSON array, nothing else`;

  const raw = await callLLMProxy(prompt, { maxTokens: 600, temperature: 0.1, requireJson: true });
  const json = extractJSON(raw);
  const parsed = JSON.parse(json) as unknown;

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isForecastPoint);
}
