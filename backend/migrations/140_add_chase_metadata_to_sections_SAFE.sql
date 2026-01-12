-- Migration 140: Add Chase Metadata to Verification Sections (SAFE VERSION)
--
-- Merges chase_dependencies functionality into verification_sections
-- Part of the Verify System Simplification (2026-01-12)
--
-- SAFER VERSION: Separates multi-column ALTER TABLE statements

-- ============================================================================
-- 1. ADD NEW SECTION TYPES (External References)
-- ============================================================================

-- Drop old section_type constraint
ALTER TABLE verification_sections
DROP CONSTRAINT IF EXISTS verification_sections_section_type_check;

-- Add new constraint with external reference types
ALTER TABLE verification_sections
ADD CONSTRAINT verification_sections_section_type_check
CHECK (section_type IN (
  'IDENTITY_SELFIE',
  'RTR',
  'INCOME',
  'RESIDENTIAL',
  'CREDIT',
  'AML',
  'EMPLOYER_REFERENCE',
  'LANDLORD_REFERENCE',
  'ACCOUNTANT_REFERENCE'
));

COMMENT ON COLUMN verification_sections.section_type IS 'Section type: IDENTITY_SELFIE, RTR, INCOME, RESIDENTIAL, CREDIT, AML, EMPLOYER_REFERENCE, LANDLORD_REFERENCE, ACCOUNTANT_REFERENCE';

-- ============================================================================
-- 2. ADD CHASE METADATA COLUMNS (Separated for safety)
-- ============================================================================

-- Contact information (encrypted for PII compliance)
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS contact_name_encrypted TEXT;
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS contact_email_encrypted TEXT;
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS contact_phone_encrypted TEXT;

-- Chase tracking timestamps
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS initial_request_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS last_chase_sent_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS next_chase_due_at TIMESTAMP WITH TIME ZONE;

-- Chase attempt counters
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS chase_cycle INTEGER DEFAULT 0;
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS email_attempts INTEGER DEFAULT 0;
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS sms_attempts INTEGER DEFAULT 0;
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS call_attempts INTEGER DEFAULT 0;

-- Form and linking information
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS form_url TEXT;
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS linked_table VARCHAR(50);
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS linked_record_id UUID;

-- Chase-specific metadata
ALTER TABLE verification_sections ADD COLUMN IF NOT EXISTS chase_metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 3. ADD INDEXES FOR CHASE QUEUE QUERIES
-- ============================================================================

-- Index for finding sections in chase queue (NOT_REVIEWED with chase tracking)
CREATE INDEX IF NOT EXISTS idx_ver_sections_chase_queue
ON verification_sections(reference_id, section_type)
WHERE section_type IN ('EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE')
  AND decision = 'NOT_REVIEWED';

-- Index for next_chase_due_at (for scheduled chase jobs)
CREATE INDEX IF NOT EXISTS idx_ver_sections_next_chase
ON verification_sections(next_chase_due_at)
WHERE next_chase_due_at IS NOT NULL
  AND decision = 'NOT_REVIEWED';

-- Index for last chase sent (for cooldown checks)
CREATE INDEX IF NOT EXISTS idx_ver_sections_last_chase
ON verification_sections(last_chase_sent_at)
WHERE last_chase_sent_at IS NOT NULL;

-- ============================================================================
-- 4. ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN verification_sections.contact_name_encrypted IS 'Encrypted contact name for external reference sections (employer, landlord, accountant)';
COMMENT ON COLUMN verification_sections.contact_email_encrypted IS 'Encrypted contact email for chase communications';
COMMENT ON COLUMN verification_sections.contact_phone_encrypted IS 'Encrypted contact phone for SMS chase';
COMMENT ON COLUMN verification_sections.initial_request_sent_at IS 'When the initial request was sent (form link for external references)';
COMMENT ON COLUMN verification_sections.last_chase_sent_at IS 'When the last chase communication was sent';
COMMENT ON COLUMN verification_sections.next_chase_due_at IS 'When the next chase is due (respects 8-hour cooldown and quiet hours)';
COMMENT ON COLUMN verification_sections.chase_cycle IS 'Current chase cycle (0-3). After cycle 3 completes, becomes exhausted';
COMMENT ON COLUMN verification_sections.email_attempts IS 'Number of chase emails sent';
COMMENT ON COLUMN verification_sections.sms_attempts IS 'Number of chase SMS messages sent';
COMMENT ON COLUMN verification_sections.call_attempts IS 'Number of chase calls made';
COMMENT ON COLUMN verification_sections.form_url IS 'URL to the form that needs to be completed (for external references)';
COMMENT ON COLUMN verification_sections.linked_table IS 'Table name where the submitted data is stored (e.g. employer_references)';
COMMENT ON COLUMN verification_sections.linked_record_id IS 'ID of the submitted record in the linked table';
COMMENT ON COLUMN verification_sections.chase_metadata IS 'Additional chase-related metadata (flexible JSONB for future needs)';

-- ============================================================================
-- 5. LOG MIGRATION COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration 140 completed: Chase metadata columns added to verification_sections table';
  RAISE NOTICE 'New section types available: EMPLOYER_REFERENCE, LANDLORD_REFERENCE, ACCOUNTANT_REFERENCE';
END $$;
