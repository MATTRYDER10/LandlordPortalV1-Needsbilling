-- Create verification_checks table for detailed step-by-step verification tracking
-- This table stores all verification checks performed by staff during the reference review process

CREATE TABLE IF NOT EXISTS verification_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
  verified_by UUID REFERENCES auth.users(id),

  -- ID Document Verification Step
  id_name_match BOOLEAN DEFAULT NULL,
  id_dob_match BOOLEAN DEFAULT NULL,
  id_valid BOOLEAN DEFAULT NULL,
  id_photo_clear BOOLEAN DEFAULT NULL,
  id_authentic BOOLEAN DEFAULT NULL,
  id_notes TEXT,
  id_step_completed BOOLEAN DEFAULT FALSE,

  -- Selfie Verification Step
  selfie_matches_id BOOLEAN DEFAULT NULL,
  selfie_notes TEXT,
  selfie_step_completed BOOLEAN DEFAULT FALSE,

  -- Employment/Income Verification Step
  employment_verified BOOLEAN DEFAULT NULL,
  employment_notes TEXT,
  employment_step_completed BOOLEAN DEFAULT FALSE,

  -- Previous Tenancy Verification Step
  tenancy_verified BOOLEAN DEFAULT NULL,
  tenancy_notes TEXT,
  tenancy_step_completed BOOLEAN DEFAULT FALSE,

  -- Address History Verification Step
  address_history_complete BOOLEAN DEFAULT NULL,
  address_history_notes TEXT,
  address_history_step_completed BOOLEAN DEFAULT FALSE,

  -- Overall Status
  current_step INTEGER DEFAULT 1, -- 1-5 representing which step user is on
  overall_status VARCHAR(50) DEFAULT 'not_started', -- 'not_started', 'in_progress', 'passed', 'failed'
  final_decision TEXT,
  final_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Add index for faster lookups by reference
CREATE INDEX IF NOT EXISTS idx_verification_checks_reference_id ON verification_checks(reference_id);

-- Add index for staff lookup
CREATE INDEX IF NOT EXISTS idx_verification_checks_verified_by ON verification_checks(verified_by);

-- Add comment to explain the table
COMMENT ON TABLE verification_checks IS 'Tracks step-by-step verification progress for each tenant reference, allowing staff to systematically verify ID, selfie, employment, tenancy, and address history';

-- Add comments for key fields
COMMENT ON COLUMN verification_checks.current_step IS 'Current step in verification process: 1=ID, 2=Selfie, 3=Employment, 4=Tenancy, 5=Address History, 6=Final Review';
COMMENT ON COLUMN verification_checks.overall_status IS 'Overall verification status: not_started, in_progress, passed, failed';
