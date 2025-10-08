-- Migration: Add Encrypted Field Columns
-- Description: Adds encrypted columns for sensitive PII data
-- Run this in Supabase SQL Editor

-- Add encrypted columns to tenant_references table
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS tenant_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tenant_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS contact_number_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_salary_amount_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS self_employed_annual_income_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS savings_amount_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_ref_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_ref_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_landlord_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_landlord_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_phone_encrypted TEXT;

-- Add encrypted columns to invitations table
ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS email_encrypted TEXT;

-- Add encrypted columns to landlord_references table
ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS landlord_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS landlord_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS monthly_rent_encrypted TEXT;

-- Add encrypted columns to agent_references table
ALTER TABLE agent_references
  ADD COLUMN IF NOT EXISTS agent_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS agent_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS monthly_rent_encrypted TEXT;

-- Add encrypted columns to employer_references table
ALTER TABLE employer_references
  ADD COLUMN IF NOT EXISTS employer_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS annual_salary_encrypted TEXT;

-- Add encrypted columns to accountant_references table
ALTER TABLE accountant_references
  ADD COLUMN IF NOT EXISTS accountant_email_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS accountant_phone_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS annual_turnover_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS annual_profit_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS estimated_monthly_income_encrypted TEXT;

-- Note: After deploying the code changes that encrypt data:
-- 1. The application will start writing to both plaintext and encrypted columns
-- 2. Old data will still work during the migration period
-- 3. Once all data is migrated, we can remove the plaintext columns in a future migration
