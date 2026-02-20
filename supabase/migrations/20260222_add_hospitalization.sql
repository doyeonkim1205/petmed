-- Add discharge_date column for hospitalization records
ALTER TABLE health_records
  ADD COLUMN IF NOT EXISTS discharge_date DATE;
