-- Remove unused fields from agent_references table
-- Agent references have a simpler format than landlord references
-- Agent form only asks: rent_paid_on_time, good_tenant, would_rent_again

ALTER TABLE agent_references
DROP COLUMN IF EXISTS property_condition,
DROP COLUMN IF EXISTS property_condition_details_encrypted,
DROP COLUMN IF EXISTS neighbour_complaints,
DROP COLUMN IF EXISTS neighbour_complaints_details_encrypted,
DROP COLUMN IF EXISTS breach_of_tenancy,
DROP COLUMN IF EXISTS breach_of_tenancy_details_encrypted,
DROP COLUMN IF EXISTS rent_paid_on_time_details_encrypted,
DROP COLUMN IF EXISTS would_rent_again_details_encrypted;

-- Add good_tenant column if it doesn't exist
ALTER TABLE agent_references
ADD COLUMN IF NOT EXISTS good_tenant TEXT;

-- Add comment
COMMENT ON COLUMN agent_references.good_tenant IS 'Response to "Have they been a good tenant" question';
