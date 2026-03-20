CREATE TABLE IF NOT EXISTS creditsafe_verifications_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,
  request_data_encrypted TEXT,
  response_data_encrypted TEXT,
  transaction_id TEXT,
  risk_level TEXT,
  risk_score INTEGER,
  status TEXT DEFAULT 'pending',
  fraud_indicators JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creditsafe_v2_reference ON creditsafe_verifications_v2(reference_id);

CREATE TABLE IF NOT EXISTS sanctions_screenings_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,
  screening_data_encrypted TEXT,
  risk_level TEXT,
  total_matches INTEGER DEFAULT 0,
  sanctions_matches INTEGER DEFAULT 0,
  donation_matches INTEGER DEFAULT 0,
  summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sanctions_v2_reference ON sanctions_screenings_v2(reference_id);
