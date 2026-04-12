ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS offer_link_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_offer_link_token
  ON companies(offer_link_token)
  WHERE offer_link_token IS NOT NULL;
