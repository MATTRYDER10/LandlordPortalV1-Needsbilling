-- Fix RLS policy for reference_scores to allow staff to properly upsert scores
-- The issue: INSERT policy allows anyone, but UPDATE policy only allows staff
-- When upsert tries to update an existing record, it fails if user isn't staff

-- Drop the old broad INSERT policy
DROP POLICY IF EXISTS "System can insert reference scores" ON reference_scores;

-- Create a staff-specific INSERT policy
CREATE POLICY "Staff can insert reference scores"
  ON reference_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- The UPDATE policy already exists and is correct:
-- CREATE POLICY "Staff can update reference scores"
--   ON reference_scores
--   FOR UPDATE
--   TO authenticated
--   USING (
--     EXISTS (
--       SELECT 1 FROM staff_users
--       WHERE staff_users.user_id = auth.uid()
--     )
--   );
