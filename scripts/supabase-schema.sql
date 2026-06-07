-- Supabase SQL Migration: Create tables for the serverless dashboard
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/xxx/sql/new)

-- ============================================================================
-- IMPORTANT: Migration for existing databases
-- If data_sources table already exists without csv_data column, run this first:
-- ============================================================================
-- ALTER TABLE data_sources ADD COLUMN IF NOT EXISTS csv_data JSONB DEFAULT '{}'::jsonb;

-- ============================================================================

-- 1. Data Sources table
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'supermarket_products',
  status TEXT NOT NULL DEFAULT 'connected',
  is_synthetic BOOLEAN DEFAULT false,
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  counts JSONB DEFAULT '{}'::jsonb,
  csv_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Decisions table
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
  decision_type TEXT,
  options JSONB DEFAULT '[]'::jsonb,
  criteria JSONB DEFAULT '[]'::jsonb,
  constraints JSONB DEFAULT '[]'::jsonb,
  result_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_decisions_user_id ON decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_data_source_id ON decisions(data_source_id);
CREATE INDEX IF NOT EXISTS idx_data_sources_user_id ON data_sources(user_id);

-- Enable Row Level Security
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;

-- Public access policies (MVP mode — security enforced at app layer via user_id column)
-- This fixes the 42501 "permission denied" error by allowing anonymous key access.
DROP POLICY IF EXISTS "Public access" ON data_sources;
CREATE POLICY "Public access" ON data_sources FOR ALL USING (true);

DROP POLICY IF EXISTS "Public access" ON decisions;
CREATE POLICY "Public access" ON decisions FOR ALL USING (true);
