-- Create verification_steps table for structured 4-step verification flow
-- This replaces the inline column approach in verification_checks with a more flexible structure
CREATE TABLE IF NOT EXISTS verification_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_check_id UUID NOT NULL REFERENCES verification_checks(id) ON DELETE CASCADE,
    reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL CHECK (step_number BETWEEN 1 AND 4),
    step_type VARCHAR(50) NOT NULL CHECK (step_type IN ('ID_SELFIE', 'INCOME_AFFORDABILITY', 'RESIDENTIAL', 'CREDIT_TAS')),

    -- Verification results for this step
    checks JSONB DEFAULT '[]'::jsonb, -- Array of individual checks: [{name, pass, notes, evidence_source}]
    overall_pass BOOLEAN, -- Overall pass/fail for this step
    notes TEXT,

    -- Evidence tracking
    evidence_sources JSONB DEFAULT '[]'::jsonb, -- Array of evidence types used: ["Bank Statements", "Payslips", etc.]
    evidence_files JSONB DEFAULT '[]'::jsonb, -- Array of file references: [{filename, url, uploaded_at}]

    -- Step completion
    completed_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(verification_check_id, step_number)
);

-- Evidence source options lookup table
CREATE TABLE IF NOT EXISTS evidence_source_options (
    id SERIAL PRIMARY KEY,
    step_type VARCHAR(50) NOT NULL,
    evidence_type VARCHAR(100) NOT NULL,
    display_label VARCHAR(100) NOT NULL,
    display_order INTEGER DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed evidence source options
INSERT INTO evidence_source_options (step_type, evidence_type, display_label, display_order) VALUES
-- Step 1: ID & Selfie (no evidence sources needed - visual verification)

-- Step 2: Income & Affordability
('INCOME_AFFORDABILITY', 'BANK_STATEMENTS', 'Bank Statements', 1),
('INCOME_AFFORDABILITY', 'PAYSLIPS', 'Payslips', 2),
('INCOME_AFFORDABILITY', 'COMPANY_STARTER_LETTER', 'Company Headed Starter Letter', 3),
('INCOME_AFFORDABILITY', 'HR_REFERENCE', 'Headed HR Reference', 4),
('INCOME_AFFORDABILITY', 'EMPLOYMENT_CONTRACT', 'Employment Contract', 5),
('INCOME_AFFORDABILITY', 'TAX_RETURN', 'Tax Return / Self-Assessment', 6),
('INCOME_AFFORDABILITY', 'COMPANY_ACCOUNTS', 'Company Accounts', 7),
('INCOME_AFFORDABILITY', 'OTHER_INCOME', 'Other Income Documentation', 8),

-- Step 3: Residential
('RESIDENTIAL', 'LANDLORD_REFERENCE', 'Landlord Reference', 1),
('RESIDENTIAL', 'AGENT_REFERENCE', 'Letting Agent Reference', 2),
('RESIDENTIAL', 'TENANCY_AGREEMENT', 'Tenancy Agreement', 3),
('RESIDENTIAL', 'RENT_STATEMENTS', 'Rent Payment Statements', 4),
('RESIDENTIAL', 'UTILITY_BILLS', 'Utility Bills', 5),
('RESIDENTIAL', 'COUNCIL_TAX', 'Council Tax Statements', 6),
('RESIDENTIAL', 'OTHER_PROOF', 'Other Proof of Residence', 7),

-- Step 4: Credit & TAS (mostly automated, but can have manual evidence)
('CREDIT_TAS', 'CREDITSAFE_REPORT', 'Creditsafe Identity Report', 1),
('CREDIT_TAS', 'CREDIT_REPORT', 'Credit Report', 2),
('CREDIT_TAS', 'SANCTIONS_SCREENING', 'Sanctions Screening Result', 3),
('CREDIT_TAS', 'MANUAL_REVIEW', 'Manual Review Documentation', 4);

-- Create indexes
CREATE INDEX idx_verification_steps_verification_check_id ON verification_steps(verification_check_id);
CREATE INDEX idx_verification_steps_reference_id ON verification_steps(reference_id);
CREATE INDEX idx_verification_steps_step_number ON verification_steps(step_number);
CREATE INDEX idx_verification_steps_completed_at ON verification_steps(completed_at);

-- Enable RLS
ALTER TABLE verification_steps ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all verification steps
CREATE POLICY "Staff can view all verification steps" ON verification_steps
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can insert verification steps
CREATE POLICY "Staff can insert verification steps" ON verification_steps
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can update verification steps
CREATE POLICY "Staff can update verification steps" ON verification_steps
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_steps_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER verification_steps_updated_at_trigger
    BEFORE UPDATE ON verification_steps
    FOR EACH ROW
    EXECUTE FUNCTION update_verification_steps_updated_at();

-- Add TAS fields to verification_checks for overall decision
ALTER TABLE verification_checks ADD COLUMN IF NOT EXISTS tas_score INTEGER;
ALTER TABLE verification_checks ADD COLUMN IF NOT EXISTS tas_category VARCHAR(20) CHECK (tas_category IN ('PASS_PLUS', 'PASS', 'REFER', 'FAIL'));
ALTER TABLE verification_checks ADD COLUMN IF NOT EXISTS tas_reason TEXT; -- Required for REFER and FAIL

COMMENT ON TABLE verification_steps IS 'Structured 4-step verification flow with evidence tracking';
COMMENT ON COLUMN verification_steps.step_type IS 'Step type: ID_SELFIE, INCOME_AFFORDABILITY, RESIDENTIAL, CREDIT_TAS';
COMMENT ON COLUMN verification_steps.checks IS 'Array of individual checks performed in this step: [{name, pass, notes, evidence_source}]';
COMMENT ON COLUMN verification_steps.evidence_sources IS 'Array of evidence types used: ["Bank Statements", "Payslips"]';
COMMENT ON COLUMN verification_steps.evidence_files IS 'Array of file metadata: [{filename, url, uploaded_at}]';
COMMENT ON TABLE evidence_source_options IS 'Lookup table for evidence source dropdown options per step type';
