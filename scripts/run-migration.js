#!/usr/bin/env node

// Run Supabase migration to add csv_data column
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hkfqnhulnwnqvovleyua.supabase.co';
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZnFuaHVsbm13bnF2b3ZsZXl1YSIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTg0Njg1NTU5OX0.PLACEHOLDER';

const client = createClient(supabaseUrl, supabaseServiceRole);

async function runMigration() {
  try {
    console.log('🔄 Running migration to add csv_data column...');
    
    // Use the direct SQL execution if available
    const { data, error } = await client.rpc('exec_sql', {
      query: "ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS csv_data JSONB DEFAULT '{}'::jsonb;"
    });

    if (error) {
      console.error('❌ Migration failed:', error);
      
      // If RPC not available, try direct approach
      console.log('⚠️  Trying alternative approach...');
      console.log('Please run this SQL in Supabase SQL Editor:');
      console.log("ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS csv_data JSONB DEFAULT '{}'::jsonb;");
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!');
    console.log('csv_data column has been added to data_sources table');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    console.log('\n📝 Please run this SQL manually in Supabase:');
    console.log("ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS csv_data JSONB DEFAULT '{}'::jsonb;");
    process.exit(1);
  }
}

runMigration();
