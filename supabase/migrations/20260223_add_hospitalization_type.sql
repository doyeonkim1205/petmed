-- Add 'hospitalization' to record_type check constraint
ALTER TABLE health_records DROP CONSTRAINT IF EXISTS health_records_record_type_check;
ALTER TABLE health_records ADD CONSTRAINT health_records_record_type_check
  CHECK (record_type IN ('symptom', 'visit', 'hospitalization', 'manual'));
