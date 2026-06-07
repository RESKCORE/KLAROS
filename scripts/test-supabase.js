import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFilePath = path.resolve(__dirname, '../.env.local');
const envFile = fs.readFileSync(envFilePath, 'utf8');
const urlMatch = envFile.match(/VITE_SUPABASE_URL="(.*?)"/) || envFile.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = envFile.match(/VITE_SUPABASE_ANON_KEY="(.*?)"/) || envFile.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim() : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim() : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('Testing select...');
  const { data, error } = await supabase
    .from('data_sources')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Select Error:', error);
  } else {
    console.log('Select Success:', data);
  }
}

test();
