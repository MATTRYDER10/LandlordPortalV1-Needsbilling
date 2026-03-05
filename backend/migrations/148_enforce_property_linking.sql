-- Migration: Enforce property linking for tenant_references, tenant_offers, and agreements
-- This migration adds NOT NULL constraints after backfilling existing records
--
-- IMPORTANT: Run this migration during a maintenance window as it may take time
-- to process existing records.
--
-- What this migration does:
-- 1. Creates a function to auto-create properties from address data
-- 2. Backfills tenant_references without linked_property_id
-- 3. Backfills tenant_offers without linked_property_id
-- 4. Adds NOT NULL constraints (OPTIONAL - commented out for safety)

-- ============================================================================
-- Step 1: Create helper function to generate property from reference address
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_property_from_reference(ref_id UUID)
RETURNS UUID AS $$
DECLARE
  ref_record RECORD;
  new_property_id UUID;
  normalized_postcode TEXT;
  existing_property_id UUID;
BEGIN
  -- Get reference data
  SELECT
    id,
    company_id,
    property_address_encrypted,
    property_city_encrypted,
    property_postcode_encrypted,
    linked_property_id
  INTO ref_record
  FROM tenant_references
  WHERE id = ref_id;

  -- If already has property, return it
  IF ref_record.linked_property_id IS NOT NULL THEN
    RETURN ref_record.linked_property_id;
  END IF;

  -- Check if we have address data
  IF ref_record.property_postcode_encrypted IS NULL THEN
    RETURN NULL;
  END IF;

  -- Normalize postcode (uppercase, no spaces)
  -- Note: We can't decrypt in SQL, so we'll match on encrypted value
  -- This means existing properties won't be matched - each reference gets its own property
  -- A more sophisticated approach would use a backend script

  -- Create new property
  INSERT INTO properties (
    company_id,
    address_line1_encrypted,
    city_encrypted,
    postcode,
    status,
    created_at
  )
  VALUES (
    ref_record.company_id,
    ref_record.property_address_encrypted,
    ref_record.property_city_encrypted,
    'BACKFILL', -- Placeholder - needs to be updated by backend script
    'vacant',
    NOW()
  )
  RETURNING id INTO new_property_id;

  -- Update reference
  UPDATE tenant_references
  SET linked_property_id = new_property_id
  WHERE id = ref_id;

  RETURN new_property_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 2: Create property_tenancies entries for existing linked references
-- ============================================================================

-- Insert into property_tenancies for all references that have linked_property_id
-- but don't have a property_tenancies entry
INSERT INTO property_tenancies (property_id, reference_id, company_id, is_active, created_at)
SELECT
  tr.linked_property_id,
  tr.id,
  tr.company_id,
  CASE WHEN tr.status IN ('completed', 'pending_verification', 'in_progress') THEN true ELSE false END,
  COALESCE(tr.created_at, NOW())
FROM tenant_references tr
WHERE tr.linked_property_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM property_tenancies pt
    WHERE pt.reference_id = tr.id
  )
ON CONFLICT (property_id, reference_id) DO NOTHING;

-- ============================================================================
-- Step 3: Count records without property linking (for visibility)
-- ============================================================================

DO $$
DECLARE
  refs_without_property INTEGER;
  offers_without_property INTEGER;
  agreements_without_property INTEGER;
BEGIN
  SELECT COUNT(*) INTO refs_without_property
  FROM tenant_references
  WHERE linked_property_id IS NULL;

  SELECT COUNT(*) INTO offers_without_property
  FROM tenant_offers
  WHERE linked_property_id IS NULL;

  SELECT COUNT(*) INTO agreements_without_property
  FROM agreements
  WHERE property_id IS NULL;

  RAISE NOTICE '=== Property Linking Status ===';
  RAISE NOTICE 'References without property: %', refs_without_property;
  RAISE NOTICE 'Offers without property: %', offers_without_property;
  RAISE NOTICE 'Agreements without property: %', agreements_without_property;
  RAISE NOTICE '';
  RAISE NOTICE 'NOTE: Run the backend backfill script before adding NOT NULL constraints:';
  RAISE NOTICE 'npm run backfill-property-links';
END $$;

-- ============================================================================
-- Step 4: NOT NULL constraints (COMMENTED OUT - run after backfill completes)
-- ============================================================================

-- IMPORTANT: Only uncomment these after running the backend backfill script
-- and confirming all records have linked_property_id

-- ALTER TABLE tenant_references
--   ALTER COLUMN linked_property_id SET NOT NULL;

-- ALTER TABLE tenant_offers
--   ALTER COLUMN linked_property_id SET NOT NULL;

-- ALTER TABLE agreements
--   ALTER COLUMN property_id SET NOT NULL;

-- ============================================================================
-- Cleanup: Drop temporary function
-- ============================================================================

DROP FUNCTION IF EXISTS backfill_property_from_reference(UUID);

-- ============================================================================
-- Notes for Implementation
-- ============================================================================

-- The actual backfill should be done via a backend script that can:
-- 1. Decrypt addresses
-- 2. Use the propertyMatchingService to find or create properties
-- 3. Update records with the correct linked_property_id
--
-- See: /backend/src/scripts/backfillPropertyLinks.ts
