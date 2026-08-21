/**
 * @file insights.ts
 * @description Domain functions for narrative and structured BI insights.
 *
 * These functions receive pre-computed MarketMetrics objects and generate
 * human-readable analysis using the LLM proxy.  They deliberately send only
 * a compact summary payload (≤2000 tokens) rather than the full metrics blob,
 * preventing context-window truncation on free-tier models.
 */

import { callLLMProxy } from '@/services/llm/core/llm-proxy-client';
import { extractJSON } from '@/services/llm/core/json-extractor';
import type { MarketMetrics } from '@/features/market/utils/market-metrics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AiStructuredInsight = {
  executive_summary: string;
  opportunities: { title: string; detail: string; impact: 'high' | 'medium' | 'low' }[];
  risk_alerts: { title: string; detail: string; severity: 'critical' | 'warning' | 'info' }[];
  anomalies: { metric: string; finding: string }[];
  data_quality_note?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a compact summary of MarketMetrics for prompt injection.
 * Capped at ~8 KB to stay well within the 6 000-token context window of
 * free-tier Groq models after the system prompt is accounted for.
 */
function buildMetricsSummary(metrics: MarketMetrics): string {
  const summary = {
    kpis: metrics.kpis,
    topProducts: metrics.topProducts.slice(0, 5),
    topCategories: metrics.revenueByCategory.slice(0, 3),
    paymentTopMethod: metrics.paymentMethodShare[0] ?? null,
    lowStockItems: metrics.inventory.filter((i) => i.stockRatio <= 1.2).slice(0, 3),
    dateRange: metrics.revenueByDate.length
      ? {
          from: metrics.revenueByDate[0].date,
          to: metrics.revenueByDate[metrics.revenueByDate.length - 1].date,
        }
      : null,
  };

  const json = JSON.stringify(summary, null, 2);
  if (json.length > 8_000) {
    console.warn('[insights] Metrics payload exceeds 8 KB — some context may be omitted');
  }
  return json;
}

// ─── Public Functions ─────────────────────────────────────────────────────────

/**
 * Generates a plain-text executive summary with 3-5 bullet points.
 * Used by the legacy Dashboard Q&A flow.
 */
export async function generateInsights(metricsJson: string): Promise<string> {
  const prompt = `You are a BI data analyst for an Indian retail business. Analyze the following market metrics and provide a concise executive summary with actionable insights (3-5 bullet points). Focus on revenue trends, top products, inventory risks, and investment performance.

IMPORTANT: Always use Indian Rupee (₹) for monetary values. Use Indian number format: lakhs and crores (e.g. ₹1.96 lakhs, ₹2.3 crores). Never use $ or USD.

Market Metrics:
${metricsJson}

Provide the summary in plain text with clear bullet points using ₹ for all amounts.`;

  return callLLMProxy(prompt, { maxTokens: 500, temperature: 0.3 });
}

/**
 * Generates a structured JSON insight object covering opportunities,
 * risk alerts, and anomalies detected in the retail metrics.
 */
export async function generateAiInsightsFromMetrics(metrics: MarketMetrics): Promise<AiStructuredInsight> {
  const payload = buildMetricsSummary(metrics);

  const prompt = `You are a senior retail BI analyst for an Indian business. Analyze the following market metrics data and return ONLY a valid JSON object — no markdown, no code fences, no extra text.

IMPORTANT: All monetary values in your response must use Indian Rupee format:
- Use the ₹ symbol (not $ or USD)
- Use Indian number formatting: lakhs (₹1.96 lakhs) and crores where appropriate

MARKET DATA:
${payload}

Return exactly this JSON structure (fill every field with real analysis based on the data above):
{
  "executive_summary": "3-4 sentence high-level summary of the business performance, mentioning specific numbers in ₹ Indian Rupee format",
  "opportunities": [
    { "title": "short opportunity title", "detail": "specific actionable detail with numbers in ₹", "impact": "high" },
    { "title": "short opportunity title", "detail": "specific actionable detail with numbers in ₹", "impact": "medium" },
    { "title": "short opportunity title", "detail": "specific actionable detail with numbers in ₹", "impact": "low" }
  ],
  "risk_alerts": [
    { "title": "short risk title", "detail": "specific risk detail with affected SKUs or categories, amounts in ₹", "severity": "critical" },
    { "title": "short risk title", "detail": "specific risk detail with amounts in ₹", "severity": "warning" }
  ],
  "anomalies": [
    { "metric": "metric name", "finding": "what is unusual about this metric and why it matters, amounts in ₹" }
  ],
  "data_quality_note": "optional note about data completeness or quality issues, or omit this field"
}

Rules:
- Base every insight on the actual numbers provided
- Always use ₹ for any monetary amount — never use $ or USD
- Return ONLY valid JSON, no other text`;

  const raw = await callLLMProxy(prompt, { maxTokens: 1500, temperature: 0.3, requireJson: true });
  const json = extractJSON(raw);
  const parsed = JSON.parse(json) as AiStructuredInsight;

  return {
    executive_summary: parsed.executive_summary || '',
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    risk_alerts: Array.isArray(parsed.risk_alerts) ? parsed.risk_alerts : [],
    anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
    data_quality_note: parsed.data_quality_note,
  };
}

function cleanTextResponse(text: string): string {
  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim();

  // If the model starts with conversational self-talk like "We need to write..." or "Here is the summary:"
  const metaPreambleMatch = cleaned.match(/^(?:(?:Here is|Below is|This is|We need to|As an AI|In summary|Summary:)[\s\S]*?\n\n+)([\s\S]+)$/i);
  if (metaPreambleMatch && metaPreambleMatch[1]) {
    cleaned = metaPreambleMatch[1].trim();
  }

  return cleaned;
}

/**
 * Generates a single executive-prose paragraph (3-5 sentences) suitable
 * for display at the top of the dashboard without bullet points.
 */
export async function generateAiNarrative(metrics: MarketMetrics): Promise<string> {
  const payload = {
    totalRevenue: metrics.kpis.totalRevenue,
    totalProfit: metrics.kpis.totalProfit,
    profitMarginPct: metrics.kpis.profitMarginPct,
    totalUnits: metrics.kpis.totalUnits,
    skuCount: metrics.kpis.skuCount,
    topCategory: metrics.revenueByCategory[0] ?? null,
    topProduct: metrics.topProducts[0] ?? null,
    lowStockCount: metrics.kpis.lowStockCount,
    avgDiscount: metrics.kpis.avgDiscount,
    dateRange: metrics.revenueByDate.length
      ? { from: metrics.revenueByDate[0].date, to: metrics.revenueByDate[metrics.revenueByDate.length - 1].date }
      : null,
  };

  const prompt = `You are a senior BI executive report writer for an Indian retail business. Analyze this retail data and return ONLY a JSON object with a polished, high-impact executive narrative paragraph.

DATA: ${JSON.stringify(payload)}

Return strictly this JSON format:
{
  "narrative": "A concise, professional 3-4 sentence paragraph highlighting the revenue performance, top growth drivers, and stock/cost risk. Use Indian currency format (₹). Do not include internal thinking, self-talk, or prompt echoes."
}`;

  try {
    const raw = await callLLMProxy(prompt, { maxTokens: 400, temperature: 0.2, requireJson: true });
    const json = extractJSON(raw);
    const parsed = JSON.parse(json) as { narrative?: string };
    if (parsed.narrative && parsed.narrative.length > 20) {
      return cleanTextResponse(parsed.narrative);
    }
  } catch (err) {
    console.warn('[insights] Narrative JSON extraction failed, using deterministic summary', err);
  }

  // High-quality deterministic summary fallback
  const rev = metrics.kpis.totalRevenue.toLocaleString('en-IN');
  const units = metrics.kpis.totalUnits.toLocaleString('en-IN');
  const topProd = metrics.topProducts[0]?.name || 'Top Product';
  return `The business generated ₹${rev} across ${units} units sold, led primarily by ${topProd}. Profit margin is recorded at ${metrics.kpis.profitMarginPct.toFixed(1)}% with ${metrics.kpis.lowStockCount} low-stock SKUs currently requiring inventory attention.`;
}

/**
 * Generates plain-text answers to ad-hoc BI questions using conversation
 * history for multi-turn context.
 */
export async function askQuestion(
  question: string,
  metricsJson: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  let prompt = `You are a BI data analyst assistant for an Indian retail business. Use the following market metrics context to answer the user's question.\n\nIMPORTANT: Always use Indian Rupee (₹) for monetary values with Indian number format (lakhs/crores). Never use $ or USD.\n\nMarket Metrics Context:\n${metricsJson}\n\nAnswer concisely and data-driven. If you don't have enough data, say so.\n\n`;

  for (const msg of history) {
    prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
  }
  prompt += `USER: ${question}\nASSISTANT: `;

  return callLLMProxy(prompt, { maxTokens: 800, temperature: 0.4 });
}
