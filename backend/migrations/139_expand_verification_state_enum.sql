-- Migration 139: Expand Verification State Enum
--
-- Adds WAITING_ON_REFERENCES and CANCELLED states to verification_state
-- Part of the Verify System Simplification (2026-01-12)

-- ============================================================================
-- 1. DROP OLD CHECK CONSTRAINT
-- ============================================================================

ALTER TABLE tenant_references
DROP CONSTRAINT IF EXISTS chk_verification_state;

-- ============================================================================
-- 2. ADD NEW CHECK CONSTRAINT WITH EXPANDED STATES
-- ============================================================================

ALTER TABLE tenant_references
ADD CONSTRAINT chk_verification_state
CHECK (verification_state IN (
  'COLLECTING_EVIDENCE',
  'WAITING_ON_REFERENCES',
  'READY_FOR_REVIEW',
  'IN_VERIFICATION',
  'ACTION_REQUIRED',
  'COMPLETED',
  'REJECTED',
  'CANCELLED'
));

COMMENT ON COLUMN tenant_references.verification_state IS 'Explicit verification state: COLLECTING_EVIDENCE -> WAITING_ON_REFERENCES -> READY_FOR_REVIEW -> IN_VERIFICATION -> COMPLETED/REJECTED/ACTION_REQUIRED/CANCELLED';

-- ============================================================================
-- 3. CREATE INDEXES FOR NEW STATES
-- ============================================================================

-- Partial index for WAITING_ON_REFERENCES (for chase queue queries)
CREATE INDEX IF NOT EXISTS idx_tenant_refs_waiting_on_refs
ON tenant_references(id)
WHERE verification_state = 'WAITING_ON_REFERENCES';

-- Partial index for CANCELLED (for filtering out cancelled references)
CREATE INDEX IF NOT EXISTS idx_tenant_refs_cancelled
ON tenant_references(id)
WHERE verification_state = 'CANCELLED';

-- ============================================================================
-- 4. BACKFILL CANCELLED REFERENCES
-- ============================================================================

-- Update references with status='cancelled' to use new CANCELLED state
UPDATE tenant_references
SET verification_state = 'CANCELLED'
WHERE status = 'cancelled'
  AND verification_state != 'CANCELLED';

-- ============================================================================
-- 5. LOG MIGRATION COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 139 completed: verification_state enum expanded with WAITING_ON_REFERENCES and CANCELLED states';
END $$;
