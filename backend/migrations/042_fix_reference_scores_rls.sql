-- Fix RLS policy for reference_scores to allow company users to view their own scores
-- Currently only staff can view scores, but company users need to see scores for their references

-- Add RLS Policy: Company users can view scores for their own references
CREATE POLICY "Company users can view their reference scores"
  ON reference_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tenant_references tr
      JOIN company_users cu ON cu.company_id = tr.company_id
      WHERE tr.id = reference_scores.reference_id
        AND cu.user_id = auth.uid()
    )
  );
