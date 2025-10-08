-- Migration: Drop All Remaining Plaintext PII Columns
-- Removes all plaintext columns after full encryption is complete

-- Drop plaintext columns from tenant_references
ALTER TABLE tenant_references
  DROP COLUMN IF EXISTS middle_name,
  DROP COLUMN IF EXISTS nationality,
  DROP COLUMN IF EXISTS employer_ref_name,
  DROP COLUMN IF EXISTS self_employed_business_name,
  DROP COLUMN IF EXISTS self_employed_nature_of_business,
  DROP COLUMN IF EXISTS additional_income_source,
  DROP COLUMN IF EXISTS additional_income_amount,
  DROP COLUMN IF EXISTS adverse_credit_details,
  DROP COLUMN IF EXISTS pet_details,
  DROP COLUMN IF EXISTS dependants_details,
  DROP COLUMN IF EXISTS marital_status;

-- Drop plaintext columns from tenant_reference_previous_addresses
ALTER TABLE tenant_reference_previous_addresses
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS postcode,
  DROP COLUMN IF EXISTS country;

-- Drop plaintext columns from landlord_references
ALTER TABLE landlord_references
  DROP COLUMN IF EXISTS rent_paid_on_time_details,
  DROP COLUMN IF EXISTS property_condition_details,
  DROP COLUMN IF EXISTS neighbour_complaints_details,
  DROP COLUMN IF EXISTS breach_of_tenancy_details,
  DROP COLUMN IF EXISTS would_rent_again_details,
  DROP COLUMN IF EXISTS additional_comments;

-- Drop plaintext columns from agent_references
ALTER TABLE agent_references
  DROP COLUMN IF EXISTS rent_paid_on_time_details,
  DROP COLUMN IF EXISTS property_condition_details,
  DROP COLUMN IF EXISTS neighbour_complaints_details,
  DROP COLUMN IF EXISTS breach_of_tenancy_details,
  DROP COLUMN IF EXISTS would_rent_again_details,
  DROP COLUMN IF EXISTS additional_comments;

-- Drop plaintext columns from employer_references
ALTER TABLE employer_references
  DROP COLUMN IF EXISTS performance_details,
  DROP COLUMN IF EXISTS disciplinary_details,
  DROP COLUMN IF EXISTS absence_details,
  DROP COLUMN IF EXISTS would_reemploy_details,
  DROP COLUMN IF EXISTS additional_comments;

-- Drop plaintext columns from accountant_references
ALTER TABLE accountant_references
  DROP COLUMN IF EXISTS nature_of_business,
  DROP COLUMN IF EXISTS tax_liabilities_details,
  DROP COLUMN IF EXISTS additional_comments,
  DROP COLUMN IF EXISTS recommendation_comments;
