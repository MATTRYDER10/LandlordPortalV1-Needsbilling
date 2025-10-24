-- Create creditsafe_verifications table for storing Creditsafe Verify API results
-- This table stores identity verification responses from Creditsafe for each tenant reference

CREATE TABLE IF NOT EXISTS creditsafe_verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

  -- Request/Response Data (encrypted)
  verification_request_encrypted TEXT, -- Encrypted JSONB of data sent to Creditsafe
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

  -- API Response Metadata
  creditsafe_transaction_id VARCHAR(255), -- Creditsafe's unique transaction ID
  api_response_code VARCHAR(50), -- HTTP or API-specific response code
  error_message TEXT, -- Error message if verification failed

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  requested_by UUID REFERENCES auth.users(id), -- Staff user who manually triggered (if applicable)

  CONSTRAINT unique_reference_verification UNIQUE(reference_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_creditsafe_verifications_reference_id ON creditsafe_verifications(reference_id);
CREATE INDEX IF NOT EXISTS idx_creditsafe_verifications_status ON creditsafe_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_creditsafe_verifications_verified_at ON creditsafe_verifications(verified_at);
CREATE INDEX IF NOT EXISTS idx_creditsafe_verifications_risk_level ON creditsafe_verifications(risk_level);

-- Add comments to explain the table
COMMENT ON TABLE creditsafe_verifications IS 'Stores identity verification results from Creditsafe Verify API for tenant references, including KYC, PEP, sanctions, and fraud checks';

-- Add comments for key fields
COMMENT ON COLUMN creditsafe_verifications.verification_status IS 'Status of verification: pending (in progress), passed (verified), failed (not verified), refer (manual review needed), error (API failed)';
COMMENT ON COLUMN creditsafe_verifications.verification_score IS 'Overall verification confidence score from 0-100, where higher is better';
COMMENT ON COLUMN creditsafe_verifications.pep_check_result IS 'Politically Exposed Person check: true if flagged, false if clear, null if not checked';
COMMENT ON COLUMN creditsafe_verifications.sanctions_check_result IS 'International sanctions screening: true if flagged, false if clear, null if not checked';
COMMENT ON COLUMN creditsafe_verifications.fraud_indicators IS 'Array of fraud flags, warnings, or risk indicators returned by Creditsafe';
COMMENT ON COLUMN creditsafe_verifications.risk_level IS 'Overall risk assessment: low, medium, high, or very_high';
