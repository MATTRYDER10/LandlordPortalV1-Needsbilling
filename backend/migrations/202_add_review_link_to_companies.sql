ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS review_link TEXT,
  ADD COLUMN IF NOT EXISTS review_platform TEXT CHECK (review_platform IN ('google', 'trustpilot', 'other'));

COMMENT ON COLUMN companies.review_link IS 'Google/Trustpilot review link for this company/branch';
COMMENT ON COLUMN companies.review_platform IS 'Platform type: google, trustpilot, or other';
