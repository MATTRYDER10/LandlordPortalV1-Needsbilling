-- Migration: Fix stuck guarantors with verification_state not set
--
-- Problem: Guarantor references were explicitly skipped in the employer/landlord/agent/accountant
-- reference submission endpoints. When an employer reference was submitted for a guarantor,
-- the code returned early without checking readiness or transitioning verification_state.
--
-- This migration syncs verification_state for any existing stuck guarantor references
-- that have all requirements met (identity + income).

-- Fix guarantors stuck in 'in_progress' with employer reference already submitted
-- Guarantors require: Identity (ID + selfie) + Income (one of: employer ref, payslip, accountant ref, tax return, other proof)
UPDATE tenant_references tr
SET
    status = 'pending_verification',
    verification_state = 'READY_FOR_REVIEW',
    updated_at = NOW()
WHERE tr.is_guarantor = true
  AND tr.status = 'in_progress'
  AND tr.submitted_at IS NOT NULL
  AND (tr.verification_state IS NULL OR tr.verification_state = 'COLLECTING_EVIDENCE')
  -- Has identity (both required)
  AND tr.id_document_path IS NOT NULL
  AND tr.selfie_path IS NOT NULL
  -- Has income (any one of the income types)
  AND (
    -- Check for employer reference with submitted_at
    EXISTS (
      SELECT 1 FROM employer_references er
      WHERE er.reference_id = tr.id
      AND er.submitted_at IS NOT NULL
    )
    OR tr.proof_of_additional_income_path IS NOT NULL
    OR tr.other_proof_of_funds_path IS NOT NULL
    OR tr.tax_return_path IS NOT NULL
    OR (tr.payslip_files IS NOT NULL AND array_length(tr.payslip_files, 1) > 0)
    -- Check for accountant reference with submitted_at
    OR EXISTS (
      SELECT 1 FROM accountant_references ar
      WHERE ar.tenant_reference_id = tr.id
      AND ar.submitted_at IS NOT NULL
    )
  );
