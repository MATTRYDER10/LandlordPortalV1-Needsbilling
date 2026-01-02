-- Migration: Fix stuck references with verification_state not set
--
-- Problem: References with status='pending_verification' but verification_state
-- is NULL or 'COLLECTING_EVIDENCE' don't appear in the verify queue because
-- the queue filters by verification_state (not status).
--
-- Additional issues fixed:
-- 1. proof_of_additional_income_path wasn't checked for income requirement
-- 2. reference_type='living_with_family' wasn't checked for residential requirement
--
-- This migration syncs verification_state for any existing stuck references.

-- Fix references stuck with status='pending_verification' but wrong verification_state
UPDATE tenant_references
SET
    verification_state = 'READY_FOR_REVIEW',
    updated_at = NOW()
WHERE status = 'pending_verification'
  AND (verification_state IS NULL OR verification_state = 'COLLECTING_EVIDENCE');

-- Fix references that are actually ready but stuck in 'in_progress' because
-- readiness checks didn't recognize living_with_family or proof_of_additional_income_path
-- Criteria: submitted, has identity (both), is British citizen, has income proof, has residential
UPDATE tenant_references
SET
    status = 'pending_verification',
    verification_state = 'READY_FOR_REVIEW',
    updated_at = NOW()
WHERE status = 'in_progress'
  AND submitted_at IS NOT NULL
  AND (verification_state IS NULL OR verification_state = 'COLLECTING_EVIDENCE')
  AND is_guarantor = false
  -- Has identity
  AND id_document_path IS NOT NULL
  AND selfie_path IS NOT NULL
  -- Has RTR (British citizen or has RTR docs)
  AND (is_british_citizen = true OR rtr_share_code IS NOT NULL OR rtr_alternative_document_path IS NOT NULL)
  -- Has income (any proof)
  AND (
    proof_of_additional_income_path IS NOT NULL
    OR other_proof_of_funds_path IS NOT NULL
    OR tax_return_path IS NOT NULL
    OR (payslip_files IS NOT NULL AND array_length(payslip_files, 1) > 0)
  )
  -- Has residential (living with family or has other residential proof)
  AND (
    reference_type = 'living_with_family'
    OR confirmed_residential_status IS NOT NULL
    OR tenancy_agreement_path IS NOT NULL
  );
