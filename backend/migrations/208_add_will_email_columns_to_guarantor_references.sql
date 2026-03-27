ALTER TABLE guarantor_references
ADD COLUMN IF NOT EXISTS tax_return_path TEXT,
ADD COLUMN IF NOT EXISTS tax_return_will_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS bank_statement_will_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS proof_of_funds_path TEXT,
ADD COLUMN IF NOT EXISTS proof_of_funds_will_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS proof_of_additional_income_path TEXT,
ADD COLUMN IF NOT EXISTS proof_of_additional_income_will_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS pension_statement_will_email BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS landlord_rental_bank_statement_will_email BOOLEAN DEFAULT FALSE;
