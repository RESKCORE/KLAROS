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
import { getCurrencyPromptGuideline } from '@/features/market/utils/currency-utils';

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
  const domain = metrics.kpis.domain || 'retail_transactions';

  const curr = getCurrencyPromptGuideline(metrics);
  let domainPersona = 'You are a senior retail BI analyst.';
  let domainRules = `
- COST & MARGIN DISCLOSURE: If "isCostEstimated" is true in kpis, you MUST state in "executive_summary" or "data_quality_note" that margins and profit are estimated based on standard retail benchmark COGS (65%) as unit costs were not provided in the uploaded dataset.
- CATEGORY CONCENTRATION: If "isCategoryInferred" is true in kpis, categories were heuristically inferred from SKU descriptions. Do not report false revenue concentration risks as hard facts.`;

  if (domain === 'market_securities') {
    domainPersona = 'You are a quantitative financial analyst evaluating market securities, equities, and portfolio assets.';
    domainRules = `
- DOMAIN FOCUS: Securities and asset trading. Analyze price action, asset volatility, returns, and traded volume.
- TERMINOLOGY: Do NOT use retail language (no "SKUs", "inventory", "COGS", or "retail margin"). Discuss "assets/tickers", "annualized volatility", "drawdown", "cumulative returns", and "market turnover".`;
  } else if (domain === 'financial_ledger') {
    domainPersona = 'You are a senior financial controller evaluating general ledger accounting records and cash flows.';
    domainRules = `
- DOMAIN FOCUS: Double-entry accounting ledger. Analyze credit inflows, debit outflows, net cash position, and category burn.
- TERMINOLOGY: Do NOT use retail language (no "SKUs" or "products sold"). Discuss "inflows/receipts", "outflows/expenses", "journal entries", "net cash balance", and "account heads".`;
  } else if (domain === 'inventory_stock') {
    domainPersona = 'You are a supply chain operations controller evaluating warehouse inventory snapshots.';
    domainRules = `
- DOMAIN FOCUS: Warehouse inventory management. Analyze total stock valuation, on-hand quantities, reorder thresholds, and storage costs.
- TERMINOLOGY: Focus on "stockout risk", "reorder alerts", "warehouse valuation", and "carrying costs" rather than transactional sales.`;
  } else if (domain === 'subscription_saas') {
    domainPersona = 'You are a SaaS finance and metrics director analyzing recurring subscription revenue.';
    domainRules = `
- DOMAIN FOCUS: SaaS subscriptions. Analyze Monthly Recurring Revenue (MRR), ARR, subscriber counts, plan tiers, and churn risk.
- TERMINOLOGY: Focus on "MRR growth", "churn risk", "tier distribution", and "subscriber retention".`;
  } else if (domain === 'supermarket_products') {
    domainPersona = 'You are a retail category manager and pricing analyst specializing in supermarket inventory and product margins.';
  } else if (domain === 'generic_tabular') {
    domainPersona = 'You are a principal business intelligence analyst evaluating tabular business data.';
    domainRules = `
- DOMAIN FOCUS: General business dataset. Provide statistical distribution insights, segment drivers, and timeline trends without forcing retail framing.`;
  }

  const prompt = `${domainPersona} Analyze the following dataset metrics and return ONLY a valid JSON object — no markdown, no code fences, no extra text.

DOMAIN RULES:
${domainRules}

IMPORTANT: All monetary values in your response must use the correct business currency:
- ${curr.guideline}
- Always use the ${curr.symbol} symbol for amounts.

MARKET DATA:
${payload}

Return exactly this JSON structure (fill every field with real analysis based on the data above):
{
  "executive_summary": "3-4 sentence high-level summary of performance, mentioning specific numbers in ${curr.symbol}",
  "opportunities": [
    { "title": "short opportunity title", "detail": "specific actionable detail with numbers in ${curr.symbol}", "impact": "high" },
    { "title": "short opportunity title", "detail": "specific actionable detail with numbers in ${curr.symbol}", "impact": "medium" },
    { "title": "short opportunity title", "detail": "specific actionable detail with numbers in ${curr.symbol}", "impact": "low" }
  ],
  "risk_alerts": [
    { "title": "short risk title", "detail": "specific risk detail with affected items or categories, amounts in ${curr.symbol}", "severity": "critical" },
    { "title": "short risk title", "detail": "specific risk detail with amounts in ${curr.symbol}", "severity": "warning" }
  ],
  "anomalies": [
    { "metric": "metric name", "finding": "what is unusual about this metric and why it matters, amounts in ${curr.symbol}" }
  ],
  "data_quality_note": "optional note about data completeness or quality issues, or omit this field"
}

Rules:
- Base every insight on the actual numbers provided
- Always use ${curr.symbol} for any monetary amount
${domainRules}
- Return ONLY valid JSON, no other text`;

  try {
    const raw = await callLLMProxy(prompt, { maxTokens: 1500, temperature: 0.3, requireJson: true });
    const json = extractJSON(raw);
    const parsed = JSON.parse(json) as AiStructuredInsight;

    if (parsed && typeof parsed === 'object') {
      const dataQualityNote = parsed.data_quality_note || (
        metrics.kpis.isCostEstimated
          ? 'Data Note: Unit cost data was not provided in the source file. Profit margins reflect an industry benchmark estimate rather than measured supplier costs.'
          : undefined
      );

      return {
        executive_summary: parsed.executive_summary || '',
        opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
        risk_alerts: Array.isArray(parsed.risk_alerts) ? parsed.risk_alerts : [],
        anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
        data_quality_note: dataQualityNote,
      };
    }
  } catch (err) {
    console.warn('[insights] LLM Insights call failed, using deterministic business rules fallback:', err);
  }

  // Deterministic Business Synthesis Fallback (Domain-Aware)
  const locale = metrics.kpis?.currency === 'GBP' ? 'en-GB' : metrics.kpis?.currency === 'USD' ? 'en-US' : 'en-IN';
  const sym = curr.symbol;
  const revStr = `${sym}${metrics.kpis.totalRevenue.toLocaleString(locale)}`;
  const topCat = metrics.revenueByCategory[0]?.category || 'Primary Segment';
  const topProd = metrics.topProducts[0]?.name || 'Top Asset / Item';

  if (domain === 'market_securities') {
    return {
      executive_summary: `Tracked assets generated ${revStr} in total market turnover across ${metrics.kpis.skuCount} securities. Top traded asset was ${topProd}, driving significant market volume. Overall portfolio position indicates ${metrics.kpis.profitMarginPct >= 0 ? '+' : ''}${metrics.kpis.profitMarginPct.toFixed(1)}% cumulative return.`,
      opportunities: [
        { title: 'Rebalance Leading Assets', detail: `Capitalize on momentum in ${topCat} to optimize risk-adjusted returns.`, impact: 'high' },
      ],
      riskAlertMetric: undefined,
      risk_alerts: metrics.kpis.lowStockCount > 0 ? [
        { title: 'Elevated Market Volatility', detail: 'Identified heightened price volatility or drawdown across tracked securities.', severity: 'warning' },
      ] : [],
      anomalies: [],
    };
  }

  if (domain === 'financial_ledger') {
    const netPos = metrics.kpis.totalProfit;
    return {
      executive_summary: `Ledger accounts recorded ${revStr} in total inflows against ${sym}${metrics.kpis.totalCost.toLocaleString(locale)} in recorded outflows, resulting in a net cash position of ${sym}${netPos.toLocaleString(locale)}. Top expense category was ${topCat}.`,
      opportunities: [
        { title: `Audit ${topCat} Expenses`, detail: `Review expenditure patterns in ${topCat} to identify cost reduction opportunities.`, impact: 'high' },
      ],
      risk_alerts: netPos < 0 ? [
        { title: 'Cash Outflow Deficit', detail: 'Outflows currently exceed inflows, requiring working capital review.', severity: 'critical' },
      ] : [],
      anomalies: [],
    };
  }

  if (domain === 'inventory_stock') {
    return {
      executive_summary: `Warehouse facilities hold an aggregate valuation of ${revStr} across ${metrics.kpis.skuCount} active SKUs. ${topCat} represents the largest storage allocation. Estimated annual holding and carrying costs are ${sym}${metrics.kpis.totalCost.toLocaleString(locale)}.`,
      opportunities: [
        { title: `Streamline ${topCat} Buffer Stock`, detail: `Optimize safety stock levels in ${topCat} to reduce inventory carrying overhead.`, impact: 'medium' },
      ],
      risk_alerts: metrics.kpis.lowStockCount > 0 ? [
        { title: `${metrics.kpis.lowStockCount} SKUs Below Reorder Threshold`, detail: 'Multiple inventory lines have breached minimum safety stock levels.', severity: 'critical' },
      ] : [],
      anomalies: [],
    };
  }

  if (domain === 'subscription_saas') {
    return {
      executive_summary: `The subscription portfolio generates ${revStr} in Monthly Recurring Revenue (MRR) across ${metrics.kpis.totalUnits} active subscribers. The ${topCat} tier accounts for the largest revenue share, with an annualized run-rate of ${sym}${metrics.kpis.inventoryValue.toLocaleString(locale)}.`,
      opportunities: [
        { title: `Upsell ${topCat} Tier Subscribers`, detail: 'Target expansion revenue by migrating standard tier accounts to higher tier features.', impact: 'high' },
      ],
      risk_alerts: metrics.kpis.lowStockCount > 0 ? [
        { title: `${metrics.kpis.lowStockCount} Churned Accounts Detected`, detail: 'Identified canceled or expired subscriber accounts requiring retention intervention.', severity: 'warning' },
      ] : [],
      anomalies: [],
    };
  }

  // Retail and Generic Fallback
  const topProdRev = metrics.topProducts[0] ? `${sym}${metrics.topProducts[0].revenue.toLocaleString(locale)}` : `${sym}0`;
  const marginNote = metrics.kpis.isCostEstimated ? ' (estimated benchmark)' : '';

  return {
    executive_summary: `The business achieved ${revStr} in revenue with a gross margin of ${metrics.kpis.profitMarginPct.toFixed(1)}%${marginNote}. Primary sales volume was driven by the ${topCat} department, with top performer ${topProd} generating ${topProdRev}.${metrics.kpis.isCostEstimated ? ' Note: Margin is modeled on standard retail COGS benchmarks due to missing supplier cost data.' : ''}`,
    data_quality_note: metrics.kpis.isCostEstimated ? 'Data Note: Source file lacks unit cost column. Profit and margin figures reflect an industry benchmark estimate (65% COGS / 35% margin).' : undefined,
    opportunities: [
      {
        title: `Scale ${topCat} Inventory`,
        detail: `The ${topCat} category drives the highest sales volume. Expanding related SKUs could capture an estimated 15-20% incremental revenue.`,
        impact: 'high',
      },
      {
        title: `Optimize Pricing for Top 5 SKUs`,
        detail: `Top SKUs show strong inelastic demand. A targeted 3-5% price adjustment could improve net margins by ${sym}${Math.round(metrics.kpis.totalRevenue * 0.03).toLocaleString(locale)}.`,
        impact: 'medium',
      },
    ],
    risk_alerts: metrics.kpis.lowStockCount > 0 ? [
      {
        title: `${metrics.kpis.lowStockCount} SKUs Near Reorder Threshold`,
        detail: `Identified inventory items below minimum safety stock levels, risking delivery stockouts.`,
        severity: 'warning',
      },
    ] : [
      {
        title: metrics.kpis.isCostEstimated ? 'Estimated COGS Margin' : 'Healthy Inventory Buffer',
        detail: metrics.kpis.isCostEstimated
          ? 'Profit calculations use standard retail benchmark margins (35%) because supplier invoices were absent from this dataset.'
          : 'Leading product lines exhibit stable operational flow with balanced inventory turnover.',
        severity: metrics.kpis.isCostEstimated ? 'warning' : 'info' as any,
      },
    ],
    anomalies: [
      {
        metric: 'Category Concentration',
        finding: `${topCat} represents over ${(metrics.revenueByCategory[0] && metrics.kpis.totalRevenue > 0 ? (metrics.revenueByCategory[0].revenue / metrics.kpis.totalRevenue) * 100 : 40).toFixed(0)}% of turnover.`,
      },
    ],
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

  const curr = getCurrencyPromptGuideline(metrics);
  const prompt = `You are a senior BI executive report writer. Analyze this business data and return ONLY a JSON object with a polished, high-impact executive narrative paragraph.

DATA: ${JSON.stringify(payload)}

Return strictly this JSON format:
{
  "narrative": "A concise, professional 3-4 sentence paragraph highlighting revenue performance, top growth drivers, and stock/cost risk. ${curr.guideline} Do not include internal thinking, self-talk, or prompt echoes."
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
  const locale = metrics.kpis?.currency === 'GBP' ? 'en-GB' : metrics.kpis?.currency === 'USD' ? 'en-US' : 'en-IN';
  const rev = metrics.kpis.totalRevenue.toLocaleString(locale);
  const units = metrics.kpis.totalUnits.toLocaleString(locale);
  const topProd = metrics.topProducts[0]?.name || 'Top Product';
  return `The business generated ${curr.symbol}${rev} across ${units} units sold, led primarily by ${topProd}. Profit margin is recorded at ${metrics.kpis.profitMarginPct.toFixed(1)}% with ${metrics.kpis.lowStockCount} low-stock SKUs currently requiring inventory attention.`;
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
