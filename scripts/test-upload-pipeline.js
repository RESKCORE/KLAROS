#!/usr/bin/env node

/**
 * CSV Upload & LLM Testing Script
 * 
 * This script tests each component of the upload and analysis pipeline
 * to help identify where failures occur.
 * 
 * Usage:
 * node scripts/test-upload-pipeline.js
 */

const fs = require('fs');
const path = require('path');

console.log('='.repeat(60));
console.log('KLAROS CSV Upload & LLM Pipeline Test');
console.log('='.repeat(60));

// Test 1: Check Node.js Version
console.log('\n[1/6] Node.js Version');
console.log(`✓ Running on Node.js ${process.version}`);

// Test 2: Check Environment Variables
console.log('\n[2/6] Environment Variables');
const env = require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });
if (env.error) {
  console.log('⚠️  .env.local not found (this is OK if using system env vars)');
} else {
  console.log('✓ .env.local loaded');
}

const keys = {
  VITE_GROQ_API_KEY: process.env.VITE_GROQ_API_KEY,
  VITE_OPENROUTER_API_KEY: process.env.VITE_OPENROUTER_API_KEY,
  VITE_GEMINI_API_KEY: process.env.VITE_GEMINI_API_KEY,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_KEY: process.env.VITE_SUPABASE_KEY,
};

for (const [key, value] of Object.entries(keys)) {
  const status = value ? '✓' : '✗';
  const display = value ? `${String(value).substring(0, 15)}...` : 'NOT SET';
  console.log(`  ${status} ${key}: ${display}`);
}

// Test 3: Check Dependencies
console.log('\n[3/6] Dependencies');
const deps = ['papaparse', 'supabase', 'vite', '@supabase/supabase-js'];
deps.forEach(dep => {
  try {
    require.resolve(dep);
    console.log(`✓ ${dep}`);
  } catch (e) {
    console.log(`✗ ${dep} - NOT INSTALLED`);
  }
});

// Test 4: Sample CSV Files
console.log('\n[4/6] Sample CSV Files');

const csvDir = path.resolve(__dirname, '../public/market-dataset/dataset1');
const files = ['products.csv', 'sales.csv', 'stock.csv', 'investments.csv'];
files.forEach(file => {
  const filepath = path.join(csvDir, file);
  if (fs.existsSync(filepath)) {
    const size = fs.statSync(filepath).size;
    console.log(`✓ ${file} (${size} bytes)`);
  } else {
    console.log(`✗ ${file} - NOT FOUND: ${filepath}`);
  }
});

// Test 5: Parse Sample CSV
console.log('\n[5/6] CSV Parser Test');
try {
  const Papa = require('papaparse');
  const testCsv = path.join(csvDir, 'products.csv');
  if (fs.existsSync(testCsv)) {
    const text = fs.readFileSync(testCsv, 'utf-8');
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    console.log(`✓ Parsed products.csv: ${parsed.data.length} rows`);
    console.log(`  Headers: ${Object.keys(parsed.data[0] || {}).join(', ')}`);
  }
} catch (e) {
  console.log(`✗ CSV parsing failed: ${e.message}`);
}

// Test 6: LLM Keys
console.log('\n[6/6] LLM Provider Status');
const groqAvailable = !!keys.VITE_GROQ_API_KEY;
const openrouterAvailable = !!keys.VITE_OPENROUTER_API_KEY;
const geminiAvailable = !!keys.VITE_GEMINI_API_KEY;

console.log(`  Groq: ${groqAvailable ? '✓ AVAILABLE' : '✗ NOT CONFIGURED'}`);
console.log(`  OpenRouter: ${openrouterAvailable ? '✓ AVAILABLE' : '✗ NOT CONFIGURED'}`);
console.log(`  Gemini: ${geminiAvailable ? '✓ AVAILABLE' : '✗ NOT CONFIGURED'}`);

if (!groqAvailable && !openrouterAvailable && !geminiAvailable) {
  console.log('\n⚠️  WARNING: No LLM providers configured!');
  console.log('  Set at least one of:');
  console.log('  - VITE_GROQ_API_KEY');
  console.log('  - VITE_OPENROUTER_API_KEY');
  console.log('  - VITE_GEMINI_API_KEY');
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('Summary:');
const allGood = groqAvailable && fs.existsSync(path.join(csvDir, 'products.csv'));
if (allGood) {
  console.log('✅ All systems ready for CSV upload & LLM analysis!');
  console.log('\nNext steps:');
  console.log('1. npm run dev');
  console.log('2. Go to Connect Data');
  console.log('3. Upload 4 CSV files');
  console.log('4. Watch console for detailed logs');
} else {
  console.log('⚠️  Some configuration needed:');
  if (!groqAvailable) console.log('  - Add VITE_GROQ_API_KEY to .env.local');
  if (!fs.existsSync(path.join(csvDir, 'products.csv'))) {
    console.log('  - Verify sample CSV files in public/market-dataset/');
  }
}
console.log('='.repeat(60));
