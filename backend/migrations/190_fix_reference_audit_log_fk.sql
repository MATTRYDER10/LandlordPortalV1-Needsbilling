-- Migration 190: Fix reference_audit_log created_by FK to point to auth.users
-- The constraint may have been recreated pointing to public.users instead of auth.users

ALTER TABLE reference_audit_log
  DROP CONSTRAINT IF EXISTS reference_audit_log_created_by_fkey;

ALTER TABLE reference_audit_log
  ADD CONSTRAINT reference_audit_log_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
