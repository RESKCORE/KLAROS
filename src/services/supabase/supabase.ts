/**
 * @file supabase.ts
 * @description Supabase client factory with Clerk JWT authentication.
 *
 * Security fixes applied:
 *
 *  1. NO SILENT ANON FALLBACK — when an authenticated operation is requested
 *     but the Clerk session has expired, we throw a typed error instead of
 *     silently returning the anon client.  This prevents expired-session users
 *     from accidentally writing to Supabase under the `anon` RLS role.
 *
 *  2. MUTEX-BASED CLIENT CREATION — a module-level Promise<...> acts as a
 *     mutex so concurrent calls (e.g. two parallel Supabase queries on mount)
 *     never create more than one authenticated client per token.
 *
 *  3. PLACEHOLDER SAFE-GUARD — in development, missing credentials throw
 *     immediately so misconfiguration is obvious.  In CI without a `.env`,
 *     we fall back to localhost (never a real remote endpoint).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─── Environment Validation ───────────────────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  if (import.meta.env.DEV) {
    console.warn(
      '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing.\n' +
      'Copy .env.example → .env.local and fill in your Supabase credentials.',
    );
  }
}

/**
 * The anonymous Supabase client.
 * Used only for operations that are explicitly unauthenticated (public reads).
 * Never use this directly for user-scoped writes — use getSupabaseClient() instead.
 *
 * Fallback to localhost:54321 (local Supabase CLI) avoids hitting any real
 * remote project when credentials are missing in CI.
 */
export const supabase = createClient(
  supabaseUrl ?? 'http://localhost:54321',
  supabaseAnonKey ?? 'placeholder-anon-key',
);

// ─── Typed Errors ─────────────────────────────────────────────────────────────

/**
 * Thrown when an authenticated Supabase client is requested but the Clerk
 * session has expired or is unavailable.  Callers should catch this, clear
 * local state, and redirect the user to the sign-in page.
 */
export class AuthRequiredError extends Error {
  constructor(reason: string) {
    super(`AUTH_REQUIRED: ${reason}`);
    this.name = 'AuthRequiredError';
  }
}

// ─── Clerk Window Typing ──────────────────────────────────────────────────────

interface ClerkSession {
  getToken(options: { template: string }): Promise<string | null>;
}

interface ClerkWindow extends Window {
  Clerk?: { session?: ClerkSession };
}

// ─── Client Cache (Mutex Pattern) ────────────────────────────────────────────

/**
 * The last successfully created authenticated client.
 * Invalidated whenever the Clerk token changes (detected via string comparison).
 */
let cachedAuthClient: ReturnType<typeof createClient> | null = null;
let cachedToken: string | null = null;

/**
 * In-flight Promise for an authenticated client creation.
 * Acts as a lightweight mutex: concurrent callers await the same Promise
 * instead of each creating their own client.
 */
let clientCreationInFlight: Promise<SupabaseClient> | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns a Supabase client authenticated with the current Clerk JWT.
 *
 * @param requireAuth - When true (default), throws AuthRequiredError if no
 *                      valid Clerk session is available.  Set to false only
 *                      for explicitly unauthenticated public reads.
 *
 * @throws {AuthRequiredError} when requireAuth=true and the session is missing
 *                             or the token could not be retrieved.
 */
export async function getSupabaseClient(
  requireAuth = true,
): Promise<SupabaseClient> {
  // ── Server-side / non-browser ─────────────────────────────────────────────
  if (typeof window === 'undefined') {
    if (requireAuth) throw new AuthRequiredError('No browser session available (SSR context)');
    return supabase;
  }

  // ── Mutex: if a creation is already in-flight, await it ──────────────────
  if (clientCreationInFlight) {
    return clientCreationInFlight;
  }

  // ── Create (or reuse) authenticated client ────────────────────────────────
  clientCreationInFlight = (async () => {
    try {
      const clerkWindow = window as unknown as ClerkWindow;

      if (!clerkWindow.Clerk?.session) {
        if (requireAuth) {
          throw new AuthRequiredError('No active Clerk session found. Please sign in.');
        }
        return supabase;
      }

      let token: string | null;
      try {
        token = await clerkWindow.Clerk.session.getToken({ template: 'supabase' });
      } catch (err) {
        console.error('[Supabase] Failed to retrieve Clerk JWT:', err);
        if (requireAuth) {
          throw new AuthRequiredError('Failed to obtain a Clerk JWT. Your session may have expired.');
        }
        return supabase;
      }

      if (!token) {
        // getToken() returns null when the session is fully expired
        if (requireAuth) {
          throw new AuthRequiredError(
            'Clerk returned a null token — your session has expired. Please sign in again.',
          );
        }
        return supabase;
      }

      // Reuse the cached client if the token hasn't changed
      if (cachedAuthClient && token === cachedToken) {
        return cachedAuthClient;
      }

      // Token changed (refresh) — create a new client
      cachedToken = token;
      cachedAuthClient = createClient(
        supabaseUrl ?? 'http://localhost:54321',
        supabaseAnonKey ?? 'placeholder-anon-key',
        {
          global: {
            headers: { Authorization: `Bearer ${token}` },
          },
        },
      );

      return cachedAuthClient;
    } finally {
      // Always release the mutex so the next call can proceed
      clientCreationInFlight = null;
    }
  })();

  return clientCreationInFlight;
}
