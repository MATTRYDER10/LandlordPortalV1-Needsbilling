-- Migration: Add Encrypted Columns for All Remaining PII
-- Encrypts all high-priority personally identifiable information

-- Add encrypted columns to tenant_references table
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS middle_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS nationality_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employer_ref_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS self_employed_business_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS self_employed_nature_of_business_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS additional_income_source_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS additional_income_amount_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS adverse_credit_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS pet_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS dependants_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS marital_status_encrypted TEXT;

-- Add encrypted columns to tenant_reference_previous_addresses table
ALTER TABLE tenant_reference_previous_addresses
  ADD COLUMN IF NOT EXISTS address_line1_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS address_line2_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS city_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS postcode_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS country_encrypted TEXT;

-- Add encrypted columns to landlord_references table
ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS rent_paid_on_time_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_condition_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS neighbour_complaints_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS breach_of_tenancy_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS would_rent_again_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS additional_comments_encrypted TEXT;

-- Add encrypted columns to agent_references table
ALTER TABLE agent_references
  ADD COLUMN IF NOT EXISTS rent_paid_on_time_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS property_condition_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS neighbour_complaints_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS breach_of_tenancy_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS would_rent_again_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS additional_comments_encrypted TEXT;

-- Add encrypted columns to employer_references table
ALTER TABLE employer_references
  ADD COLUMN IF NOT EXISTS performance_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS disciplinary_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS absence_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS would_reemploy_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS additional_comments_encrypted TEXT;

-- Add encrypted columns to accountant_references table
ALTER TABLE accountant_references
  ADD COLUMN IF NOT EXISTS nature_of_business_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS tax_liabilities_details_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS additional_comments_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS recommendation_comments_encrypted TEXT;
