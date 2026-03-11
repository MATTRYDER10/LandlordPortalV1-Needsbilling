ALTER TABLE tenant_references_v2
ADD COLUMN IF NOT EXISTS reposit_eligible BOOLEAN,
ADD COLUMN IF NOT EXISTS reposit_eligibility_notes TEXT;

COMMENT ON COLUMN tenant_references_v2.reposit_eligible IS 'Whether this tenant meets Reposit eligibility criteria';
COMMENT ON COLUMN tenant_references_v2.reposit_eligibility_notes IS 'Notes explaining eligibility status';
