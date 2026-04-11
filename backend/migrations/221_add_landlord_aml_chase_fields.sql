ALTER TABLE landlord_aml_checks
  ADD COLUMN IF NOT EXISTS last_chased_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE landlord_aml_checks
  ADD COLUMN IF NOT EXISTS chase_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_landlord_aml_checks_pending_chase
  ON landlord_aml_checks(verification_status, last_chased_at)
  WHERE verification_status = 'pending';
