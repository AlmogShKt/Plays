-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Creates the table + RLS policy for the real estate calculator

-- 1. Create table
CREATE TABLE IF NOT EXISTS calculator_data (
  id         TEXT        PRIMARY KEY DEFAULT 'default',
  data       JSONB       NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable Row Level Security
ALTER TABLE calculator_data ENABLE ROW LEVEL SECURITY;

-- 3. Allow anonymous read/write (this is a personal calculator, not multi-user)
CREATE POLICY "Allow anonymous read"
  ON calculator_data FOR SELECT
  USING (true);

CREATE POLICY "Allow anonymous insert"
  ON calculator_data FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow anonymous update"
  ON calculator_data FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 4. Seed an empty default row so the first load doesn't fail
INSERT INTO calculator_data (id, data)
VALUES ('default', '{}')
ON CONFLICT (id) DO NOTHING;
