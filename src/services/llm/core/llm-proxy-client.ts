/**
 * @file llm-proxy-client.ts
 * @description Client-side LLM caller with two modes:
 *
 *  ┌─ PRODUCTION / `vercel dev` (VITE_USE_LLM_PROXY = true) ──────────────┐
 *  │  Browser → POST /api/llm (Clerk JWT attached)                         │
 *  │  Server reads GROQ_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY     │
 *  │  Keys are NEVER in the browser bundle — fully secure.                 │
 *  └───────────────────────────────────────────────────────────────────────┘
 *
 *  ┌─ LOCAL DEV / `npm run dev` (VITE_USE_LLM_PROXY = false) ─────────────┐
 *  │  Browser calls providers directly using VITE_* env vars.              │
 *  │  Keys are visible in DevTools — acceptable only on localhost.         │
 *  │  This mode exists solely for developer convenience; never deploy it.  │
 *  └───────────────────────────────────────────────────────────────────────┘
 *
 * To switch to fully secure local dev: install Vercel CLI and run
 *   `vercel dev` instead of `npm run dev`, then set VITE_USE_LLM_PROXY=true.
 */

import { fetchWithTimeout } from '@/services/llm/core/fetch-with-timeout';
import type { LLMCallOptions } from '@/services/llm/core/types';

// ─── Mode Detection ───────────────────────────────────────────────────────────

/**
 * Returns true when the /api/llm proxy is available:
 *   - Always in Vercel production (import.meta.env.PROD === true)
 *   - In local dev when VITE_USE_LLM_PROXY=true (running `vercel dev`)
 */
export function isProxyConfigured(): boolean {
  return import.meta.env.PROD === true || import.meta.env.VITE_USE_LLM_PROXY === 'true';
}

/**
 * Returns true if an AI API key is available either via the /api/llm proxy
 * or via direct client environment variables (VITE_GROQ_API_KEY, VITE_OPENROUTER_API_KEY, VITE_GEMINI_API_KEY).
 */
export function hasApiKey(): boolean {
  if (isProxyConfigured()) return true;
  const groq = import.meta.env.VITE_GROQ_API_KEY;
  const openrouter = import.meta.env.VITE_OPENROUTER_API_KEY;
  const gemini = import.meta.env.VITE_GEMINI_API_KEY;
  return Boolean(
    (groq && groq.length > 5) ||
    (openrouter && openrouter.length > 5) ||
    (gemini && gemini.length > 5)
  );
}

// ─── Clerk Token Helper ───────────────────────────────────────────────────────

interface ClerkWindow extends Window {
  Clerk?: {
    session?: {
      getToken(opts: { template: string }): Promise<string | null>;
    };
  };
}

async function getClerkToken(): Promise<string | null> {
  try {
    const clerkWindow = window as unknown as ClerkWindow;
    return (await clerkWindow.Clerk?.session?.getToken({ template: 'supabase' })) ?? null;
  } catch {
    return null;
  }
}

// ─── Proxy Path (production / vercel dev) ─────────────────────────────────────

async function callViaProxy(prompt: string, options: LLMCallOptions): Promise<string> {
  const { maxTokens = 800, temperature = 0.2, requireJson = false } = options;

  const token = await getClerkToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetchWithTimeout(
    '/api/llm',
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, maxTokens, temperature, requireJson }),
    },
    30_000,
  );

  if (!response.ok) {
    let errorMsg = `LLM proxy error (HTTP ${response.status})`;
    try {
      const body = await response.json() as { error?: string };
      if (body.error) errorMsg = body.error;
    } catch { /* ignore */ }
    if (response.status === 401) {
      throw new Error('AUTH_REQUIRED: Your session has expired. Please sign in again.');
    }
    throw new Error(errorMsg);
  }

  const body = await response.json() as { text?: string };
  if (!body.text) throw new Error('LLM proxy returned an empty response body');
  return body.text;
}

// ─── Direct Path (npm run dev fallback only) ──────────────────────────────────

const GROQ_KEY       = import.meta.env.VITE_GROQ_API_KEY as string | undefined;
const OR_KEY         = import.meta.env.VITE_OPENROUTER_API_KEY as string | undefined;
const GEM_KEY        = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'qwen-3-32b',
  'mixtral-8x7b-32768',
];

const OPENROUTER_MODELS = [
  'deepseek/deepseek-v4-flash:free',
  'qwen/qwen3-32b:free',
  'meta-llama/llama-4-scout:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

async function callDirect(prompt: string, options: LLMCallOptions): Promise<string> {
  if (import.meta.env.PROD) {
    throw new Error('[SECURITY VIOLATION] Direct LLM calls from client are strictly forbidden in production builds.');
  }

  const { maxTokens = 800, temperature = 0.2, requireJson = false } = options;
  const errors: string[] = [];

  // ── Groq ────────────────────────────────────────────────────────────────────
  if (GROQ_KEY) {
    for (const model of GROQ_MODELS) {
      try {
        const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature }),
        });
        if (res.status === 429 || !res.ok) { errors.push(`groq/${model}: ${res.status}`); continue; }
        const data = await res.json() as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (err) { errors.push(`groq/${model}: ${String(err).slice(0, 60)}`); }
    }
  }

  // ── OpenRouter ───────────────────────────────────────────────────────────────
  if (OR_KEY) {
    for (const model of OPENROUTER_MODELS) {
      try {
        const res = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${OR_KEY}`,
            'HTTP-Referer': import.meta.env.VITE_APP_URL || 'http://localhost:8080',
            'X-Title': 'KLAROS Analytics',
          },
          body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }], max_tokens: maxTokens, temperature }),
        });
        if (res.status === 429 || !res.ok) { errors.push(`openrouter/${model}: ${res.status}`); continue; }
        const data = await res.json() as { choices?: { message?: { content?: string } }[] };
        const text = data.choices?.[0]?.message?.content;
        if (text) return text;
      } catch (err) { errors.push(`openrouter/${model}: ${String(err).slice(0, 60)}`); }
    }
  }

  // ── Gemini ───────────────────────────────────────────────────────────────────
  if (GEM_KEY) {
    const genConfig: Record<string, unknown> = { maxOutputTokens: maxTokens, temperature };
    if (requireJson) genConfig.responseMimeType = 'application/json';
    for (const model of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEM_KEY}`;
      try {
        const res = await fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: genConfig }),
        });
        if (res.status === 429 || !res.ok) { errors.push(`gemini/${model}: ${res.status}`); continue; }
        const data = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text;
      } catch (err) { errors.push(`gemini/${model}: ${String(err).slice(0, 60)}`); }
    }
  }

  if (!GROQ_KEY && !OR_KEY && !GEM_KEY) {
    throw new Error(
      '❌ No LLM keys found.\n\n' +
      'For local dev (npm run dev): add VITE_GROQ_API_KEY / VITE_OPENROUTER_API_KEY / VITE_GEMINI_API_KEY to .env.local\n' +
      'For vercel dev: add GROQ_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY to .env.local and set VITE_USE_LLM_PROXY=true',
    );
  }

  throw new Error(`All LLM providers failed (direct mode): ${errors.join(' | ')}`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Unified LLM caller. Automatically routes to the secure proxy or the
 * direct client path based on the VITE_USE_LLM_PROXY environment variable.
 */
export async function callLLMProxy(prompt: string, options: LLMCallOptions = {}): Promise<string> {
  if (isProxyConfigured()) {
    return callViaProxy(prompt, options);
  }
  // Development fallback — keys are in VITE_* vars, only safe on localhost
  console.warn(
    '[LLM] Running in direct mode (npm run dev). ' +
    'Switch to `vercel dev` + VITE_USE_LLM_PROXY=true for production-equivalent security.',
  );
  return callDirect(prompt, options);
}
