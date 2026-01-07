-- Add British citizen document fields and staff verification fields for Right to Rent
-- British citizens now need passport OR (no passport + DL or birth certificate)
-- International tenants need share code entry with optional evidence upload
-- Staff can confirm share code and enter expiry date for international tenants

-- British citizen document fields
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS rtr_british_passport_path TEXT,
ADD COLUMN IF NOT EXISTS rtr_british_no_passport BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rtr_british_alt_doc_type TEXT,
ADD COLUMN IF NOT EXISTS rtr_british_alt_doc_path TEXT;

-- Staff verification fields (for international tenants)
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS rtr_staff_expiry_date DATE,
ADD COLUMN IF NOT EXISTS rtr_staff_share_code_confirmed TEXT;

-- Add comments
COMMENT ON COLUMN tenant_references.rtr_british_passport_path IS 'British citizen passport document path';
COMMENT ON COLUMN tenant_references.rtr_british_no_passport IS 'British citizen indicated they do not have a passport';
COMMENT ON COLUMN tenant_references.rtr_british_alt_doc_type IS 'Alternative document type for British citizens without passport: driving_license or birth_certificate';
COMMENT ON COLUMN tenant_references.rtr_british_alt_doc_path IS 'Alternative document path for British citizens without passport';
COMMENT ON COLUMN tenant_references.rtr_staff_expiry_date IS 'Staff-entered visa/permit expiry date for international tenants';
COMMENT ON COLUMN tenant_references.rtr_staff_share_code_confirmed IS 'Staff-confirmed share code value';
