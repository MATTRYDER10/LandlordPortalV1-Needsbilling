-- Create reference_scores table to store scoring results from the PropertyGoose scoring engine
-- This table stores the automated scoring decision for each tenant reference after verification

CREATE TABLE IF NOT EXISTS reference_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

  -- Scoring Decision
  decision VARCHAR(50) NOT NULL, -- 'PASS', 'PASS_WITH_GUARANTOR', 'MANUAL_REVIEW', 'DECLINE'

  -- Scores
  score_total INTEGER NOT NULL, -- Total score 0-100
  domain_scores JSONB NOT NULL, -- Breakdown: { credit_tas, affordability, employment, residential, id_data }

  -- Affordability Ratio
  ratio DECIMAL(10, 2) NOT NULL, -- Income to rent ratio (e.g., 2.5 = 2.5x rent)

  -- Flags and Caps
  caps JSONB DEFAULT '[]'::jsonb, -- Array of cap reasons (e.g., ["guarantor_required", "affordability_<2.5x"])
  review_flags JSONB DEFAULT '[]'::jsonb, -- Array of manual review flags
  decline_reasons JSONB DEFAULT '[]'::jsonb, -- Array of decline reasons (if declined)

  -- Guarantor Requirements (if applicable)
  guarantor_required BOOLEAN DEFAULT FALSE,
  guarantor_min_ratio DECIMAL(10, 2), -- Minimum ratio required for guarantor
  guarantor_min_tas INTEGER, -- Minimum TAS score required for guarantor

  -- Metadata
  scored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  scored_by UUID REFERENCES auth.users(id), -- Staff user who triggered scoring (if manual)
  scoring_version VARCHAR(50) DEFAULT 'v1', -- Version of scoring algorithm used

  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT unique_reference_score UNIQUE(reference_id)
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_reference_scores_reference_id ON reference_scores(reference_id);
CREATE INDEX IF NOT EXISTS idx_reference_scores_decision ON reference_scores(decision);
CREATE INDEX IF NOT EXISTS idx_reference_scores_scored_at ON reference_scores(scored_at);
CREATE INDEX IF NOT EXISTS idx_reference_scores_guarantor_required ON reference_scores(guarantor_required);

-- Add comments to explain the table
COMMENT ON TABLE reference_scores IS 'Stores automated scoring results from PropertyGoose scoring engine after staff verification is complete';

-- Add comments for key fields
COMMENT ON COLUMN reference_scores.decision IS 'Scoring decision: PASS (approved), PASS_WITH_GUARANTOR (needs guarantor), MANUAL_REVIEW (requires human review), DECLINE (rejected)';
COMMENT ON COLUMN reference_scores.score_total IS 'Total score from 0-100, calculated from all domain scores';
COMMENT ON COLUMN reference_scores.domain_scores IS 'Breakdown of scores by domain: credit_tas (35 max), affordability (30 max), employment (15 max), residential (15 max), id_data (5 max)';
COMMENT ON COLUMN reference_scores.ratio IS 'Income to rent ratio, e.g., 2.5 means income is 2.5x the rent';
COMMENT ON COLUMN reference_scores.caps IS 'Array of conditions that cap the decision (e.g., guarantor required due to credit history)';
COMMENT ON COLUMN reference_scores.review_flags IS 'Array of flags that require manual review (e.g., missing landlord reference, no credit score)';
COMMENT ON COLUMN reference_scores.decline_reasons IS 'Array of reasons for decline if decision is DECLINE';
COMMENT ON COLUMN reference_scores.scoring_version IS 'Version of the scoring algorithm used, for tracking changes over time';

-- Enable Row Level Security
ALTER TABLE reference_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Staff can view all scores
CREATE POLICY "Staff can view all reference scores"
  ON reference_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );

-- RLS Policy: System can insert scores (via service role)
CREATE POLICY "System can insert reference scores"
  ON reference_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policy: Staff can update scores
CREATE POLICY "Staff can update reference scores"
  ON reference_scores
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM staff_users
      WHERE staff_users.user_id = auth.uid()
    )
  );
