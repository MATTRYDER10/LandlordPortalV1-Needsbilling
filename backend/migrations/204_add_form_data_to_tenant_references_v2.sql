ALTER TABLE tenant_references_v2
ADD COLUMN IF NOT EXISTS form_data JSONB;

COMMENT ON COLUMN tenant_references_v2.form_data IS 'JSON storage for all form field data submitted by tenant';
