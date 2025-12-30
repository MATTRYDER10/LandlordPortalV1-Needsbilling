-- Migration: Make employer_references form fields nullable
-- Description: Allows employer_references records to be created with just token info
-- before the employer fills in the actual form data
-- This fixes the bug where resend/tenant submission creates a record with only token fields

-- Make all form data fields nullable (they'll be filled when employer submits the form)
-- Note: Plaintext columns were dropped in migration 008, only _encrypted versions exist
ALTER TABLE employer_references
ALTER COLUMN company_name_encrypted DROP NOT NULL,
ALTER COLUMN employer_name_encrypted DROP NOT NULL,
ALTER COLUMN employer_position_encrypted DROP NOT NULL,
ALTER COLUMN employer_email_encrypted DROP NOT NULL,
ALTER COLUMN employer_phone_encrypted DROP NOT NULL,
ALTER COLUMN employee_position_encrypted DROP NOT NULL,
ALTER COLUMN employment_type DROP NOT NULL,
ALTER COLUMN employment_start_date DROP NOT NULL,
ALTER COLUMN annual_salary_encrypted DROP NOT NULL,
ALTER COLUMN salary_frequency DROP NOT NULL,
ALTER COLUMN is_probation DROP NOT NULL,
ALTER COLUMN employment_status DROP NOT NULL,
ALTER COLUMN signature_encrypted DROP NOT NULL,
ALTER COLUMN date DROP NOT NULL;

-- Add comments for documentation
COMMENT ON TABLE employer_references IS 'Stores employer reference submissions. Records are created when tenant submits form or when resend is triggered (with just token), then updated when employer fills in the actual form.';
