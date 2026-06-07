import { McdaRawResponseSchema, type McdaRawResponse } from '@/features/decisions/core/analysis-schema';
import type { MarketMetrics } from '@/features/market/utils/market-metrics';

// ─── Provider Detection ───────────────────────────────────────────────────────

type Provider = 'groq' | 'openrouter' | 'gemini';

function getKeys(): { groqKey: string | null; openrouterKey: string | null; geminiKey: string | null } {
  return {
    groqKey: import.meta.env.VITE_GROQ_API_KEY || null,
    openrouterKey: import.meta.env.VITE_OPENROUTER_API_KEY || null,
    geminiKey: import.meta.env.VITE_GEMINI_API_KEY || null,
  };
}

export function hasApiKey(): boolean {
  const { groqKey, openrouterKey, geminiKey } = getKeys();
  return !!(groqKey || openrouterKey || geminiKey);
}

export function getAvailableProviders(): Provider[] {
  const { groqKey, openrouterKey, geminiKey } = getKeys();
  const providers: Provider[] = [];
  if (groqKey) providers.push('groq');
  if (openrouterKey) providers.push('openrouter');
  if (geminiKey) providers.push('gemini');
  return providers;
}

// ─── Groq (Fastest inference, free tier) ──────────────────────────────────────

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',     // Most reliable and balanced
  'llama-3.1-8b-instant',        // Faster, lighter
  'qwen-3-32b',                  // Good reasoning
  'mixtral-8x7b-32768',          // Versatile multimodal
];

async function callGroq(
  prompt: string,
  maxTokens: number = 800,
  temperature: number = 0.2,
): Promise<string> {
  const { groqKey } = getKeys();
  if (!groqKey) throw new Error('Groq key not configured.');

  let lastError = '';
  const errors: string[] = [];

  for (const model of GROQ_MODELS) {
    try {
      console.log(`[Groq] Attempting with model '${model}'...`);
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${groqKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (response.status === 429) {
        const msg = `[Groq] Model '${model}' quota exhausted (429)`;
        console.warn(msg);
        errors.push(`${model}: 429`);
        lastError = msg;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        const msg = `[Groq] Model '${model}' failed (${response.status})`;
        console.warn(msg, errorText.slice(0, 100));
        errors.push(`${model}: ${response.status}`);
        lastError = msg;
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        const msg = `[Groq] Model '${model}' returned empty`;
        console.warn(msg);
        errors.push(`${model}: empty`);
        lastError = msg;
        continue;
      }

      console.info(`[Groq] ✅ Succeeded with model '${model}'`);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Groq] Model '${model}' threw:`, msg.slice(0, 100));
      errors.push(`${model}: network`);
      lastError = msg;
    }
  }

  throw new Error(`All Groq models unavailable. Errors: ${errors.join(' | ')}`);
}

// ─── OpenRouter (Variety of free models) ───────────────────────────────────────

const OPENROUTER_MODELS = [
  'deepseek/deepseek-v4-flash:free',              // DeepSeek V4 Flash (strong reasoning)
  'numinamath/numinamath-7b:free',                // Math-focused
  'qwen/qwen3-32b:free',                          // Qwen 3 series
  'meta-llama/llama-4-scout:free',                // Llama 4 Scout
  'meta-llama/llama-3.3-70b-instruct:free',       // Llama 3.3 70B
  'meta-llama/llama-3.1-70b-instruct:free',       // Llama 3.1 70B
  'mistralai/mistral-7b-instruct:free',           // Mistral 7B
  'openrouter/auto:free',                         // Let OpenRouter pick best free model
];

async function callOpenRouter(
  prompt: string,
  maxTokens: number = 800,
  temperature: number = 0.2,
): Promise<string> {
  const { openrouterKey } = getKeys();
  if (!openrouterKey) throw new Error('OpenRouter key not configured.');

  let lastError = '';
  const errors: string[] = [];

  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`[OpenRouter] Attempting with model '${model}'...`);
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openrouterKey}`,
          'HTTP-Referer': import.meta.env.VITE_APP_URL || 'http://localhost:8080',
          'X-Title': 'KLAROS Analytics',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (response.status === 429) {
        const msg = `[OpenRouter] Model '${model}' quota exhausted (429)`;
        console.warn(msg);
        errors.push(`${model}: 429`);
        lastError = msg;
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        const msg = `[OpenRouter] Model '${model}' failed (${response.status})`;
        console.warn(msg, errorText.slice(0, 100));
        errors.push(`${model}: ${response.status}`);
        lastError = msg;
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        const msg = `[OpenRouter] Model '${model}' returned empty`;
        console.warn(msg);
        errors.push(`${model}: empty`);
        lastError = msg;
        continue;
      }

      console.info(`[OpenRouter] ✅ Succeeded with model '${model}'`);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[OpenRouter] Model '${model}' threw:`, msg.slice(0, 100));
      errors.push(`${model}: network`);
      lastError = msg;
    }
  }

  throw new Error(`All OpenRouter models unavailable. Errors: ${errors.join(' | ')}`);
}

// ─── Gemini (Google AI, multimodal, quota-limited) ────────────────────────────

const GEMINI_MODELS = [
  'gemini-2.5-flash',            // Latest (May 2026)
  'gemini-2.5-flash-lite',       // Lightweight variant
  'gemini-3-flash',              // Gemini 3 Flash
  'gemini-3.1-flash',            // Gemini 3.1 Flash
  'gemini-3.1-flash-lite',       // Often most generous on free tier
  'gemini-2.0-flash',            // Fallback
  'gemini-1.5-flash',            // Last resort
];

async function callGemini(
  prompt: string,
  maxTokens: number = 800,
  temperature: number = 0.2,
  requireJson: boolean = false,
): Promise<string> {
  const { geminiKey } = getKeys();
  if (!geminiKey) throw new Error('Gemini key not configured.');

  const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens, temperature };
  if (requireJson) {
    generationConfig.responseMimeType = 'application/json';
  }

  const errors: string[] = [];

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;

    try {
      console.log(`[Gemini] Attempting with model '${model}'...`);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig,
        }),
      });

      if (response.status === 429) {
        const msg = `[Gemini] Model '${model}' quota exhausted (429)`;
        console.warn(msg);
        errors.push(`${model}: 429`);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        const msg = `[Gemini] Model '${model}' failed (${response.status})`;
        console.warn(msg, errorText.slice(0, 100));
        errors.push(`${model}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        const msg = `[Gemini] Model '${model}' returned empty`;
        console.warn(msg);
        errors.push(`${model}: empty`);
        continue;
      }

      console.info(`[Gemini] ✅ Succeeded with model '${model}'`);
      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini] Model '${model}' threw:`, msg.slice(0, 100));
      errors.push(`${model}: network`);
    }
  }

  throw new Error(`All Gemini models unavailable. Errors: ${errors.join(' | ')}`);
}

// ─── Unified Dispatcher — Multi-Provider Fallback ──────────────────────────────
// Provider priority:
// 1. Groq (fastest, best for speed)
// 2. OpenRouter (best variety, many free models)
// 3. Gemini (multimodal, but quota-limited)

async function callLLM(
  prompt: string,
  maxTokens: number = 800,
  temperature: number = 0.2,
  requireJson: boolean = false,
): Promise<string> {
  const { groqKey, openrouterKey, geminiKey } = getKeys();

  if (!groqKey && !openrouterKey && !geminiKey) {
    const setupMsg = `❌ No LLM API key configured.

CHOOSE ONE (or more) of these FREE options:

┌─ Option 1: Groq (Recommended - Fastest) ─────────────────┐
│ 1. Visit: https://console.groq.com/keys
│ 2. Create API key
│ 3. Add to .env.local: VITE_GROQ_API_KEY=your_key_here
└────────────────────────────────────────────────────────────┘

┌─ Option 2: OpenRouter (Variety of Models) ────────────────┐
│ 1. Visit: https://openrouter.ai
│ 2. Create API key
│ 3. Add to .env.local: VITE_OPENROUTER_API_KEY=your_key_here
└────────────────────────────────────────────────────────────┘

┌─ Option 3: Google Gemini (Multimodal) ────────────────────┐
│ 1. Visit: https://ai.google.dev
│ 2. Get free API key
│ 3. Add to .env.local: VITE_GEMINI_API_KEY=your_key_here
└────────────────────────────────────────────────────────────┘

Then restart: npm run dev`;
    throw new Error(setupMsg);
  }

  const attempts: { provider: string; error: string }[] = [];

  // Try Groq first (fastest)
  if (groqKey) {
    try {
      console.log('[LLM Dispatcher] Trying Groq (fastest)...');
      return await callGroq(prompt, maxTokens, temperature);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[LLM] Groq failed, trying next provider:', msg.slice(0, 100));
      attempts.push({ provider: 'Groq', error: msg.slice(0, 80) });
    }
  }

  // Try OpenRouter (variety)
  if (openrouterKey) {
    try {
      console.log('[LLM Dispatcher] Trying OpenRouter (variety)...');
      return await callOpenRouter(prompt, maxTokens, temperature);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[LLM] OpenRouter failed, trying next provider:', msg.slice(0, 100));
      attempts.push({ provider: 'OpenRouter', error: msg.slice(0, 80) });
    }
  }

  // Try Gemini last (multimodal, quota-limited)
  if (geminiKey) {
    try {
      console.log('[LLM Dispatcher] Trying Gemini (multimodal)...');
      return await callGemini(prompt, maxTokens, temperature, requireJson);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[LLM] Gemini failed');
      attempts.push({ provider: 'Gemini', error: msg.slice(0, 80) });
    }
  }

  // All failed
  const summary = attempts.map(a => `${a.provider}: ${a.error}`).join(' | ');
  const errorMsg = `❌ All LLM providers failed after retries:\n${summary}\n\nTroubleshooting:\n1. Check API keys in .env.local\n2. Verify keys are valid on their respective platforms\n3. Check rate limits and quotas\n4. Try a different provider`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// ─── JSON Extractor ───────────────────────────────────────────────────────────

function fixCommonJsonIssues(text: string): string {
  let fixed = text;
  // Remove trailing commas before closing braces/brackets
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  // Try to fix missing commas between properties (property delimiter followed by newline and next key)
  fixed = fixed.replace(/([}\]])[ \t]*\n\s*(")/g, '$1,\n$2');
  return fixed;
}

function extractJSON(raw: string): string {
  console.log('[extractJSON] FUNCTION CALLED v3 - raw length:', raw.length, 'first 50:', raw.substring(0, 50));
  
  const text = raw.trim();

  // TRY 1: As-is first
  try {
    JSON.parse(text);
    console.log('[extractJSON] TRY 1 succeeded');
    return text;
  } catch {
    console.log('[extractJSON] TRY 1 failed');
  }

  // TRY 2: Extract content from markdown code blocks (```json ... ```)
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const candidate = codeBlockMatch[1].trim();
    try {
      JSON.parse(candidate);
      console.log('[extractJSON] TRY 2 (code block) succeeded');
      return candidate;
    } catch {
      console.log('[extractJSON] TRY 2 failed');
    }
    // Try repairing the code block content
    try {
      const repaired = fixCommonJsonIssues(candidate);
      JSON.parse(repaired);
      console.log('[extractJSON] TRY 2b (code block + repair) succeeded');
      return repaired;
    } catch {
      console.log('[extractJSON] TRY 2b failed');
    }
  }

  // TRY 3: Remove markdown code block fences + all backticks
  const cleaned = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`/g, '')
    .trim();
  
  try {
    JSON.parse(cleaned);
    console.log('[extractJSON] TRY 3 (cleaned) succeeded');
    return cleaned;
  } catch {
    console.log('[extractJSON] TRY 3 failed');
  }

  // TRY 4: Find JSON via bracket matching (handles trailing text, partial extraction)
  const jsonStart = text.search(/[{[]/);
  if (jsonStart !== -1) {
    const startChar = text[jsonStart];
    const endChar = startChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = jsonStart; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === '\\') { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === startChar) depth++;
      else if (ch === endChar) {
        depth--;
        if (depth === 0) {
          const extracted = text.substring(jsonStart, i + 1);
          try {
            JSON.parse(extracted);
            console.log('[extractJSON] TRY 4 (bracket match) succeeded');
            return extracted;
          } catch {
            // Try repairing
            try {
              const repaired = fixCommonJsonIssues(extracted);
              JSON.parse(repaired);
              console.log('[extractJSON] TRY 4b (bracket match + repair) succeeded');
              return repaired;
            } catch {
              console.log('[extractJSON] TRY 4b failed');
            }
          }
        }
      }
    }
  }

  // TRY 5: Last resort - try JSON.parse on progressively larger chunks from first {/[}
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');
  const startPos = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket) ? firstBrace : firstBracket;
  if (startPos !== -1) {
    const closeChar = text[startPos] === '{' ? '}' : ']';
    // Try from full length backwards
    for (let end = text.length; end > startPos + 1; end--) {
      const chunk = text.substring(startPos, end);
      try {
        JSON.parse(chunk);
        console.log('[extractJSON] TRY 5 (progressive) succeeded');
        return chunk;
      } catch {
        // Try fixing
        try {
          const repaired = fixCommonJsonIssues(chunk);
          JSON.parse(repaired);
          console.log('[extractJSON] TRY 5b (progressive + repair) succeeded');
          return repaired;
        } catch {
          // continue shrinking
        }
      }
    }
  }

  console.log('[extractJSON] All extraction attempts failed, returning original');
  return raw;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateInsights(metricsJson: string): Promise<string> {
  if (!hasApiKey()) {
    throw new Error(
      '❌ AI not configured.\n\nSetup options (pick one or more):\n\n1. Groq (fastest): https://console.groq.com/keys → VITE_GROQ_API_KEY\n2. OpenRouter (variety): https://openrouter.ai → VITE_OPENROUTER_API_KEY\n3. Gemini (multimodal): https://ai.google.dev → VITE_GEMINI_API_KEY\n\nThen restart: npm run dev'
    );
  }

  const prompt = `You are a BI data analyst for an Indian retail business. Analyze the following market metrics and provide a concise executive summary with actionable insights (3-5 bullet points). Focus on revenue trends, top products, inventory risks, and investment performance.

IMPORTANT: Always use Indian Rupee (₹) for monetary values. Use Indian number format: lakhs and crores (e.g. ₹1.96 lakhs, ₹2.3 crores). Never use $ or USD.

Market Metrics:
${metricsJson}

Provide the summary in plain text with clear bullet points using ₹ for all amounts.`;

  try {
    console.log('[Insights] Generating insights from metrics...');
    return await callLLM(prompt, 500, 0.3);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Insights] Failed to generate insights:', message);
    throw err;
  }
}

export async function askQuestion(
  question: string,
  metricsJson: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  if (!hasApiKey()) {
    throw new Error(
      '❌ AI not configured.\n\nSetup options (pick one or more):\n\n1. Groq (fastest): https://console.groq.com/keys → VITE_GROQ_API_KEY\n2. OpenRouter (variety): https://openrouter.ai → VITE_OPENROUTER_API_KEY\n3. Gemini (multimodal): https://ai.google.dev → VITE_GEMINI_API_KEY\n\nThen restart: npm run dev'
    );
  }

  let prompt = `You are a BI data analyst assistant for an Indian retail business. Use the following market metrics context to answer the user's question.\n\nIMPORTANT: Always use Indian Rupee (₹) for monetary values with Indian number format (lakhs/crores). Never use $ or USD.\n\nMarket Metrics Context:\n${metricsJson}\n\nAnswer concisely and data-driven. If you don't have enough data, say so.\n\n`;

  for (const msg of history) {
    prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
  }
  prompt += `USER: ${question}\nASSISTANT: `;

  try {
    console.log('[Q&A] Answering question:', question.slice(0, 100));
    return await callLLM(prompt, 800, 0.4);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Q&A] Failed to answer question:', message);
    throw err;
  }
}

export async function generateMcdaAnalysis(metricsJson: string, retryCount: number = 0): Promise<McdaRawResponse> {
  if (!hasApiKey()) {
    throw new Error(
      `❌ MCDA Analysis requires an AI API key.

QUICK SETUP (choose any one):

1️⃣  Groq (Fastest - Recommended)
   • Visit: https://console.groq.com/keys
   • Create API key
   • Add to .env.local: VITE_GROQ_API_KEY=your_key
   
2️⃣  OpenRouter (Most Models)
   • Visit: https://openrouter.ai
   • Create API key  
   • Add to .env.local: VITE_OPENROUTER_API_KEY=your_key
   
3️⃣  Google Gemini (Multimodal)
   • Visit: https://ai.google.dev
   • Get free key
   • Add to .env.local: VITE_GEMINI_API_KEY=your_key

Then restart: npm run dev

✅ MCDA will work immediately once key is added!`
    );
  }

  const maxRetries = 2;
  const prompt = `You are a BI AI for an Indian retail business. Perform a Multi-Criteria Decision Analysis (MCDA) on the retail business data below.

Data: ${metricsJson}

Rules:
- Create exactly 3 options and 3 criteria derived from the actual data
- Weights must sum to 1.0
- Scores must be 0-100
- confidence must be 0-100 (your certainty in the recommendation based on data quality)
- CURRENCY: Always use ₹ (Indian Rupee) for any monetary amounts — never $ or USD. Use Indian notation (lakhs/crores) for large numbers.
- Return ONLY valid JSON — no markdown, no code fences, no explanations
- Every string must be properly quoted and closed
- The response must be a single, complete JSON object

Expected JSON structure:
{
  "title": "string — specific analysis title referencing the actual product/category",
  "context": "string — 1-2 sentence context using actual numbers from the data with ₹ amounts",
  "options": [
    { "id": "o1", "label": "string", "description": "string — specific to the data" },
    { "id": "o2", "label": "string", "description": "string — specific to the data" },
    { "id": "o3", "label": "string", "description": "string — specific to the data" }
  ],
  "criteria": [
    { "id": "c1", "name": "string", "weight": 0.4 },
    { "id": "c2", "name": "string", "weight": 0.3 },
    { "id": "c3", "name": "string", "weight": 0.3 }
  ],
  "recommendation": "string — which option is best and exactly why, with data-backed justification using ₹ amounts",
  "confidence": 82,
  "reasoning": {
    "decomposition": "string — how you analyzed this decision step by step",
    "assumptions": ["string", "string"],
    "tradeoffs": ["string — specific tradeoff between options"],
    "risks": ["string — specific risk with data reference and ₹ amounts"],
    "sensitivity": "string — how sensitive the result is to weight changes"
  },
  "scores": [
    { "optionId": "o1", "c1": 80, "c2": 90, "c3": 70, "total": 80 },
    { "optionId": "o2", "c1": 70, "c2": 60, "c3": 80, "total": 70 },
    { "optionId": "o3", "c1": 60, "c2": 70, "c3": 60, "total": 63 }
  ]
}`;

  try {
    const providers = getAvailableProviders();
    console.log(`[MCDA] Starting analysis (attempt ${retryCount + 1}/${maxRetries + 1}) with providers: ${providers.join(', ')}`);
    
    const rawResponse = await callLLM(prompt, 2000, 0.2, true);
    const content = extractJSON(rawResponse || '{}');

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      const msg = `[MCDA] AI returned malformed JSON on attempt ${retryCount + 1}/${maxRetries + 1}. Retrying...`;
      console.warn(msg);
      console.debug('Raw response:', rawResponse?.substring(0, 300));
      if (retryCount < maxRetries) {
        return generateMcdaAnalysis(metricsJson, retryCount + 1);
      }
      throw new Error('AI returned invalid JSON after multiple attempts. Please try again.');
    }

    const result = McdaRawResponseSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map(i => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
        .slice(0, 200);
      const msg = `[MCDA] Response validation failed on attempt ${retryCount + 1}/${maxRetries + 1}. Issues: ${issues}`;
      console.warn(msg);
      if (retryCount < maxRetries) {
        return generateMcdaAnalysis(metricsJson, retryCount + 1);
      }
      throw new Error(`MCDA analysis returned invalid data structure: ${issues}`);
    }

    console.log('[MCDA] ✅ Analysis complete and validated');
    return result.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[MCDA] Analysis failed:', message);
    throw err;
  }
}

// ─── AI-Powered Universal Data Parser ──────────────────────────────────────────
// Parses ANY data format (CSV, JSON, Excel, text, etc.) using AI
// Returns normalized product/sales/stock/investment data

export type ParsedDataset = {
  products: Record<string, unknown>[];
  sales: Record<string, unknown>[];
  stock: Record<string, unknown>[];
  investments: Record<string, unknown>[];
};

export async function parseDatasetWithAI(rawData: string, fileName: string, retryCount: number = 0): Promise<ParsedDataset> {
  console.log(`[AI Parser] 🤖 Analyzing dataset from ${fileName}...`);
  
  if (!hasApiKey()) {
    throw new Error('No LLM API key configured. Cannot parse data automatically.');
  }

  const prompt = `Extract structured data from the dataset below. Return ONLY valid JSON — no markdown, no code fences, no explanations, no extra text.

DATASET:
${rawData.substring(0, 5000)}

REQUIRED JSON STRUCTURE (return exactly this shape):
{
  "products": [ ... ],
  "sales": [ ... ],
  "stock": [ ... ],
  "investments": [ ... ]
}

CRITICAL RULES:
1. Output ONLY the JSON object — no markdown, no backticks, no text before or after
2. Every property must have a comma after it (except the last one)
3. No trailing commas
4. All strings must be double-quoted
5. Return empty array [] if a category is not found in the data
6. Keep all original field names and values exactly as they appear`;

  try {
    console.log('[AI Parser] Sending to LLM...');
    const response = await callLLM(prompt, 2000, 0.0, true);
    
    console.log('[AI Parser] Raw response (first 300 chars):', response.substring(0, 300));
    
    const jsonContent = extractJSON(response);
    console.log('[AI Parser] Extracted JSON (first 300 chars):', jsonContent.substring(0, 300));
    
    const parsed = JSON.parse(jsonContent);
    
    // Validate and normalize
    const result: ParsedDataset = {
      products: Array.isArray(parsed.products) ? parsed.products.filter((p: unknown) => p && typeof p === 'object') : [],
      sales: Array.isArray(parsed.sales) ? parsed.sales.filter((s: unknown) => s && typeof s === 'object') : [],
      stock: Array.isArray(parsed.stock) ? parsed.stock.filter((st: unknown) => st && typeof st === 'object') : [],
      investments: Array.isArray(parsed.investments) ? parsed.investments.filter((i: unknown) => i && typeof i === 'object') : [],
    };

    const totalRows = result.products.length + result.sales.length + result.stock.length + result.investments.length;

    // If result is empty and we haven't retried yet, try once more
    if (totalRows === 0 && retryCount < 1) {
      console.log('[AI Parser] ⚠️  Got zero rows, retrying with stricter prompt...');
      return parseDatasetWithAI(rawData, fileName, retryCount + 1);
    }

    console.log(`[AI Parser] ✅ Extracted: ${result.products.length} products, ${result.sales.length} sales, ${result.stock.length} stock, ${result.investments.length} investments`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AI Parser] ❌ Parsing failed:', message);
    console.error('[AI Parser] Full error:', err);

    // Retry once more with a stricter prompt
    if (retryCount < 1) {
      console.log('[AI Parser] 🔄 Retrying with stricter "only JSON" prompt...');
      const retryPrompt = `You are a data extraction engine. Your ONLY output is a JSON object. No words, no explanations, no markdown, no backticks.

DATASET (extract all rows into the correct arrays):
${rawData.substring(0, 5000)}

Return this exact JSON shape with all data:
{"products":[{"field1":"value1",...},...],"sales":[...],"stock":[...],"investments":[...]}

Rules: valid JSON only. Double quotes. Commas between all properties. No trailing commas.`;
      try {
        const retryResponse = await callLLM(retryPrompt, 2000, 0.0, true);
        const retryJson = extractJSON(retryResponse);
        const retryParsed = JSON.parse(retryJson);
        const retryResult: ParsedDataset = {
          products: Array.isArray(retryParsed.products) ? retryParsed.products.filter((p: unknown) => p && typeof p === 'object') : [],
          sales: Array.isArray(retryParsed.sales) ? retryParsed.sales.filter((s: unknown) => s && typeof s === 'object') : [],
          stock: Array.isArray(retryParsed.stock) ? retryParsed.stock.filter((st: unknown) => st && typeof st === 'object') : [],
          investments: Array.isArray(retryParsed.investments) ? retryParsed.investments.filter((i: unknown) => i && typeof i === 'object') : [],
        };
        console.log(`[AI Parser] ✅ Retry succeeded: ${retryResult.products.length} products, ${retryResult.sales.length} sales, ${retryResult.stock.length} stock, ${retryResult.investments.length} investments`);
        return retryResult;
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
        console.error('[AI Parser] ❌ Retry also failed:', retryMsg);
      }
    }
    
    // All attempts exhausted — throw so the caller can surface the error to the user
    console.log('[AI Parser] ⚠️  All parse attempts failed, propagating error to caller');
    throw new Error(`AI dataset parsing failed after multiple attempts: ${message}`);
  }
}

// ─── AI Structured Insights ───────────────────────────────────────────────────

export type AiStructuredInsight = {
  executive_summary: string;
  opportunities: { title: string; detail: string; impact: 'high' | 'medium' | 'low' }[];
  risk_alerts: { title: string; detail: string; severity: 'critical' | 'warning' | 'info' }[];
  anomalies: { metric: string; finding: string }[];
  data_quality_note?: string;
};

export async function generateAiInsightsFromMetrics(metrics: MarketMetrics): Promise<AiStructuredInsight> {
  const payload = {
    kpis: metrics.kpis,
    topProducts: metrics.topProducts.slice(0, 8),
    revenueByCategory: metrics.revenueByCategory,
    paymentMethodShare: metrics.paymentMethodShare,
    investmentRoi: metrics.investmentRoi,
    inventorySummary: metrics.inventorySummary,
    lowStockItems: metrics.inventory.filter(i => i.stockRatio <= 1.2).slice(0, 5),
    categoryRadar: metrics.categoryRadar,
    dateRange: metrics.revenueByDate.length
      ? { from: metrics.revenueByDate[0].date, to: metrics.revenueByDate[metrics.revenueByDate.length - 1].date }
      : null,
  };

  const prompt = `You are a senior retail BI analyst for an Indian business. Analyze the following market metrics data and return ONLY a valid JSON object — no markdown, no code fences, no extra text.

IMPORTANT: All monetary values in your response must use Indian Rupee format:
- Use the ₹ symbol (not $ or USD)
- Use Indian number formatting: lakhs (₹1.96 lakhs) and crores where appropriate
- Example: ₹1,96,687 or "₹1.96 lakhs" — never use "$196,687"

MARKET DATA:
${JSON.stringify(payload, null, 2)}

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
- Use Indian lakh/crore notation for large numbers (e.g. ₹1.96 lakhs, ₹2.3 crores)
- Mention specific product names, category names, or SKUs where relevant
- risk_alerts must reference real low-stock items or negative ROI if present
- anomalies should flag outliers (e.g. unusually high/low margins, single-payment-method dominance)
- Return ONLY valid JSON, no other text`;

  const raw = await callLLM(prompt, 1500, 0.3, true);
  const json = extractJSON(raw);
  const parsed = JSON.parse(json) as AiStructuredInsight;

  // Normalise arrays
  return {
    executive_summary: parsed.executive_summary || '',
    opportunities: Array.isArray(parsed.opportunities) ? parsed.opportunities : [],
    risk_alerts: Array.isArray(parsed.risk_alerts) ? parsed.risk_alerts : [],
    anomalies: Array.isArray(parsed.anomalies) ? parsed.anomalies : [],
    data_quality_note: parsed.data_quality_note,
  };
}

// ─── AI Narrative ─────────────────────────────────────────────────────────────

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

  const prompt = `You are a BI report writer for an Indian retail business. Write a single concise paragraph (3-5 sentences) that narrates the key business story from this retail metrics data. Write it as if presenting to an executive — specific, data-driven, highlighting the single most important finding and one risk. Do not use bullet points. Use the actual numbers.

IMPORTANT: Always use Indian Rupee format: ₹ symbol with Indian number notation (lakhs/crores). Never use $ or USD. Example: "₹1.96 lakhs" not "$196,687".

DATA: ${JSON.stringify(payload)}

Return ONLY the paragraph text, no other content.`;

  return callLLM(prompt, 400, 0.4);
}

// ─── AI Revenue Forecast ──────────────────────────────────────────────────────

export type AiForecastPoint = {
  month: string;
  forecastedRevenue: number;
  forecastedUnits: number;
  confidence: number;
};

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

  const raw = await callLLM(prompt, 600, 0.1, true);
  const json = extractJSON(raw);
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (p): p is AiForecastPoint =>
      typeof p.month === 'string' &&
      typeof p.forecastedRevenue === 'number' &&
      typeof p.forecastedUnits === 'number' &&
      typeof p.confidence === 'number',
  );
}
