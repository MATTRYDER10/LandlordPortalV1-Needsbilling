-- Migration 057: Create landlord_aml_checks table
-- This migration creates the table for storing landlord AML check results

-- ============================================================================
-- LANDLORD_AML_CHECKS TABLE
-- Stores AML check results for landlords (similar to creditsafe_verifications for tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS landlord_aml_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,

  -- Request/Response Data (encrypted)
  verification_request_encrypted TEXT, -- Encrypted JSONB of data sent to Creditsafe/Verify
  verification_response_encrypted TEXT, -- Encrypted JSONB of full API response

  -- Verification Results
  verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'passed', 'failed', 'refer', 'error'
  verification_score INTEGER, -- Overall verification score (0-100)

  -- Match Scores (0-100 for each)
  name_match_score INTEGER,
  address_match_score INTEGER,
  dob_match_score INTEGER,

  -- Compliance Checks
  pep_check_result BOOLEAN DEFAULT NULL, -- Politically Exposed Person check
  sanctions_check_result BOOLEAN DEFAULT NULL, -- Sanctions list check
  adverse_media_result BOOLEAN DEFAULT NULL, -- Adverse media screening

  -- Fraud & Risk Indicators
  fraud_indicators JSONB, -- Array of fraud flags/warnings
  risk_level VARCHAR(50), -- 'low', 'medium', 'high', 'very_high'

  -- Identity Document Verification
  document_verified BOOLEAN DEFAULT NULL,
  document_authenticity_score INTEGER,
  selfie_matches_id BOOLEAN DEFAULT NULL, -- Selfie comparison result

  -- ID Document Details (encrypted)
  id_document_type TEXT, -- 'driving_licence', 'passport'
  id_document_path TEXT, -- Path to uploaded ID document
  selfie_path TEXT, -- Path to uploaded selfie

  -- API Response Metadata
  verify_transaction_id VARCHAR(255), -- Verify/API unique transaction ID
  api_response_code VARCHAR(50), -- HTTP or API-specific response code
  error_message TEXT, -- Error message if verification failed

  -- Pricing
  charge_type VARCHAR(50) DEFAULT 'credits', -- 'credits' or 'fixed'
  credits_used DECIMAL(10, 2) DEFAULT 0.5, -- Credits used (0.5 for AML check)
  amount_gbp DECIMAL(10, 2) DEFAULT 1.50, -- Fixed charge amount if charge_type is 'fixed'

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Audit
  requested_by UUID REFERENCES auth.users(id), -- Agent who initiated the check
  verified_by UUID REFERENCES auth.users(id), -- Staff who verified (if manual)

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

