-- Add signature fields to accountant_references table
ALTER TABLE accountant_references
ADD COLUMN signature_name TEXT,
ADD COLUMN signature TEXT,
ADD COLUMN date DATE;

-- Add comments
COMMENT ON COLUMN accountant_references.signature_name IS 'Full name of the person signing the reference';
COMMENT ON COLUMN accountant_references.signature IS 'Digital signature image data (base64)';
COMMENT ON COLUMN accountant_references.date IS 'Date of signature';
