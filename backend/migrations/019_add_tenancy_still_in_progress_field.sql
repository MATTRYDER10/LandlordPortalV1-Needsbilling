-- Add field to track if tenancy is still ongoing (for landlord references)
-- This allows landlords to indicate the tenant is still in tenancy rather than requiring an end date

ALTER TABLE landlord_references
ADD COLUMN IF NOT EXISTS tenancy_still_in_progress BOOLEAN DEFAULT FALSE;

-- Add comment to explain the field
COMMENT ON COLUMN landlord_references.tenancy_still_in_progress IS 'Indicates if the tenant is still in tenancy and no end date is known yet';
