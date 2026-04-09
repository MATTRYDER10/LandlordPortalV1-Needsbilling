ALTER TABLE arrears_chases
ADD COLUMN IF NOT EXISTS silenced_until TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN arrears_chases.silenced_until IS 'When set, arrears emails are suppressed until this date';
