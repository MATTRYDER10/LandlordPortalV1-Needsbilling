-- Migration: Add last_marked_done_at column to verification_sections
-- Purpose: Support "Pending Responses" queue behavior where staff can mark items
--          as "done for today" and they reappear the next day if still pending

-- Add last_marked_done_at column to track when staff last marked an item as done
ALTER TABLE verification_sections
ADD COLUMN IF NOT EXISTS last_marked_done_at TIMESTAMPTZ;

-- Add index for efficient queue filtering (items where last_marked_done_at is NULL or old)
CREATE INDEX IF NOT EXISTS idx_verification_sections_last_marked_done_at
ON verification_sections (last_marked_done_at)
WHERE last_marked_done_at IS NOT NULL;

-- Add composite index for common queue query pattern
CREATE INDEX IF NOT EXISTS idx_verification_sections_chase_queue
ON verification_sections (section_type, decision, initial_request_sent_at, last_marked_done_at)
WHERE section_type IN ('EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE')
AND decision = 'NOT_REVIEWED';

COMMENT ON COLUMN verification_sections.last_marked_done_at IS
'Timestamp when staff last marked this item as "done for today" in the Pending Responses queue. Items reappear at 8:55am UK the next day if still pending.';

-- Add source column to reference_notes for tracking where notes came from
ALTER TABLE reference_notes
ADD COLUMN IF NOT EXISTS source VARCHAR(50);

COMMENT ON COLUMN reference_notes.source IS
'Source of the note: NULL for manual staff notes, PENDING_RESPONSE_QUEUE for notes from mark-done action';

-- Also need to allow agents (company users) to read notes from reference_notes
-- Create policy for agents to view notes on their company's references
CREATE POLICY IF NOT EXISTS "Agents can view notes on their references"
  ON reference_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tenant_references tr
      JOIN company_users cu ON cu.company_id = tr.company_id
      WHERE tr.id = reference_notes.reference_id
      AND cu.user_id = auth.uid()
    )
  );
