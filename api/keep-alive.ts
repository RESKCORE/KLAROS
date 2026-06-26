import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: { headers: Record<string, string | string[] | undefined>; method?: string },
  res: {
    setHeader: (key: string, value: string) => void;
    status: (code: number) => { json: (data: Record<string, unknown>) => void; end: (data?: string) => void };
    end: (data?: string) => void;
  },
) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Keep-Alive] Missing Supabase environment variables');
    res.status(500).json({
      message: 'Supabase environment variables not configured',
    });
    return;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { error } = await supabase.from('data_sources').select('id').limit(1);

    if (error) {
      console.error('[Keep-Alive] Supabase query failed:', error.message);
      res.status(500).json({
        message: 'Supabase ping failed',
        error: error.message,
      });
      return;
    }

    console.log('[Keep-Alive] Supabase ping successful');
    res.status(200).json({ message: 'Supabase is alive!' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Keep-Alive] Unexpected error:', message);
    res.status(500).json({
      message: 'Keep-alive check failed',
      error: message,
    });
  }
}
