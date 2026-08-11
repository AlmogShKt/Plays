-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Creates the table + RLS policies for the real estate calculator
-- Multi-apartment: each row = one apartment/scenario.

-- 1. Create table
CREATE TABLE IF NOT EXISTS calculator_data (
  id         TEXT        PRIMARY KEY DEFAULT 'default',
  name       TEXT        NOT NULL DEFAULT 'דירה',
  data       JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1b. Upgrade old single-row schema (safe to re-run)
ALTER TABLE calculator_data ADD COLUMN IF NOT EXISTS name       TEXT        NOT NULL DEFAULT 'דירה';
ALTER TABLE calculator_data ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Enable Row Level Security
ALTER TABLE calculator_data ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies (safe to re-run)
DROP POLICY IF EXISTS "Allow anonymous read"   ON calculator_data;
DROP POLICY IF EXISTS "Allow anonymous insert"  ON calculator_data;
DROP POLICY IF EXISTS "Allow anonymous update"  ON calculator_data;
DROP POLICY IF EXISTS "Allow authenticated read"   ON calculator_data;
DROP POLICY IF EXISTS "Allow authenticated insert"  ON calculator_data;
DROP POLICY IF EXISTS "Allow authenticated update"  ON calculator_data;
DROP POLICY IF EXISTS "Allow authenticated delete"  ON calculator_data;

-- 4. Only authenticated users can read/write/delete
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

CREATE POLICY "Allow authenticated delete"
  ON calculator_data FOR DELETE
  USING (auth.role() = 'authenticated');

-- 5. Name the legacy default row if still unnamed
UPDATE calculator_data
  SET name = 'דירה 1'
  WHERE id = 'default' AND (name IS NULL OR name = '' OR name = 'דירה');

-- 5b. Ensure brokerEnabled flag exists in existing rows
UPDATE calculator_data
  SET data = jsonb_set(data, '{brokerEnabled}', 'true', true)
  WHERE NOT (data ? 'brokerEnabled');

-- 6. Seed a first apartment if the table is completely empty
INSERT INTO calculator_data (id, name, data)
SELECT
  'default',
  'דירה 1',
  '{
    "purchase": [
      {"description": "מחיר דירה (חוזה)", "amount": 1520000},
      {"description": "עורך דין", "amount": 9000},
      {"description": "יועץ משכנתאות", "amount": 8000}
    ],
    "renovation": [
      {"description": "0", "amount": 0}
    ],
    "equity": [
      {"description": "קופת גמל מור ", "amount": 88000},
      {"description": "קופת גמל מגדל", "amount": 80000},
      {"description": "קופת גמל לפידות", "amount": 105000},
      {"description": "מתנה הורים - משכנתא", "amount": 150000},
      {"description": "השקעה מסבא", "amount": 75000},
      {"description": "דולרים", "amount": 20000},
      {"description": "אינטל", "amount": 18000},
      {"description": "קרן כספית", "amount": 108000},
      {"description": "הפניקס פרו", "amount": 0},
      {"description": "בלינק", "amount": 20000}
    ],
    "mortgage": {"amount": 0, "rate": 0, "years": 0},
    "loans": [
      {"description": "הלוואה שיפוץ", "amount": 0, "rate": 5.23, "months": 120}
    ],
    "brokerEnabled": true
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM calculator_data);
