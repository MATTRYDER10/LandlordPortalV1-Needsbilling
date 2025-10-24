-- Run this SQL in your Supabase SQL Editor
-- This will add the missing columns and remove the old ones

-- Step 1: Add new simple fields (if they don't exist)
ALTER TABLE landlord_references
ADD COLUMN IF NOT EXISTS address_correct VARCHAR(50),
ADD COLUMN IF NOT EXISTS signature_name_encrypted TEXT;

-- Step 2: Drop old complex fields (if they exist)
-- Note: We're keeping the encrypted versions and dropping the plaintext versions
ALTER TABLE landlord_references
DROP COLUMN IF EXISTS property_condition,
DROP COLUMN IF EXISTS property_condition_details,
DROP COLUMN IF EXISTS neighbour_complaints,
DROP COLUMN IF EXISTS neighbour_complaints_details,
DROP COLUMN IF EXISTS breach_of_tenancy,
DROP COLUMN IF EXISTS breach_of_tenancy_details,
DROP COLUMN IF EXISTS rent_paid_on_time_details,
DROP COLUMN IF EXISTS would_rent_again_details;

-- Step 3: Drop the encrypted versions too (since we're not using them in the new form)
ALTER TABLE landlord_references
DROP COLUMN IF EXISTS property_condition_encrypted,
DROP COLUMN IF EXISTS property_condition_details_encrypted,
DROP COLUMN IF EXISTS neighbour_complaints_encrypted,
DROP COLUMN IF EXISTS neighbour_complaints_details_encrypted,
DROP COLUMN IF EXISTS breach_of_tenancy_encrypted,
DROP COLUMN IF EXISTS breach_of_tenancy_details_encrypted,
DROP COLUMN IF EXISTS rent_paid_on_time_details_encrypted,
DROP COLUMN IF EXISTS would_rent_again_details_encrypted;

-- Step 4: Verify the tenancy_still_in_progress field exists
ALTER TABLE landlord_references
ADD COLUMN IF NOT EXISTS tenancy_still_in_progress BOOLEAN DEFAULT FALSE;

-- Step 5: Remove NOT NULL constraint from tenancy_end_date (allow null when still in progress)
ALTER TABLE landlord_references
ALTER COLUMN tenancy_end_date DROP NOT NULL;

-- Add comments to explain the new fields
COMMENT ON COLUMN landlord_references.address_correct IS 'Landlord confirmation that the property address is correct';
COMMENT ON COLUMN landlord_references.good_tenant IS 'Landlord assessment of whether tenant was good';
COMMENT ON COLUMN landlord_references.tenancy_still_in_progress IS 'Indicates if the tenant is still in tenancy and no end date is known yet';
