ALTER TABLE companies ADD COLUMN IF NOT EXISTS rentgoose_enabled BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_companies_rentgoose_enabled ON companies(rentgoose_enabled) WHERE rentgoose_enabled = true;
