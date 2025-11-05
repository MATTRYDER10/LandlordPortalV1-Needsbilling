-- Migration: Add consent_printed_name_encrypted field to guarantor_references
-- This field stores the printed name for guarantor consent forms (encrypted)

ALTER TABLE public.guarantor_references
  ADD COLUMN IF NOT EXISTS consent_printed_name_encrypted TEXT;

-- Add comment
COMMENT ON COLUMN public.guarantor_references.consent_printed_name_encrypted IS 'Printed full name from guarantor consent form (encrypted)';
