-- Fix the scored_by foreign key constraint
-- The scored_by field should be nullable since it might be auto-scored
-- Also, it should allow any UUID without a foreign key constraint since staff_users
-- might not be in auth.users table

ALTER TABLE reference_scores
  DROP CONSTRAINT IF EXISTS reference_scores_scored_by_fkey;

-- Make scored_by nullable
ALTER TABLE reference_scores
  ALTER COLUMN scored_by DROP NOT NULL;

-- Add a comment explaining this field
COMMENT ON COLUMN reference_scores.scored_by IS 'UUID of the staff user who triggered scoring (auto-scored or manual). Not enforced by foreign key since staff users may not be in auth.users.';
