-- Add data_profile column to uploads for the smart chart engine
ALTER TABLE uploads
  ADD COLUMN IF NOT EXISTS data_profile jsonb;

-- Increase preview column expectation (no schema change needed, jsonb handles any size)
-- Note: preview now stores up to 500 rows instead of 10
