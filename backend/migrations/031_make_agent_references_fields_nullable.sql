-- Make optional fields nullable in agent_references table
-- Agent references have a simpler format than landlord references

ALTER TABLE agent_references
ALTER COLUMN property_condition DROP NOT NULL,
ALTER COLUMN neighbour_complaints DROP NOT NULL,
ALTER COLUMN breach_of_tenancy DROP NOT NULL;

-- Add comments
COMMENT ON COLUMN agent_references.property_condition IS 'Optional - property condition assessment';
COMMENT ON COLUMN agent_references.neighbour_complaints IS 'Optional - neighbour complaints status';
COMMENT ON COLUMN agent_references.breach_of_tenancy IS 'Optional - breach of tenancy status';
