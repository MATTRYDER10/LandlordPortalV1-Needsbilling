-- Create sanctions_screenings table for storing UK Sanctions & Electoral Commission screening results
-- This table stores PEP (Politically Exposed Person) and sanctions screening responses for tenant references

CREATE TABLE IF NOT EXISTS sanctions_screenings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

  -- Screening Request Data
  tenant_name VARCHAR(255) NOT NULL, -- Name that was screened
  tenant_dob DATE, -- Date of birth used in screening
  tenant_postcode VARCHAR(20), -- Postcode used in screening

  -- Screening Results
  screening_status VARCHAR(50) NOT NULL, -- 'clear', 'low', 'medium', 'high'
  risk_level VARCHAR(50) NOT NULL, -- Same as screening_status for consistency
  total_matches INTEGER DEFAULT 0, -- Total matches found across both databases

  -- UK Sanctions List Matches
  sanctions_matches JSONB DEFAULT '[]'::jsonb, -- Array of sanctioned entity matches

  -- Electoral Commission Donation Matches (PEP)
  donation_matches JSONB DEFAULT '[]'::jsonb, -- Array of political donation matches

  -- Summary & Response
  summary_message TEXT, -- Human-readable summary from API
  api_response_encrypted TEXT, -- Encrypted JSONB of full API response for audit

  -- Timestamps
  screening_date TIMESTAMP WITH TIME ZONE NOT NULL, -- When screening was performed by API
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- When record was created in our DB

  CONSTRAINT unique_reference_sanctions_screening UNIQUE(reference_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_reference_id ON sanctions_screenings(reference_id);
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_status ON sanctions_screenings(screening_status);
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_risk_level ON sanctions_screenings(risk_level);
CREATE INDEX IF NOT EXISTS idx_sanctions_screenings_created_at ON sanctions_screenings(created_at);

-- Add comments to explain the table
COMMENT ON TABLE sanctions_screenings IS 'Stores UK Sanctions List and Electoral Commission (PEP) screening results for tenant references';

-- Add comments for key fields
COMMENT ON COLUMN sanctions_screenings.screening_status IS 'Risk level from API: clear (no matches), low (minor donations), medium (multiple donations), high (sanctions list match)';
COMMENT ON COLUMN sanctions_screenings.sanctions_matches IS 'Array of matches from UK Sanctions List (5,656 sanctioned individuals/entities)';
COMMENT ON COLUMN sanctions_screenings.donation_matches IS 'Array of matches from Electoral Commission political donations database (89,358 donations)';
COMMENT ON COLUMN sanctions_screenings.summary_message IS 'Human-readable summary from API indicating action (e.g., "REJECT TENANT APPLICATION" for sanctions matches)';
COMMENT ON COLUMN sanctions_screenings.api_response_encrypted IS 'Full encrypted API response stored for audit trail and compliance purposes';
