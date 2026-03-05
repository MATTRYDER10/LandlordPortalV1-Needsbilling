-- Migration 178: Update property_documents CHECK constraints to support rent notices
-- Adds 'rent_notice' tag and 'system_generated' source_type

-- Drop and recreate the tag CHECK constraint
ALTER TABLE property_documents DROP CONSTRAINT IF EXISTS property_documents_tag_check;
ALTER TABLE property_documents ADD CONSTRAINT property_documents_tag_check
  CHECK (tag IN ('gas', 'epc', 'agreement', 'reference', 'inventory', 'insurance', 'rent_notice', 'notice', 'other'));

-- Drop and recreate the source_type CHECK constraint
ALTER TABLE property_documents DROP CONSTRAINT IF EXISTS property_documents_source_type_check;
ALTER TABLE property_documents ADD CONSTRAINT property_documents_source_type_check
  CHECK (source_type IN ('direct_upload', 'tenancy', 'reference', 'compliance', 'system_generated'));
