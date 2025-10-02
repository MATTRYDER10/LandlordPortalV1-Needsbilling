-- Migration to remove deprecated fields from tenant_references
-- Run this in Supabase SQL Editor ONLY after confirming the new fields work correctly
-- WARNING: This will permanently delete the old columns and their data

-- Remove deprecated columns
ALTER TABLE tenant_references
DROP COLUMN IF EXISTS employer_contact,
DROP COLUMN IF EXISTS previous_address,
DROP COLUMN IF EXISTS previous_tenancy_duration;

-- Note: Make sure to backup your data before running this migration
-- You can only run this after all existing data has been migrated to the new fields
