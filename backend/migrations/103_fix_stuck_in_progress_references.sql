-- Migration: Fix references stuck in 'in_progress' that don't require third-party references
-- These should have been moved to 'pending_verification' but weren't due to a bug
-- where the status update only triggered when a third-party reference was submitted

-- This affects tenants like students living with family who:
-- 1. Don't need an employer reference (student/unemployed/benefits)
-- 2. Don't need an accountant reference (not self-employed)
-- 3. Don't need a landlord/agent reference (living with family)

UPDATE tenant_references
SET status = 'pending_verification',
    updated_at = NOW()
WHERE status = 'in_progress'
  AND submitted_at IS NOT NULL  -- Form was actually submitted
  AND is_guarantor = false      -- Not a guarantor reference
  AND is_group_parent = false   -- Not a group parent (those aggregate child statuses)
  -- No employer reference required (no email provided)
  AND employer_ref_email_encrypted IS NULL
  -- No accountant reference required (not self-employed OR no accountant email)
  AND (income_self_employed = false OR accountant_email_encrypted IS NULL)
  -- No residential reference required (no landlord email provided)
  AND previous_landlord_email_encrypted IS NULL;
