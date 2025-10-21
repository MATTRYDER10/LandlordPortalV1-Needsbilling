-- Migration to update employer_references table
-- Remove old performance-focused fields and add new employment confirmation fields

-- Add new employment confirmation fields
ALTER TABLE employer_references
ADD COLUMN IF NOT EXISTS clarification_details TEXT,
ADD COLUMN IF NOT EXISTS contract_type_confirmation VARCHAR(50),
ADD COLUMN IF NOT EXISTS income_expectation VARCHAR(50),
ADD COLUMN IF NOT EXISTS income_expectation_details TEXT,
ADD COLUMN IF NOT EXISTS employment_stable VARCHAR(50),
ADD COLUMN IF NOT EXISTS employment_stable_details TEXT;

-- Drop old performance-focused fields
ALTER TABLE employer_references
DROP COLUMN IF EXISTS performance_rating,
DROP COLUMN IF EXISTS performance_details,
DROP COLUMN IF EXISTS disciplinary_issues,
DROP COLUMN IF EXISTS disciplinary_details,
DROP COLUMN IF EXISTS absence_record,
DROP COLUMN IF EXISTS absence_details,
DROP COLUMN IF EXISTS would_reemploy,
DROP COLUMN IF EXISTS would_reemploy_details;
