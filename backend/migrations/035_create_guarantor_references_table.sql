-- Create guarantor_references table
-- Stores information about guarantors for tenant references
-- TODO: When credit system is implemented, processing a guarantor reference should consume an additional credit

CREATE TABLE IF NOT EXISTS guarantor_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

  -- Personal Information (encrypted)
  guarantor_first_name_encrypted TEXT NOT NULL,
  guarantor_last_name_encrypted TEXT NOT NULL,
  middle_name_encrypted TEXT,
  date_of_birth_encrypted TEXT NOT NULL,
  contact_number_encrypted TEXT NOT NULL,
  email_encrypted TEXT NOT NULL,
  nationality_encrypted TEXT,

  -- Relationship to Tenant
  relationship_to_tenant TEXT NOT NULL, -- parent, guardian, spouse, etc.

  -- ID Verification
  id_document_type TEXT, -- passport, drivers_license, national_id
  id_document_path TEXT, -- Path to uploaded ID document
  selfie_path TEXT, -- Path to selfie for verification

  -- Current Address (encrypted)
  current_address_line1_encrypted TEXT NOT NULL,
  current_address_line2_encrypted TEXT,
  current_city_encrypted TEXT NOT NULL,
  current_postcode_encrypted TEXT NOT NULL,
  current_country_encrypted TEXT,
  time_at_address_years INT,
  time_at_address_months INT,
  proof_of_address_path TEXT,

  -- Home Ownership Status
  home_ownership_status TEXT, -- owner, renting, living_with_family, other

  -- Employment & Income Information
  employment_status TEXT NOT NULL, -- employed, self_employed, retired, other

  -- If Employed
  employer_name_encrypted TEXT,
  job_title_encrypted TEXT,
  employment_start_date DATE,
  annual_income_encrypted TEXT,
  employment_contract_type TEXT, -- full_time, part_time, contract, etc.

  -- If Self-Employed
  business_name_encrypted TEXT,
  nature_of_business_encrypted TEXT,
  years_trading INT,
  annual_turnover_encrypted TEXT,

  -- If Retired
  pension_amount_encrypted TEXT,
  pension_frequency TEXT, -- monthly, annually

  -- Additional Income
  other_income_source_encrypted TEXT,
  other_income_amount_encrypted TEXT,

  -- Savings & Assets
  savings_amount_encrypted TEXT,
  property_value_encrypted TEXT, -- If they own property
  other_assets_encrypted TEXT,

  -- Financial Obligations
  monthly_mortgage_rent_encrypted TEXT,
  other_monthly_commitments_encrypted TEXT,
  total_monthly_expenditure_encrypted TEXT,

  -- Credit & Financial History
  adverse_credit BOOLEAN DEFAULT FALSE,
  adverse_credit_details_encrypted TEXT,

  -- Bank Details (for verification)
  bank_statement_path TEXT, -- Path to uploaded bank statement

  -- Previous Guarantor Experience
  previously_acted_as_guarantor BOOLEAN DEFAULT FALSE,
  previous_guarantor_details_encrypted TEXT,

  -- Understanding & Consent
  understands_obligations BOOLEAN DEFAULT FALSE,
  willing_to_pay_rent BOOLEAN DEFAULT FALSE,
  willing_to_pay_damages BOOLEAN DEFAULT FALSE,
  consent_signature TEXT,
  consent_signature_name TEXT,
  consent_date DATE,

  -- Additional Information
  additional_comments_encrypted TEXT,

  -- Submission tracking
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_guarantor_references_reference_id ON guarantor_references(reference_id);

-- Add comments
COMMENT ON TABLE guarantor_references IS 'Stores guarantor reference information for tenant applications requiring a guarantor';
COMMENT ON COLUMN guarantor_references.reference_id IS 'Links to the main tenant reference that requires this guarantor';
COMMENT ON COLUMN guarantor_references.relationship_to_tenant IS 'Relationship of guarantor to the tenant (parent, guardian, etc.)';
COMMENT ON COLUMN guarantor_references.home_ownership_status IS 'Whether guarantor owns their home, rents, or lives with family';
COMMENT ON COLUMN guarantor_references.employment_status IS 'Current employment status of guarantor';
COMMENT ON COLUMN guarantor_references.understands_obligations IS 'Confirms guarantor understands their legal obligations';
COMMENT ON COLUMN guarantor_references.willing_to_pay_rent IS 'Confirms guarantor is willing to pay rent if tenant defaults';
COMMENT ON COLUMN guarantor_references.willing_to_pay_damages IS 'Confirms guarantor is willing to pay for damages if tenant defaults';
COMMENT ON COLUMN guarantor_references.previously_acted_as_guarantor IS 'Whether this person has been a guarantor before';
