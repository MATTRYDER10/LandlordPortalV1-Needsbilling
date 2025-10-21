-- Migration to update landlord_references table
-- Remove old complex fields and add new simple toggle fields

-- Add new simple fields
ALTER TABLE landlord_references
ADD COLUMN IF NOT EXISTS address_correct VARCHAR(50),
ADD COLUMN IF NOT EXISTS tenancy_length_months INTEGER,
ADD COLUMN IF NOT EXISTS monthly_rent_confirm DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS good_tenant VARCHAR(50);

-- Drop old complex fields
ALTER TABLE landlord_references
DROP COLUMN IF EXISTS rent_paid_on_time_details,
DROP COLUMN IF EXISTS property_condition,
DROP COLUMN IF EXISTS property_condition_details,
DROP COLUMN IF EXISTS neighbour_complaints,
DROP COLUMN IF EXISTS neighbour_complaints_details,
DROP COLUMN IF EXISTS breach_of_tenancy,
DROP COLUMN IF EXISTS breach_of_tenancy_details,
DROP COLUMN IF EXISTS would_rent_again_details;

-- Note: Keeping rent_paid_on_time and would_rent_again as they're still used, just simplified
