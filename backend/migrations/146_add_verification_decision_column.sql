-- Add verification_decision column to store staff's authoritative final decision
-- This is separate from reference_scores.decision which contains the auto-computed scoring value

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS verification_decision VARCHAR(50);

COMMENT ON COLUMN tenant_references.verification_decision IS
  'Staff final verification decision: PASS, PASS_WITH_CONDITION, PASS_WITH_GUARANTOR, REFER, FAIL. Takes precedence over reference_scores.decision';

CREATE INDEX IF NOT EXISTS idx_tenant_references_verification_decision
  ON tenant_references(verification_decision);
