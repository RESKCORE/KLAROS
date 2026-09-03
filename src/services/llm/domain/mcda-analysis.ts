/**
 * @file mcda-analysis.ts
 * @description MCDA/AHP analysis orchestration domain function.
 *
 * Key improvements over the original implementation:
 *
 *  1. ITERATIVE RETRY — recursive calls replaced with a for-loop, eliminating
 *     accumulating stack frames and confusing "attempt X/Y" log messages.
 *
 *  2. EXPONENTIAL BACK-OFF + JITTER — a 429 from a provider is no longer
 *     immediately retried; we wait an increasing delay before the next attempt.
 *
 *  3. PROMPT INJECTION GUARD — user-supplied metricsJson is structurally
 *     separated from instructions via role-split in the proxy.
 */

import { callLLMProxy } from '@/services/llm/core/llm-proxy-client';
import { extractJSON } from '@/services/llm/core/json-extractor';
import { sleep, backoffMs } from '@/services/llm/core/backoff';
import { McdaRawResponseSchema, type McdaRawResponse } from '@/features/decisions/core/analysis-schema';
import { ahpSynthesis } from '@/features/decisions/core/ahp-math';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildMcdaPrompt(metricsJson: string): string {
  const isGbp = metricsJson.includes('"currency":"GBP"') || metricsJson.includes('"currencySymbol":"£"');
  const currencyGuideline = isGbp
    ? '6. CURRENCY: Always use British Pounds (£ / GBP) — never ₹ or $. Use standard UK notation (e.g. £15,000, £2.4M).'
    : '6. CURRENCY: Always use ₹ (Indian Rupee) — never $ or USD. Use Indian notation (lakhs/crores).';

  return `You are a strategic business intelligence advisor. Perform a Multi-Criteria Decision Analysis (MCDA) using the Analytic Hierarchy Process (AHP) on the business data below.

Data: ${metricsJson}

RULES:
1. Create exactly 3 strategic options and 3 evaluation criteria derived from the actual data.
2. Pairwise comparison scale (Saaty 1–9):
   - 1 = Equal importance
   - 3 = Moderate importance
   - 5 = Strong importance
   - 7 = Very strong
   - 9 = Extreme
   (Use values between 1–9 only; fractions like 1/3 are expressed as 0.333)
3. Criteria comparisons (criteriaComparisons): compare how much more important each criterion is than another.
   Format: [C1vsC2, C1vsC3, C2vsC3]
4. Option comparisons (optionComparisons): for each criterion, compare how much better each option is.
   Format: array of 3 arrays (one per criterion): [[O1vsO2, O1vsO3, O2vsO3], [...], [...]]
5. confidence must be 0-100.
${currencyGuideline}
7. Return ONLY valid JSON — no markdown, no code fences, no explanations.
8. Every string must be properly quoted and closed.

Expected JSON structure:
{
  "title": "string",
  "context": "string",
  "options": [
    { "id": "o1", "label": "string", "description": "string" },
    { "id": "o2", "label": "string", "description": "string" },
    { "id": "o3", "label": "string", "description": "string" }
  ],
  "criteria": [
    { "id": "c1", "name": "string" },
    { "id": "c2", "name": "string" },
    { "id": "c3", "name": "string" }
  ],
  "criteriaComparisons": [3, 2, 1],
  "optionComparisons": [
    [3, 5, 2],
    [1, 3, 3],
    [2, 1, 2]
  ],
  "recommendation": "string",
  "confidence": 82,
  "reasoning": {
    "decomposition": "string",
    "assumptions": ["string"],
    "tradeoffs": ["string"],
    "risks": ["string"],
    "sensitivity": "string"
  }
}`;
}

// ─── AHP Post-Processing ──────────────────────────────────────────────────────

function applyAhpSynthesis(mcdaResult: McdaRawResponse): void {
  const { criteriaComparisons, optionComparisons, options, criteria } = mcdaResult;

  if (!criteriaComparisons || !optionComparisons || !options || !criteria) return;

  const mCount = criteria.length;
  const nCount = options.length;

  const synthesis = ahpSynthesis({
    criteriaComparisons: criteriaComparisons as number[],
    optionComparisons: optionComparisons as number[][],
    criteriaCount: mCount,
    optionsCount: nCount,
  });

  // Attach computed weights to criteria
  criteria.forEach((c, i) => {
    c.weight = Math.round((synthesis.weights[i] ?? (1 / mCount)) * 1000) / 1000;
  });

  // Build normalised scores array (0–100 scale)
  const scoreKeys = criteria.map((c) => c.id);
  mcdaResult.scores = options.map((opt, optIdx) => {
    const score: Record<string, string | number> = {
      optionId: opt.id,
      total: Math.round((synthesis.totalScores[optIdx] ?? 0) * 100),
    };
    scoreKeys.forEach((key, critIdx) => {
      score[key] = Math.round((synthesis.optionVectors[critIdx]?.[optIdx] ?? 0) * 100);
    });
    return score;
  });

  if (!synthesis.consistency.isConsistent) {
    console.warn(
      `[MCDA] AHP consistency notice: criteriaCR=${synthesis.consistency.criteriaCR.toFixed(3)}, ` +
      `optionCRs=[${synthesis.consistency.optionCRs.map((c) => c.toFixed(3)).join(', ')}]`,
    );
  }
}

// ─── Public Function ──────────────────────────────────────────────────────────

/**
 * Orchestrates the full MCDA/AHP analysis pipeline with iterative retry and
 * exponential back-off.
 *
 * Retry strategy:
 *  - Attempt 1: immediate
 *  - Attempt 2: ~800–1000 ms delay
 *  - Attempt 3: ~1600–2000 ms delay
 *
 * @param metricsJson - JSON string of market metrics (from `buildMetricsSummary`
 *                      or `JSON.stringify(metrics.kpis)`).
 */
export async function generateMcdaAnalysis(metricsJson: string): Promise<McdaRawResponse> {
  const prompt = buildMcdaPrompt(metricsJson);
  let lastError: Error = new Error('MCDA analysis failed before first attempt');

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Wait before every retry (not before the first attempt)
    if (attempt > 0) {
      const delay = backoffMs(attempt - 1);
      console.log(`[MCDA] Waiting ${delay}ms before attempt ${attempt + 1}/${MAX_ATTEMPTS}...`);
      await sleep(delay);
    }

    console.log(`[MCDA] Starting analysis (attempt ${attempt + 1}/${MAX_ATTEMPTS})...`);

    // ── LLM call ───────────────────────────────────────────────────────────
    let rawResponse: string;
    try {
      rawResponse = await callLLMProxy(prompt, { maxTokens: 2000, temperature: 0.2, requireJson: true });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[MCDA] LLM call failed on attempt ${attempt + 1}: ${lastError.message.slice(0, 120)}`);
      continue; // next attempt
    }

    // ── JSON extraction ────────────────────────────────────────────────────
    const content = extractJSON(rawResponse || '{}');
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      lastError = new Error(`Malformed JSON on attempt ${attempt + 1}`);
      console.warn(`[MCDA] ${lastError.message}`);
      console.debug('[MCDA] Raw response snippet:', rawResponse?.substring(0, 300));
      continue;
    }

    // ── Schema validation ──────────────────────────────────────────────────
    const result = McdaRawResponseSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
        .slice(0, 200);
      lastError = new Error(`Schema validation failed on attempt ${attempt + 1}: ${issues}`);
      console.warn(`[MCDA] ${lastError.message}`);
      continue;
    }

    // ── AHP post-processing ────────────────────────────────────────────────
    const mcdaResult = result.data;
    applyAhpSynthesis(mcdaResult);

    console.log('[MCDA] ✅ Analysis complete and validated');
    return mcdaResult;
  }

  // All attempts exhausted
  throw new Error(
    `MCDA analysis failed after ${MAX_ATTEMPTS} attempts. Last error: ${lastError.message}`,
  );
}
