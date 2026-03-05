-- Migration 159: Add reference notification email to companies table
-- This allows agents to configure where reference completion notifications are sent

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS reference_notification_email TEXT;

-- Add comment
COMMENT ON COLUMN companies.reference_notification_email IS 'Email address to receive notifications when tenant references are completed (PASSED, PASS_WITH_GUARANTOR, PASS_WITH_CONDITION, ACTION_REQUIRED, REJECTED). Falls back to company email if not set.';
