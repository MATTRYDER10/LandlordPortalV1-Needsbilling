-- Migration: Fix rtr_verified for references where RTR section was already passed
-- This is a one-time data fix for existing references

-- Update tenant_references.rtr_verified = true where:
-- 1. RTR section exists with PASS or PASS_WITH_CONDITION decision
-- 2. rtr_verified is currently false or null
-- 3. is_british_citizen is false (RTR check was required)

UPDATE tenant_references tr
SET
  rtr_verified = true,
  rtr_verification_date = COALESCE(tr.rtr_verification_date, vs.decision_at)
FROM verification_sections vs
WHERE vs.reference_id = tr.id
  AND vs.section_type = 'RTR'
  AND vs.decision IN ('PASS', 'PASS_WITH_CONDITION')
  AND (tr.rtr_verified = false OR tr.rtr_verified IS NULL)
  AND tr.is_british_citizen = false;
