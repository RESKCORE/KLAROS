# 🤖 MCDA Analysis & Fallback Engine

This document explains how KLAROS processes retail metrics to run Multi-Criteria Decision Analysis (MCDA) and how the application handles fallback states if the AI providers fail.

---

## 🔄 The MCDA Pipeline

When you run an analysis on a dataset in the Dashboard, the following sequence occurs:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│  Load Dataset   │ ────> │ Compute Metrics │ ────> │   Prepare AI    │
│  From Supabase  │       │ (market-metrics)│       │  Payload (JSON) │
└─────────────────┘       └─────────────────┘       └─────────────────┘
                                                             │
                                                             ▼
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ Render Results  │ <──── │  Save Decision  │ <──── │ Query Providers │
│  & Charts UI    │       │   to Database   │       │ (Groq/OR/Gemini)│
└─────────────────┘       └─────────────────┘       └─────────────────┘
```

### 1. Data Aggregation
The platform loads products, sales, stock, and investment records from Supabase and runs client-side metrics calculation in [src/lib/market-metrics.ts](file:///e:/KLAROS/src/lib/market-metrics.ts).

### 2. Payload Construction
The computed top-5 products, category performance, and inventory health metrics are summarized into a compact JSON schema to stay within token boundaries:
```json
{
  "topProducts": [ ... ],
  "categories": [ ... ],
  "health": { ... }
}
```

### 3. AI Dispatch
The dispatcher attempts to execute the MCDA request with the highest-priority available AI provider. If successful, the model outputs a structured JSON response matching the MCDA schema.

---

## ⚠️ Fallback Mechanism

If all AI providers fail (e.g. invalid keys, network timeouts, or quota limits), the system gracefully intercepts the error and falls back to a pre-defined strategic template. This ensures that the application remains functional.

```typescript
// bi-api.ts
let mcdaResult: McdaRawResponse;
try {
  mcdaResult = await generateMcdaAnalysis(JSON.stringify(summaryMetrics));
} catch (err) {
  console.warn("⚠️ Using fallback template (not AI-generated).");
  mcdaResult = {
    title: 'AI Market Analysis',
    context: 'AI-driven MCDA analysis based on dataset metrics.',
    options: [
      { id: 'o1', label: 'Top Revenue Products', description: 'Focus on highest revenue products' },
      { id: 'o2', label: 'Balanced Portfolio', description: 'Diversify across all categories' },
      { id: 'o3', label: 'Inventory Optimization', description: 'Prioritize inventory efficiency' }
    ],
    criteria: [
      { id: 'c1', name: 'Revenue Potential', weight: 0.4 },
      { id: 'c2', name: 'Market Demand', weight: 0.3 },
      { id: 'c3', name: 'Operational Efficiency', weight: 0.3 }
    ],
    recommendation: 'Based on the analysis, focusing on top revenue products provides the best strategic advantage.',
    scores: [
      { optionId: 'o1', c1: 85, c2: 75, c3: 70, total: 78 },
      { optionId: 'o2', c1: 70, c2: 80, c3: 75, total: 74 },
      { optionId: 'o3', c1: 65, c2: 70, c3: 90, total: 73 }
    ]
  };
}
```

---

## 🔍 How to Verify AI Succeeded

Developers can check if the results are live AI-generated or fallbacks by reviewing the browser developer console:

### ✅ Live AI Succeeded
```
[LLM Dispatcher] Trying Groq (fastest)...
[Groq] Attempting with model 'llama-3.3-70b-versatile'...
[Groq] ✅ Succeeded with model 'llama-3.3-70b-versatile'
[MCDA] ✅ Analysis complete and validated
```

### ⚠️ Fallback Active
```
❌ MCDA generation failed after retries: Rate limit reached.
⚠️ Using fallback template (not AI-generated). Please check:
   • API keys configured in .env.local
   • Provider quotas and rate limits
```

---

## 📁 Key Source Files

- [src/lib/llm-service.ts](file:///e:/KLAROS/src/lib/llm-service.ts) — Implements REST calls to the providers.
- [src/lib/bi-api.ts](file:///e:/KLAROS/src/lib/bi-api.ts) — Coordinates the data upload, analysis trigger, and fallback logic.
- [src/lib/analysis-schema.ts](file:///e:/KLAROS/src/lib/analysis-schema.ts) — Defines Zod types to validate the AI output structure.
