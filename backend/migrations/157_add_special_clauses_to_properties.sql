-- Add special_clauses column to properties table
-- These are unique clauses per property that fall into clause 11 of the AST agreement

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS special_clauses JSONB DEFAULT '[]'::jsonb;

-- Add index for querying properties with clauses
CREATE INDEX IF NOT EXISTS idx_properties_special_clauses ON properties USING GIN (special_clauses);

-- Comment for documentation
COMMENT ON COLUMN properties.special_clauses IS 'Array of special clauses specific to this property, used in agreement clause 11';
