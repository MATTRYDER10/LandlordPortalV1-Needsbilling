-- Make guarantor fields nullable for placeholder records
-- When tenant submits with guarantor, we create a placeholder with just name/email
-- The guarantor fills in the rest when they complete their form

ALTER TABLE guarantor_references
ALTER COLUMN date_of_birth_encrypted DROP NOT NULL,
ALTER COLUMN contact_number_encrypted DROP NOT NULL,
ALTER COLUMN email_encrypted DROP NOT NULL,
ALTER COLUMN current_address_line1_encrypted DROP NOT NULL,
ALTER COLUMN current_city_encrypted DROP NOT NULL,
ALTER COLUMN current_postcode_encrypted DROP NOT NULL,
ALTER COLUMN employment_status DROP NOT NULL;

-- Add comment
COMMENT ON TABLE guarantor_references IS 'Stores guarantor reference information. Initial record created with basic info from tenant submission, then guarantor completes the full form.';
