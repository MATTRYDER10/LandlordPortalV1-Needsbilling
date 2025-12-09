-- Migration 101: Enable user deletion by setting references to NULL
-- This migration alters foreign key constraints to allow user deletion while preserving audit history

ALTER TABLE reference_notes ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE reference_notes
  DROP CONSTRAINT IF EXISTS reference_notes_created_by_fkey;
ALTER TABLE reference_notes
  ADD CONSTRAINT reference_notes_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE landlord_aml_checks
  DROP CONSTRAINT IF EXISTS landlord_aml_checks_requested_by_fkey;
ALTER TABLE landlord_aml_checks
  ADD CONSTRAINT landlord_aml_checks_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE landlord_aml_checks
  DROP CONSTRAINT IF EXISTS landlord_aml_checks_verified_by_fkey;
ALTER TABLE landlord_aml_checks
  ADD CONSTRAINT landlord_aml_checks_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE tenant_offers
  DROP CONSTRAINT IF EXISTS tenant_offers_approved_by_fkey;
ALTER TABLE tenant_offers
  ADD CONSTRAINT tenant_offers_approved_by_fkey
  FOREIGN KEY (approved_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE tenant_offers
  DROP CONSTRAINT IF EXISTS tenant_offers_declined_by_fkey;
ALTER TABLE tenant_offers
  ADD CONSTRAINT tenant_offers_declined_by_fkey
  FOREIGN KEY (declined_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE tenant_offers
  DROP CONSTRAINT IF EXISTS tenant_offers_accepted_with_changes_by_fkey;
ALTER TABLE tenant_offers
  ADD CONSTRAINT tenant_offers_accepted_with_changes_by_fkey
  FOREIGN KEY (accepted_with_changes_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE landlords
  DROP CONSTRAINT IF EXISTS landlords_aml_checked_by_fkey;
ALTER TABLE landlords
  ADD CONSTRAINT landlords_aml_checked_by_fkey
  FOREIGN KEY (aml_checked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE verification_checks
  DROP CONSTRAINT IF EXISTS verification_checks_verified_by_fkey;
ALTER TABLE verification_checks
  ADD CONSTRAINT verification_checks_verified_by_fkey
  FOREIGN KEY (verified_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE reference_scores
  DROP CONSTRAINT IF EXISTS reference_scores_scored_by_fkey;
ALTER TABLE reference_scores
  ADD CONSTRAINT reference_scores_scored_by_fkey
  FOREIGN KEY (scored_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE creditsafe_verifications
  DROP CONSTRAINT IF EXISTS creditsafe_verifications_requested_by_fkey;
ALTER TABLE creditsafe_verifications
  ADD CONSTRAINT creditsafe_verifications_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE reference_audit_log
  DROP CONSTRAINT IF EXISTS reference_audit_log_created_by_fkey;
ALTER TABLE reference_audit_log
  ADD CONSTRAINT reference_audit_log_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE reference_documents
  DROP CONSTRAINT IF EXISTS reference_documents_uploaded_by_fkey;
ALTER TABLE reference_documents
  ADD CONSTRAINT reference_documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
