-- Migration 060: Add offer notification email to companies table
-- This allows agents to configure where offer completion notifications are sent

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS offer_notification_email TEXT;

-- Add comment
COMMENT ON COLUMN companies.offer_notification_email IS 'Email address to receive notifications when tenant offers are completed. Can be set to Slack channel email or any notification service.';

