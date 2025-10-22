-- Migration: Remove consent_applicant_name_encrypted field (redundant with consent_printed_name_encrypted)
-- Created: 2025-10-22

-- Remove the consent_applicant_name_encrypted column as it's redundant
-- The printed name field serves the same purpose
ALTER TABLE public.tenant_references
  DROP COLUMN IF EXISTS consent_applicant_name_encrypted;
