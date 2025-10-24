-- Add field to track if previous tenancy is still ongoing (for tenant reference form)
-- This allows tenants to indicate they are still in their current tenancy when applying for a new property

ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS previous_tenancy_still_in_progress BOOLEAN DEFAULT FALSE;

-- Add comment to explain the field
COMMENT ON COLUMN tenant_references.previous_tenancy_still_in_progress IS 'Indicates if the tenant is still in their previous/current tenancy and no end date is known yet';
