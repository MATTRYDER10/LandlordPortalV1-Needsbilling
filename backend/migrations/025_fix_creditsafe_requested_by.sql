-- Fix creditsafe_verifications.requested_by to be nullable
-- Staff users are in staff_users table, not auth.users
-- Make requested_by nullable so automatic verifications can have NULL

-- Drop the existing foreign key constraint
ALTER TABLE creditsafe_verifications 
DROP CONSTRAINT IF EXISTS creditsafe_verifications_requested_by_fkey;

-- Make requested_by nullable (it may already be, but this ensures it)
ALTER TABLE creditsafe_verifications 
ALTER COLUMN requested_by DROP NOT NULL;

-- Add a new foreign key constraint that allows NULL
-- Reference staff_users instead of auth.users
ALTER TABLE creditsafe_verifications
ADD CONSTRAINT creditsafe_verifications_requested_by_fkey 
FOREIGN KEY (requested_by) REFERENCES staff_users(id) ON DELETE SET NULL;

COMMENT ON COLUMN creditsafe_verifications.requested_by IS 'Staff user who manually triggered verification. NULL for automatic verifications.';
