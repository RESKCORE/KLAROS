const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://hkfqnhulnwnqvovleyua.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_ijcHrO8gvRGB06OLnFX_aQ_9dYvEhno';

async function runMigration() {
  console.log('🔄 Attempting to add csv_data column to data_sources table...\n');
  
  if (!supabaseUrl || supabaseUrl.includes('your-project')) {
    console.error('❌ Error: VITE_SUPABASE_URL is not configured correctly.');
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseAnonKey);
  
  try {
    // Try to use the exec_sql RPC function
    const { data, error } = await client.rpc('exec_sql', {
      query: "ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS csv_data JSONB DEFAULT '{}'::jsonb;"
    });
    
    if (error) {
      console.error('❌ RPC exec_sql failed:', error);
      console.log('\n⚠️  The RPC function is not available on this plan.');
      console.log('Please run the migration manually in Supabase SQL Editor:\n');
      console.log('📋 SQL Command:');
      console.log("ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS csv_data JSONB DEFAULT '{}'::jsonb;");
      console.log('\n📍 Steps:');

      // Reconstruct direct URL to Supabase Dashboard from REST API endpoint
      let projectRef = 'hkfqnhulnwnqvovleyua';
      try {
        const match = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/);
        if (match && match[1]) {
          projectRef = match[1];
        }
      } catch (e) {
        // use fallback
      }

      console.log(`1. Go to: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
      console.log('2. Paste the SQL command above');
      console.log('3. Click "Run"');
      process.exit(1);
    }
    
    console.log('✅ Success! The csv_data column has been added to the data_sources table.');
    console.log('\n🎉 Your database is now ready for CSV uploads!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('\n📝 Please run this SQL manually in Supabase:');
    console.log("ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS csv_data JSONB DEFAULT '{}'::jsonb;");
    process.exit(1);
  }
}

runMigration();
