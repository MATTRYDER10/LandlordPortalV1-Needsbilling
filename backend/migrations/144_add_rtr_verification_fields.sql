-- Migration 144: Add RTR Verification Fields
--
-- Adds fields for tracking RTR verification method, indefinite leave status, and notes
-- These fields support the enhanced verification workflow

-- ============================================================================
-- 1. ADD NEW COLUMNS
-- ============================================================================

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS rtr_indefinite_leave BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rtr_verification_method TEXT,
ADD COLUMN IF NOT EXISTS rtr_verification_notes TEXT;

-- ============================================================================
-- 2. ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN tenant_references.rtr_indefinite_leave IS 'Whether tenant has indefinite leave to remain (no expiry date needed)';
COMMENT ON COLUMN tenant_references.rtr_verification_method IS 'Method used to verify RTR (e.g., share_code_online, document_check, employer_check)';
COMMENT ON COLUMN tenant_references.rtr_verification_notes IS 'Staff notes about the RTR verification process';

-- ============================================================================
-- 3. LOG MIGRATION COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 144 completed: Added rtr_indefinite_leave, rtr_verification_method, and rtr_verification_notes columns';
END $$;
