-- ============================================================================
-- LANDLORD MIGRATIONS - RUN THIS ENTIRE FILE IN SUPABASE SQL EDITOR
-- ============================================================================
-- This file combines both migration files for easy execution
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================================

-- Migration 056: Create landlords table
-- ============================================================================
CREATE TABLE IF NOT EXISTS landlords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Personal Information (encrypted)
  title_encrypted TEXT,
  first_name_encrypted TEXT NOT NULL,
  middle_name_encrypted TEXT,
  last_name_encrypted TEXT NOT NULL,
  preferred_email_greeting_encrypted TEXT,
  full_name_displayed_on_contracts_encrypted TEXT,
  phone_encrypted TEXT,
  email_encrypted TEXT NOT NULL,
  date_of_birth DATE,
  is_company BOOLEAN DEFAULT FALSE,
  company_name_encrypted TEXT,

  -- Residential Address (encrypted)
  residential_address_line1_encrypted TEXT,
  residential_address_line2_encrypted TEXT,
  residential_city_encrypted TEXT,
  residential_postcode_encrypted TEXT,
  residential_country_encrypted TEXT,

  -- Section 48 Address (England/Wales) - optional different address
  has_section48_address BOOLEAN DEFAULT FALSE,
  section48_address_line1_encrypted TEXT,
  section48_address_line2_encrypted TEXT,
  section48_city_encrypted TEXT,
  section48_postcode_encrypted TEXT,
  section48_country_encrypted TEXT,

  -- Bank Details (encrypted)
  bank_account_name_encrypted TEXT,
  bank_account_number_encrypted TEXT,
  bank_sort_code_encrypted TEXT,
  is_joint_account BOOLEAN DEFAULT FALSE,

  -- Regulatory Information
  landlord_registration_number TEXT,
  landlord_license_number TEXT,
  agent_sign_on_behalf BOOLEAN DEFAULT FALSE,

  -- AML Check Status
  aml_status VARCHAR(50) DEFAULT 'not_requested',
  aml_completed_at TIMESTAMP WITH TIME ZONE,
  aml_checked_by UUID REFERENCES auth.users(id),

  -- Verification Status (for selfie/ID check)
  verification_status VARCHAR(50) DEFAULT 'pending',
  verification_submitted_at TIMESTAMP WITH TIME ZONE,
  verification_verified_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_landlords_company_id ON landlords(company_id);
CREATE INDEX IF NOT EXISTS idx_landlords_email ON landlords(email_encrypted);
CREATE INDEX IF NOT EXISTS idx_landlords_aml_status ON landlords(aml_status);
CREATE INDEX IF NOT EXISTS idx_landlords_verification_status ON landlords(verification_status);
CREATE INDEX IF NOT EXISTS idx_landlords_created_at ON landlords(created_at);

-- Enable Row Level Security
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Company members can view/manage landlords from their company
CREATE POLICY "Company members can view their company's landlords"
  ON landlords
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can create landlords for their company"
  ON landlords
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can update their company's landlords"
  ON landlords
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company members can delete their company's landlords"
  ON landlords
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- LANDLORD PROPERTIES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS landlord_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,
  
  -- Property Address (encrypted)
  address_line1_encrypted TEXT NOT NULL,
  address_line2_encrypted TEXT,
  city_encrypted TEXT NOT NULL,
  county_encrypted TEXT,
  postcode_encrypted TEXT NOT NULL,
  country_encrypted TEXT DEFAULT 'GB',
  
  -- Property Details
  property_type TEXT,
  number_of_bedrooms INTEGER,
  number_of_bathrooms INTEGER,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_landlord_properties_landlord_id ON landlord_properties(landlord_id);

-- Enable Row Level Security
ALTER TABLE landlord_properties ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Inherit from parent landlord
CREATE POLICY "Company members can view landlord properties"
  ON landlord_properties
  FOR SELECT
  TO authenticated
  USING (
    landlord_id IN (
      SELECT id
      FROM landlords
      WHERE company_id IN (
        SELECT company_id
        FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Company members can manage landlord properties"
  ON landlord_properties
  FOR ALL
  TO authenticated
  USING (
    landlord_id IN (
      SELECT id
      FROM landlords
      WHERE company_id IN (
        SELECT company_id
        FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- Migration 057: Create landlord_aml_checks table
-- ============================================================================
CREATE TABLE IF NOT EXISTS landlord_aml_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,

  -- Request/Response Data (encrypted)
  verification_request_encrypted TEXT,
  verification_response_encrypted TEXT,

  -- Verification Results
  verification_status VARCHAR(50) DEFAULT 'pending',
  verification_score INTEGER,

  -- Match Scores (0-100 for each)
  name_match_score INTEGER,
  address_match_score INTEGER,
  dob_match_score INTEGER,

  -- Compliance Checks
  pep_check_result BOOLEAN DEFAULT NULL,
  sanctions_check_result BOOLEAN DEFAULT NULL,
  adverse_media_result BOOLEAN DEFAULT NULL,

  -- Fraud & Risk Indicators
  fraud_indicators JSONB,
  risk_level VARCHAR(50),

  -- Identity Document Verification
  document_verified BOOLEAN DEFAULT NULL,
  document_authenticity_score INTEGER,
  selfie_matches_id BOOLEAN DEFAULT NULL,

  -- ID Document Details (encrypted)
  id_document_type TEXT,
  id_document_path TEXT,
  selfie_path TEXT,

  -- API Response Metadata
  verify_transaction_id VARCHAR(255),
  api_response_code VARCHAR(50),
  error_message TEXT,

  -- Pricing
  charge_type VARCHAR(50) DEFAULT 'credits',
  credits_used DECIMAL(10, 2) DEFAULT 0.5,
  amount_gbp DECIMAL(10, 2) DEFAULT 1.50,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Audit
  requested_by UUID REFERENCES auth.users(id),
  verified_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_landlord_aml_check UNIQUE(landlord_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_landlord_aml_checks_landlord_id ON landlord_aml_checks(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_aml_checks_status ON landlord_aml_checks(verification_status);
CREATE INDEX IF NOT EXISTS idx_landlord_aml_checks_requested_by ON landlord_aml_checks(requested_by);

-- Enable Row Level Security
ALTER TABLE landlord_aml_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Inherit from parent landlord
CREATE POLICY "Company members can view landlord AML checks"
  ON landlord_aml_checks
  FOR SELECT
  TO authenticated
  USING (
    landlord_id IN (
      SELECT id
      FROM landlords
      WHERE company_id IN (
        SELECT company_id
        FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Company members can create landlord AML checks"
  ON landlord_aml_checks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    landlord_id IN (
      SELECT id
      FROM landlords
      WHERE company_id IN (
        SELECT company_id
        FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Company members can update landlord AML checks"
  ON landlord_aml_checks
  FOR UPDATE
  TO authenticated
  USING (
    landlord_id IN (
      SELECT id
      FROM landlords
      WHERE company_id IN (
        SELECT company_id
        FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

