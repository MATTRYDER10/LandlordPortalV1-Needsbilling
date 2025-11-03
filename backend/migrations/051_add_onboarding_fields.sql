-- Migration 051: Add onboarding tracking fields to companies table
-- Used to track user progress through the onboarding wizard

ALTER TABLE companies
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE;

-- Mark existing companies as having completed onboarding (grandfathered in)
UPDATE companies
SET onboarding_completed = TRUE,
    onboarding_step = 5,
    onboarding_completed_at = created_at
WHERE created_at < NOW();

COMMENT ON COLUMN companies.onboarding_completed IS 'Flag to indicate if company has completed the onboarding wizard';
COMMENT ON COLUMN companies.onboarding_step IS 'Current step in onboarding wizard (0-5). 0=Welcome, 1=Personal, 2=Company, 3=Bank, 4=Branding, 5=Payment';
COMMENT ON COLUMN companies.onboarding_completed_at IS 'Timestamp when onboarding was completed';
