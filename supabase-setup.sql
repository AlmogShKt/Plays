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

-- 3. Drop existing policies (safe to re-run)
DROP POLICY IF EXISTS "Allow anonymous read"   ON calculator_data;
DROP POLICY IF EXISTS "Allow anonymous insert"  ON calculator_data;
DROP POLICY IF EXISTS "Allow anonymous update"  ON calculator_data;
DROP POLICY IF EXISTS "Allow authenticated read"   ON calculator_data;
DROP POLICY IF EXISTS "Allow authenticated insert"  ON calculator_data;
DROP POLICY IF EXISTS "Allow authenticated update"  ON calculator_data;

-- 4. Only authenticated users can read/write
CREATE POLICY "Allow authenticated read"
  ON calculator_data FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated insert"
  ON calculator_data FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated update"
  ON calculator_data FOR UPDATE
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- 4. Seed with current calculator data
INSERT INTO calculator_data (id, data)
VALUES (
  'default',
  '{
    "purchase": [
      {"description": "מחיר דירה (חוזה)", "amount": 1300000},
      {"description": "יועץ משכנתאות", "amount": 8100},
      {"description": "בדק בית", "amount": 1180},
      {"description": "אדריכל", "amount": 30000},
      {"description": "שמאות מקדימה", "amount": 3000}
    ],
    "renovation": [
      {"description": "2 מזגנים", "amount": 6000},
      {"description": "שיפוץ כללי", "amount": 280000}
    ],
    "equity": [
      {"description": "קופת גמל גל", "amount": 87750},
      {"description": "קופת גמל מגדל", "amount": 75000},
      {"description": "קופת גמל אלמוג לפידות", "amount": 97000},
      {"description": "מתנה הורים - משכנתא", "amount": 150000},
      {"description": "קרן כספית", "amount": 26000},
      {"description": "דולרים", "amount": 20000},
      {"description": "פיקדון יוסי", "amount": 15000}
    ],
    "mortgage": {"amount": 937000, "rate": 5.25, "years": 30},
    "loans": [
      {"description": "הלוואה שיפוץ", "amount": 220000, "rate": 5.23, "months": 120}
    ]
  }'
)
ON CONFLICT (id) DO UPDATE SET
  data = EXCLUDED.data,
  updated_at = now();
