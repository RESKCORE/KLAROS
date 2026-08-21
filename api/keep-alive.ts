import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: { headers: Record<string, string | string[] | undefined>; method?: string },
  res: {
    setHeader: (key: string, value: string) => void;
    status: (code: number) => { json: (data: Record<string, unknown>) => void; end: (data?: string) => void };
    end: (data?: string) => void;
  },
) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // ── Verify Vercel Cron Authentication ──────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Keep-Alive] Supabase credentials not configured');
    res.status(500).json({ message: 'Service unavailable' });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase.from('data_sources').select('id').limit(1);

    if (error) {
      console.error('[Keep-Alive] Supabase ping failed:', error.message);
      res.status(500).json({ message: 'Health check failed' });
      return;
    }

    console.log('[Keep-Alive] Supabase ping successful');
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[Keep-Alive] Unexpected error:', err);
    res.status(500).json({ message: 'Health check failed' });
  }
}
