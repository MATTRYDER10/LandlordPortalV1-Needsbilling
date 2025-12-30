-- Migration 125: Verification State Model
--
-- Introduces explicit verification state tracking instead of derived readiness.
-- Part of the Verify Queue Logic Refactor (GitHub Issue #40).

-- ============================================================================
-- 1. ADD NEW EVIDENCE COLUMNS
-- ============================================================================

-- Other Proof of Funds - new income evidence type
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS other_proof_of_funds_path TEXT;

-- Tenancy Agreement - new residential evidence type
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS tenancy_agreement_path TEXT;

COMMENT ON COLUMN tenant_references.other_proof_of_funds_path IS 'Path to uploaded proof of other funds (new income evidence type)';
COMMENT ON COLUMN tenant_references.tenancy_agreement_path IS 'Path to uploaded tenancy agreement (new residential evidence type)';

-- ============================================================================
-- 2. ADD VERIFICATION STATE COLUMN
-- ============================================================================

-- Add verification_state column with check constraint for valid values
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS verification_state VARCHAR(30);

-- Add check constraint (separate statement for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_verification_state'
  ) THEN
    ALTER TABLE tenant_references
    ADD CONSTRAINT chk_verification_state
    CHECK (verification_state IN (
      'COLLECTING_EVIDENCE',
      'READY_FOR_REVIEW',
      'IN_VERIFICATION',
      'ACTION_REQUIRED',
      'COMPLETED',
      'REJECTED'
    ));
  END IF;
END $$;

COMMENT ON COLUMN tenant_references.verification_state IS 'Explicit verification state: COLLECTING_EVIDENCE -> READY_FOR_REVIEW -> IN_VERIFICATION -> COMPLETED/REJECTED/ACTION_REQUIRED';

-- ============================================================================
-- 3. CREATE INDEX FOR QUEUE QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_refs_verification_state
ON tenant_references(verification_state);

-- Partial indexes for common queue queries
CREATE INDEX IF NOT EXISTS idx_tenant_refs_ready_for_review
ON tenant_references(id)
WHERE verification_state = 'READY_FOR_REVIEW';

CREATE INDEX IF NOT EXISTS idx_tenant_refs_in_verification
ON tenant_references(id)
WHERE verification_state = 'IN_VERIFICATION';

-- ============================================================================
-- 4. BACKFILL VERIFICATION STATE FROM EXISTING STATUS
-- ============================================================================

UPDATE tenant_references
SET verification_state =
  CASE
    -- Form not submitted yet
    WHEN status = 'pending' THEN 'COLLECTING_EVIDENCE'

    -- Form submitted, collecting evidence
    WHEN status = 'in_progress' THEN 'COLLECTING_EVIDENCE'

    -- Ready for staff verification
    WHEN status = 'pending_verification' THEN 'READY_FOR_REVIEW'

    -- Staff requested more info
    WHEN status = 'action_required' THEN 'ACTION_REQUIRED'

    -- Verification passed
    WHEN status = 'completed' THEN 'COMPLETED'

    -- Verification failed
    WHEN status = 'rejected' THEN 'REJECTED'

    -- Cancelled references
    WHEN status = 'cancelled' THEN 'REJECTED'

    -- Default fallback
    ELSE 'COLLECTING_EVIDENCE'
  END
WHERE verification_state IS NULL;

-- ============================================================================
-- 5. ADD INDEXES FOR NEW EVIDENCE COLUMNS (PARTIAL)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_refs_other_proof_funds
ON tenant_references(other_proof_of_funds_path)
WHERE other_proof_of_funds_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_refs_tenancy_agreement
ON tenant_references(tenancy_agreement_path)
WHERE tenancy_agreement_path IS NOT NULL;
