-- Comprehensive Tenant Reference Form Migration
-- This migration adds all fields needed for the new multi-page tenant reference form

-- Add new fields to tenant_references table (one at a time to avoid conflicts)
DO $$
BEGIN
  -- Page 1-2: ID and Personal Details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'middle_name') THEN
    ALTER TABLE tenant_references ADD COLUMN middle_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'date_of_birth') THEN
    ALTER TABLE tenant_references ADD COLUMN date_of_birth DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'contact_number') THEN
    ALTER TABLE tenant_references ADD COLUMN contact_number TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'nationality') THEN
    ALTER TABLE tenant_references ADD COLUMN nationality TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'id_document_type') THEN
    ALTER TABLE tenant_references ADD COLUMN id_document_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'id_document_path') THEN
    ALTER TABLE tenant_references ADD COLUMN id_document_path TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'selfie_path') THEN
    ALTER TABLE tenant_references ADD COLUMN selfie_path TEXT;
  END IF;

  -- Page 4-5: Address Details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'current_address_line1') THEN
    ALTER TABLE tenant_references ADD COLUMN current_address_line1 TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'current_address_line2') THEN
    ALTER TABLE tenant_references ADD COLUMN current_address_line2 TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'current_city') THEN
    ALTER TABLE tenant_references ADD COLUMN current_city TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'current_postcode') THEN
    ALTER TABLE tenant_references ADD COLUMN current_postcode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'current_country') THEN
    ALTER TABLE tenant_references ADD COLUMN current_country TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'proof_of_address_path') THEN
    ALTER TABLE tenant_references ADD COLUMN proof_of_address_path TEXT;
  END IF;

  -- Page 6: Financial Information - Income Sources
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'income_regular_employment') THEN
    ALTER TABLE tenant_references ADD COLUMN income_regular_employment BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'income_benefits') THEN
    ALTER TABLE tenant_references ADD COLUMN income_benefits BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'income_savings_pension_investments') THEN
    ALTER TABLE tenant_references ADD COLUMN income_savings_pension_investments BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'income_student') THEN
    ALTER TABLE tenant_references ADD COLUMN income_student BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'income_unemployed') THEN
    ALTER TABLE tenant_references ADD COLUMN income_unemployed BOOLEAN DEFAULT false;
  END IF;

  -- Employment Details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_contract_type') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_contract_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_is_hourly') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_is_hourly BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_hours_per_month') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_hours_per_month INTEGER;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_salary_amount') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_salary_amount DECIMAL(10, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_company_name') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_company_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_company_address_line1') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_company_address_line1 TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_company_address_line2') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_company_address_line2 TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_company_city') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_company_city TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_company_postcode') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_company_postcode TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_company_country') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_company_country TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employment_job_title') THEN
    ALTER TABLE tenant_references ADD COLUMN employment_job_title TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'payslip_files') THEN
    ALTER TABLE tenant_references ADD COLUMN payslip_files JSONB;
  END IF;

  -- Employer Reference Contact
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employer_ref_position') THEN
    ALTER TABLE tenant_references ADD COLUMN employer_ref_position TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employer_ref_name') THEN
    ALTER TABLE tenant_references ADD COLUMN employer_ref_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employer_ref_email') THEN
    ALTER TABLE tenant_references ADD COLUMN employer_ref_email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'employer_ref_phone') THEN
    ALTER TABLE tenant_references ADD COLUMN employer_ref_phone TEXT;
  END IF;

  -- Page 7: Additional Income
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'has_additional_income') THEN
    ALTER TABLE tenant_references ADD COLUMN has_additional_income BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'additional_income_source') THEN
    ALTER TABLE tenant_references ADD COLUMN additional_income_source TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'additional_income_amount') THEN
    ALTER TABLE tenant_references ADD COLUMN additional_income_amount DECIMAL(10, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'additional_income_frequency') THEN
    ALTER TABLE tenant_references ADD COLUMN additional_income_frequency TEXT;
  END IF;

  -- Page 8: Adverse Credit
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'has_adverse_credit') THEN
    ALTER TABLE tenant_references ADD COLUMN has_adverse_credit BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'adverse_credit_details') THEN
    ALTER TABLE tenant_references ADD COLUMN adverse_credit_details TEXT;
  END IF;

  -- Page 9: Tenant Details
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'is_smoker') THEN
    ALTER TABLE tenant_references ADD COLUMN is_smoker BOOLEAN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'has_pets') THEN
    ALTER TABLE tenant_references ADD COLUMN has_pets BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'pet_details') THEN
    ALTER TABLE tenant_references ADD COLUMN pet_details TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'marital_status') THEN
    ALTER TABLE tenant_references ADD COLUMN marital_status TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'number_of_dependants') THEN
    ALTER TABLE tenant_references ADD COLUMN number_of_dependants INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'dependants_details') THEN
    ALTER TABLE tenant_references ADD COLUMN dependants_details TEXT;
  END IF;

  -- Progress tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'current_page') THEN
    ALTER TABLE tenant_references ADD COLUMN current_page INTEGER DEFAULT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'completed_pages') THEN
    ALTER TABLE tenant_references ADD COLUMN completed_pages INTEGER[] DEFAULT '{}';
  END IF;

  -- Bank statement files
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenant_references' AND column_name = 'bank_statement_files') THEN
    ALTER TABLE tenant_references ADD COLUMN bank_statement_files JSONB;
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON TABLE tenant_references IS 'Comprehensive tenant reference form with multi-page data collection';
COMMENT ON COLUMN tenant_references.id_document_type IS 'Type of ID: driving_licence or passport';
COMMENT ON COLUMN tenant_references.employment_contract_type IS 'Contract type: permanent, fixed_term, zero_hours, agency, other';
COMMENT ON COLUMN tenant_references.marital_status IS 'Marital status: single, married, divorced, widowed, civil_partnership, other';
COMMENT ON COLUMN tenant_references.additional_income_frequency IS 'Frequency: weekly, monthly, annually';

-- Create indexes for faster queries on common filters
CREATE INDEX IF NOT EXISTS idx_tenant_references_current_page ON tenant_references(current_page);
CREATE INDEX IF NOT EXISTS idx_tenant_references_dob ON tenant_references(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_tenant_references_has_pets ON tenant_references(has_pets);
CREATE INDEX IF NOT EXISTS idx_tenant_references_is_smoker ON tenant_references(is_smoker);
