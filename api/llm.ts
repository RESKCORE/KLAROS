/**
 * @file api/llm.ts
 * @description Vercel Serverless Function — LLM proxy.
 *
 * ┌─ Security Architecture ─────────────────────────────────────────────────┐
 * │                                                                          │
 * │  BEFORE (insecure):                                                      │
 * │    Browser → VITE_GROQ_API_KEY (bundled in JS) → Groq API               │
 * │    ↑ Any user could extract the key from the bundle in seconds           │
 * │                                                                          │
 * │  AFTER (secure):                                                         │
 * │    Browser → /api/llm (Clerk JWT verified) → Groq/OpenRouter/Gemini     │
 * │    ↑ Keys live only in Vercel's encrypted environment variables          │
 * │    ↑ Every request is authenticated via Clerk's JWT template             │
 * │                                                                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Environment variables required in Vercel dashboard (NOT prefixed with VITE_):
 *   GROQ_API_KEY
 *   OPENROUTER_API_KEY
 *   GEMINI_API_KEY
 *   CLERK_SECRET_KEY        — for JWT verification
 *   CLERK_JWT_KEY           — PEM public key from Clerk dashboard → API Keys
 *   VITE_APP_URL            — used as HTTP-Referer for OpenRouter
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// ─── Environment ──────────────────────────────────────────────────────────────

const GROQ_KEY       = process.env.GROQ_API_KEY;
const OR_KEY         = process.env.OPENROUTER_API_KEY;
const GEM_KEY        = process.env.GEMINI_API_KEY;
const CLERK_JWT_KEY  = process.env.CLERK_JWT_KEY; // RSA public key (PEM)
const APP_URL        = process.env.VITE_APP_URL ?? 'https://klaros.vercel.app';
const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL ??
  process.env.KV_REST_API_URL ??
  process.env.STORAGE_REST_API_URL ??
  process.env.STORAGE_URL;

const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ??
  process.env.KV_REST_API_TOKEN ??
  process.env.STORAGE_REST_API_TOKEN ??
  process.env.STORAGE_TOKEN;


// ─── Redis Client Initialization ──────────────────────────────────────────────

let redisClient: Redis | null = null;
if (UPSTASH_URL && UPSTASH_TOKEN) {
  try {
    redisClient = new Redis({
      url: UPSTASH_URL,
      token: UPSTASH_TOKEN,
    });
  } catch (err) {
    console.warn('[llm proxy] Upstash Redis initialization failed:', err);
  }
}

/**
 * Computes a deterministic SHA-256 cache key from request parameters.
 */
async function computeCacheKey(
  prompt: string,
  maxTokens: number,
  temperature: number,
  requireJson: boolean,
): Promise<string> {
  const payload = `${prompt}:${maxTokens}:${temperature}:${requireJson}`;
  const msgUint8 = new TextEncoder().encode(payload);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `klaros:llm:${hashHex}`;
}


// ─── JWT Verification ─────────────────────────────────────────────────────────

const jwkCache = new Map<string, CryptoKey>();

/**
 * Fetches and imports the JWK public key from the Clerk JWKS endpoint.
 */
async function getJwkPublicKey(iss: string, kid?: string): Promise<CryptoKey | null> {
  const cacheKey = `${iss}:${kid ?? 'default'}`;
  if (jwkCache.has(cacheKey)) {
    return jwkCache.get(cacheKey)!;
  }

  try {
    const jwksUrl = iss.endsWith('/') ? `${iss}.well-known/jwks.json` : `${iss}/.well-known/jwks.json`;
    const res = await fetch(jwksUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;

    const jwks = (await res.json()) as { keys?: Array<JsonWebKey & { kid?: string; alg?: string }> };
    if (!jwks.keys || jwks.keys.length === 0) return null;

    const matchedKey = kid ? jwks.keys.find((k) => k.kid === kid) ?? jwks.keys[0] : jwks.keys[0];
    if (!matchedKey) return null;

    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      matchedKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    jwkCache.set(cacheKey, cryptoKey);
    return cryptoKey;
  } catch (err) {
    console.warn('[llm proxy] Failed to fetch JWKS from issuer:', err);
    return null;
  }
}

/**
 * Verifies a Clerk-issued JWT using the RS256 public key (PEM key or automatic JWKS endpoint).
 * We use the Web Crypto API (available in Node 20+) so there is zero
 * dependency overhead — no jsonwebtoken package needed in the serverless bundle.
 *
 * @throws when the token is missing, malformed, expired, or has an invalid signature.
 */
async function verifyClerkJwt(authHeader: string | undefined): Promise<void> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header');
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new Error('Empty bearer token provided');
  }

  // Decode the JWT without verification first to extract the header/payload
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT structure');

  const [headerB64, payloadB64, sigB64] = parts;
  let header: { kid?: string; alg?: string } = {};
  let payload: { exp?: number; iss?: string; sub?: string } = {};

  try {
    header = JSON.parse(Buffer.from(headerB64, 'base64url').toString());
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
  } catch {
    throw new Error('Failed to parse JWT payload or header');
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    throw new Error('JWT has expired');
  }

  const signingInput = `${headerB64}.${payloadB64}`;
  const signatureBuffer = Buffer.from(sigB64, 'base64url');

  // Option A: Try verifying with CLERK_JWT_KEY (PEM) if configured
  if (CLERK_JWT_KEY) {
    try {
      const pemBody = CLERK_JWT_KEY
        .replace(/-----BEGIN PUBLIC KEY-----/, '')
        .replace(/-----END PUBLIC KEY-----/, '')
        .replace(/\s/g, '');
      const keyBuffer = Buffer.from(pemBody, 'base64');

      const cryptoKey = await crypto.subtle.importKey(
        'spki',
        keyBuffer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['verify'],
      );

      const isValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        signatureBuffer,
        Buffer.from(signingInput),
      );

      if (isValid) return; // Verified successfully!
    } catch (pemErr) {
      console.warn('[llm proxy] PEM verification attempt failed, attempting JWKS fallback:', pemErr);
    }
  }

  // Option B: Auto-discover public key from Clerk JWKS endpoint if issuer is present
  if (payload.iss && (payload.iss.includes('clerk') || payload.iss.startsWith('https://'))) {
    const jwkKey = await getJwkPublicKey(payload.iss, header.kid);
    if (jwkKey) {
      const isValid = await crypto.subtle.verify(
        'RSASSA-PKCS1-v1_5',
        jwkKey,
        signatureBuffer,
        Buffer.from(signingInput),
      );
      if (isValid) return; // Verified successfully!
      throw new Error('JWT signature verification failed against Clerk JWKS');
    }
  }

  // Option C: Local dev fallback when no public key could be found
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[llm proxy] Could not verify Clerk JWT signature in dev mode — allowing request');
    return;
  }

  throw new Error('CLERK_JWT_KEY is not configured and JWKS could not be fetched');
}

// ─── Per-Request Timeout ──────────────────────────────────────────────────────

const PROVIDER_TIMEOUT_MS = 20_000; // 20 s — server-side can afford more than client

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// ─── Provider Implementations ─────────────────────────────────────────────────

const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
  'gemma2-9b-it',
];

async function callGroqServer(
  prompt: string,
  maxTokens: number,
  temperature: number,
  requireJson = false,
): Promise<string> {
  if (!GROQ_KEY) throw new Error('Groq key not configured on server');

  for (const model of GROQ_MODELS) {
    const messages = [
      ...(requireJson
        ? [{ role: 'system', content: 'You are a multi-criteria decision intelligence API. You MUST output ONLY a valid RFC 8259 JSON object. Do not include markdown codeblocks (```), no thinking tags, no prose, and no commentary. Start directly with { and end with }.' }]
        : []),
      { role: 'user', content: prompt },
    ];

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (requireJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
      body: JSON.stringify(body),
    });

    if (response.status === 429) continue;       // rate-limited — try next model
    if (!response.ok) continue;                  // server error — try next model

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (text) return text;
  }
  throw new Error('All Groq models unavailable');
}

const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'qwen/qwen-2.5-72b-instruct:free',
  'mistralai/mistral-7b-instruct:free',
];

async function callOpenRouterServer(
  prompt: string,
  maxTokens: number,
  temperature: number,
  requireJson = false,
): Promise<string> {
  if (!OR_KEY) throw new Error('OpenRouter key not configured on server');

  const messages = [
    ...(requireJson
      ? [{ role: 'system', content: 'You are a multi-criteria decision intelligence API. You MUST output ONLY a valid RFC 8259 JSON object. Do not include markdown codeblocks (```), no thinking tags, no prose, and no commentary. Start directly with { and end with }.' }]
      : []),
    { role: 'user', content: prompt },
  ];

  for (const model of OPENROUTER_MODELS) {
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };

    if (requireJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OR_KEY}`,
        'HTTP-Referer': APP_URL,
        'X-Title': 'KLAROS Analytics',
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429) continue;
    if (!response.ok) continue;

    const data = await response.json() as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (text) return text;
  }
  throw new Error('All OpenRouter models unavailable');
}

const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
];

async function callGeminiServer(
  prompt: string,
  maxTokens: number,
  temperature: number,
  requireJson: boolean,
): Promise<string> {
  if (!GEM_KEY) throw new Error('Gemini key not configured on server');

  const generationConfig: Record<string, unknown> = { maxOutputTokens: maxTokens, temperature };
  if (requireJson) generationConfig.responseMimeType = 'application/json';

  for (const model of GEMINI_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEM_KEY}`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
    });

    if (response.status === 429) continue;
    if (!response.ok) continue;

    const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
  }
  throw new Error('All Gemini models unavailable');
}

// ─── Request Body Shape ───────────────────────────────────────────────────────

interface LLMRequestBody {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  requireJson?: boolean;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  try {
    await verifyClerkJwt(req.headers.authorization);
  } catch (authErr) {
    const errorMsg = authErr instanceof Error ? authErr.message : 'Unauthorized';
    console.error('[llm proxy] Auth failed:', errorMsg);
    return res.status(401).json({ error: errorMsg });
  }

  // ── Parse body ──────────────────────────────────────────────────────────────
  const body = req.body as LLMRequestBody;
  const { prompt, maxTokens = 800, temperature = 0.2, requireJson = false } = body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required and must be a string' });
  }

  // Hard ceiling to prevent prompt injection from requesting enormous outputs
  const safeMaxTokens = Math.min(maxTokens, 4_000);

  // ── Redis Cache Lookup ──────────────────────────────────────────────────────
  let cacheKey = '';
  if (redisClient) {
    try {
      cacheKey = await computeCacheKey(prompt, safeMaxTokens, temperature, requireJson);
      const cachedResponse = await redisClient.get<string>(cacheKey);
      if (cachedResponse) {
        return res.status(200).json({ text: cachedResponse, cached: true });
      }
    } catch (cacheErr) {
      console.warn('[llm proxy] Redis cache read failed:', cacheErr);
    }
  }

  // Helper to store response in Redis (24 hr TTL) and return HTTP 200
  const sendAndCacheResponse = async (text: string) => {
    if (redisClient && cacheKey) {
      try {
        await redisClient.set(cacheKey, text, { ex: 86400 });
      } catch (cacheErr) {
        console.warn('[llm proxy] Redis cache write failed:', cacheErr);
      }
    }
    return res.status(200).json({ text, cached: false });
  };

  // ── Dispatch with server-side keys ──────────────────────────────────────────
  const providerAttempts: string[] = [];

  if (GROQ_KEY) {
    try {
      const text = await callGroqServer(prompt, safeMaxTokens, temperature, requireJson);
      return await sendAndCacheResponse(text);
    } catch (err) {
      providerAttempts.push(`Groq: ${String(err).slice(0, 80)}`);
    }
  }

  if (OR_KEY) {
    try {
      const text = await callOpenRouterServer(prompt, safeMaxTokens, temperature, requireJson);
      return await sendAndCacheResponse(text);
    } catch (err) {
      providerAttempts.push(`OpenRouter: ${String(err).slice(0, 80)}`);
    }
  }

  if (GEM_KEY) {
    try {
      const text = await callGeminiServer(prompt, safeMaxTokens, temperature, requireJson);
      return await sendAndCacheResponse(text);
    } catch (err) {
      providerAttempts.push(`Gemini: ${String(err).slice(0, 80)}`);
    }
  }

  if (providerAttempts.length === 0) {
    return res.status(503).json({
      error: 'No LLM providers configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, or GEMINI_API_KEY in Vercel environment variables.',
    });
  }

  return res.status(502).json({
    error: `All LLM providers failed: ${providerAttempts.join(' | ')}`,
  });
}
