-- Add signature_name column to landlord_references
ALTER TABLE landlord_references
ADD COLUMN signature_name TEXT;

-- Add signature_name column to employer_references
ALTER TABLE employer_references
ADD COLUMN signature_name TEXT;
