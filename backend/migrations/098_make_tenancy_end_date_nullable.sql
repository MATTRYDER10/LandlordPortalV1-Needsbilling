-- Make tenancy_end_date nullable in landlord_references and agent_references tables
-- This is required to support "Tenant in Situ" and "Notice Given" tenancy statuses
-- where the tenant has not yet vacated and there is no end date

-- Make tenancy_end_date nullable in landlord_references
ALTER TABLE landlord_references
ALTER COLUMN tenancy_end_date DROP NOT NULL;

-- Make tenancy_end_date nullable in agent_references
ALTER TABLE agent_references
ALTER COLUMN tenancy_end_date DROP NOT NULL;

-- Add comments explaining why these columns are nullable
COMMENT ON COLUMN landlord_references.tenancy_end_date IS 'End date of tenancy. NULL when tenant is still in situ or has served notice but not yet vacated.';
COMMENT ON COLUMN agent_references.tenancy_end_date IS 'End date of tenancy. NULL when tenant is still in situ or has served notice but not yet vacated.';
