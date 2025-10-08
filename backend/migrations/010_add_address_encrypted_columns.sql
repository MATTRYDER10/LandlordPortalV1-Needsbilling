-- Migration: Add Encrypted Columns for Address Fields
-- Encrypts current address, previous rental address, and employment company address

-- Add encrypted columns to tenant_references table for current address
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS current_address_line1_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS current_address_line2_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS current_city_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS current_postcode_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS current_country_encrypted TEXT;

-- Add encrypted columns to tenant_references table for employment company address
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS employment_company_address_line1_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_company_address_line2_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_company_city_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_company_postcode_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_company_country_encrypted TEXT;

-- Add encrypted columns to tenant_references table for previous rental address
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS previous_rental_address_line1_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_rental_address_line2_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_rental_city_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_rental_postcode_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_rental_country_encrypted TEXT;
