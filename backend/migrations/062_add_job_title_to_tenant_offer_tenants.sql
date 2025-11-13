-- Migration 062: Add job_title_encrypted to tenant_offer_tenants table
-- This migration adds a job title / income source field to tenant offers

ALTER TABLE tenant_offer_tenants
ADD COLUMN IF NOT EXISTS job_title_encrypted TEXT;

-- Add comment to column
COMMENT ON COLUMN tenant_offer_tenants.job_title_encrypted IS 'Encrypted job title or income source for the tenant';

