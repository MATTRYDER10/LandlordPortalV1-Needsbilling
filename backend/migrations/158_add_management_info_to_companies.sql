-- Add management_info column to companies table
-- This stores the agent's maintenance reporting process for managed tenancies

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS management_info TEXT;

COMMENT ON COLUMN companies.management_info IS 'Free text field for agent to describe their maintenance reporting process, sent to tenants in move-in pack for managed properties';
