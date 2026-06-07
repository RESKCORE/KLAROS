import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local',
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
);

let cachedAuthClient: ReturnType<typeof createClient> | null = null;
let cachedToken: string | null = null;

interface ClerkSession {
  getToken(options: { template: string }): Promise<string | null>;
}
interface ClerkWindow extends Window {
  Clerk?: {
    session?: ClerkSession;
  };
}

export async function getSupabaseClient() {
  if (typeof window !== 'undefined') {
    const clerkWindow = window as unknown as ClerkWindow;
    if (clerkWindow.Clerk?.session) {
      try {
        const token = await clerkWindow.Clerk.session.getToken({ template: 'supabase' });
        if (token) {
          if (!cachedAuthClient || token !== cachedToken) {
            cachedToken = token;
            cachedAuthClient = createClient(
              supabaseUrl || 'https://placeholder.supabase.co',
              supabaseAnonKey || 'placeholder-key',
              {
                global: {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              }
            );
          }
          return cachedAuthClient;
        }
      } catch (error) {
        console.error('Failed to get Clerk Supabase token:', error);
      }
    }
  }
  
  // Fallback to anonymous client
  return supabase;
}
