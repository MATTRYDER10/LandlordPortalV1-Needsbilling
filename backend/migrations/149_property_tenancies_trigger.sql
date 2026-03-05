-- Migration: Auto-populate property_tenancies when reference is linked to property
-- This trigger ensures property_tenancies entries are created/updated automatically
-- when a tenant_reference gets a linked_property_id

-- ============================================================================
-- Step 1: Create function to handle property tenancy creation
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_create_property_tenancy()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run if linked_property_id is being set (not null) and wasn't set before
  IF NEW.linked_property_id IS NOT NULL AND
     (OLD.linked_property_id IS NULL OR OLD.linked_property_id != NEW.linked_property_id) THEN

    -- Insert into property_tenancies if not exists
    INSERT INTO property_tenancies (
      property_id,
      reference_id,
      company_id,
      is_active,
      created_at
    )
    VALUES (
      NEW.linked_property_id,
      NEW.id,
      NEW.company_id,
      CASE
        WHEN NEW.status IN ('completed', 'pending_verification', 'in_progress') THEN true
        ELSE false
      END,
      NOW()
    )
    ON CONFLICT (property_id, reference_id) DO UPDATE
    SET
      is_active = CASE
        WHEN NEW.status IN ('completed', 'pending_verification', 'in_progress') THEN true
        ELSE false
      END,
      updated_at = NOW();

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 2: Create trigger on tenant_references
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_create_property_tenancy ON tenant_references;

CREATE TRIGGER trigger_auto_create_property_tenancy
  AFTER INSERT OR UPDATE OF linked_property_id ON tenant_references
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_property_tenancy();

-- ============================================================================
-- Step 3: Create function to update property_tenancies when reference status changes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_property_tenancy_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run if status changed and there's a linked property
  IF NEW.status != OLD.status AND NEW.linked_property_id IS NOT NULL THEN

    UPDATE property_tenancies
    SET
      is_active = CASE
        WHEN NEW.status IN ('completed', 'pending_verification', 'in_progress') THEN true
        ELSE false
      END,
      updated_at = NOW()
    WHERE reference_id = NEW.id
      AND property_id = NEW.linked_property_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Step 4: Create trigger for status updates
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_update_property_tenancy_status ON tenant_references;

CREATE TRIGGER trigger_update_property_tenancy_status
  AFTER UPDATE OF status ON tenant_references
  FOR EACH ROW
  EXECUTE FUNCTION update_property_tenancy_status();

-- ============================================================================
-- Step 5: Add index for efficient lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_property_tenancies_property_active
  ON property_tenancies(property_id, is_active)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_property_tenancies_reference
  ON property_tenancies(reference_id);

-- ============================================================================
-- Step 6: Add trigger for tenancy conversion
-- When a property_tenancy gets a tenancy_id, mark related property as 'let'
-- ============================================================================

CREATE OR REPLACE FUNCTION update_property_status_on_tenancy()
RETURNS TRIGGER AS $$
BEGIN
  -- When tenancy_id is set, update property status to 'let'
  IF NEW.tenancy_id IS NOT NULL AND
     (OLD.tenancy_id IS NULL OR OLD.tenancy_id != NEW.tenancy_id) THEN

    UPDATE properties
    SET
      status = 'let',
      updated_at = NOW()
    WHERE id = NEW.property_id
      AND status != 'let';

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_property_status_on_tenancy ON property_tenancies;

CREATE TRIGGER trigger_update_property_status_on_tenancy
  AFTER UPDATE OF tenancy_id ON property_tenancies
  FOR EACH ROW
  EXECUTE FUNCTION update_property_status_on_tenancy();

-- ============================================================================
-- Notes
-- ============================================================================

-- These triggers ensure:
-- 1. When a reference is linked to a property, a property_tenancies entry is created
-- 2. When a reference status changes, the property_tenancies.is_active is updated
-- 3. When a property_tenancy gets a tenancy_id (conversion), the property status becomes 'let'
--
-- The is_active flag indicates whether this is a current/potential tenant:
-- - true: in_progress, pending_verification, completed references
-- - false: rejected, expired, cancelled references
