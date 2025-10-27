-- Add field to track if tenancy is still ongoing (for agent references)
-- This allows agents to indicate the tenant is still in tenancy/contract rather than requiring an end date

ALTER TABLE agent_references
ADD COLUMN IF NOT EXISTS tenancy_still_in_progress BOOLEAN DEFAULT FALSE;

-- Add comment to explain the field
COMMENT ON COLUMN agent_references.tenancy_still_in_progress IS 'Indicates if the tenant is still in tenancy/contract and no end date is known yet - RED FLAG for new applications';
