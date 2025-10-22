-- Migration: Add consent signature fields and PDF path
-- Created: 2025-10-22

-- Add consent fields for referencing consent declaration
ALTER TABLE public.tenant_references
  ADD COLUMN IF NOT EXISTS consent_signature TEXT,
  ADD COLUMN IF NOT EXISTS consent_applicant_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS consent_printed_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS consent_agreed_date DATE,
  ADD COLUMN IF NOT EXISTS consent_pdf_path TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.tenant_references.consent_signature IS 'Base64 encoded signature image for consent declaration';
COMMENT ON COLUMN public.tenant_references.consent_applicant_name_encrypted IS 'Applicant full name from consent form (encrypted)';
COMMENT ON COLUMN public.tenant_references.consent_printed_name_encrypted IS 'Printed full name from consent form (encrypted)';
COMMENT ON COLUMN public.tenant_references.consent_agreed_date IS 'Date when consent was agreed';
COMMENT ON COLUMN public.tenant_references.consent_pdf_path IS 'Path to the generated consent PDF document';
