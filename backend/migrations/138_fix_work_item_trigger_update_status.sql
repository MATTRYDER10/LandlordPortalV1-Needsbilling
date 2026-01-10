-- Migration 138: Fix work item trigger to update status on conflict
-- Issue: When employer reference is submitted and reference moves back to pending_verification,
-- the trigger doesn't update existing RETURNED work items back to AVAILABLE
-- This migration changes DO NOTHING to DO UPDATE SET status = 'AVAILABLE'

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS auto_create_work_item_trigger ON tenant_references;
DROP FUNCTION IF EXISTS auto_create_work_item();

-- Recreate function with status update on conflict
CREATE OR REPLACE FUNCTION auto_create_work_item()
RETURNS TRIGGER AS $$
BEGIN
    -- When reference moves to pending_verification, create VERIFY work item
    -- ONLY for non-guarantor references (is_guarantor = false or null)
    IF NEW.status = 'pending_verification'
       AND COALESCE(NEW.is_guarantor, false) = false
       AND (OLD.status IS NULL OR OLD.status != 'pending_verification') THEN
        INSERT INTO work_items (reference_id, work_type, status, priority)
        VALUES (NEW.id, 'VERIFY', 'AVAILABLE', 0)
        ON CONFLICT (reference_id, work_type)
        DO UPDATE SET
            status = 'AVAILABLE',
            assigned_to = NULL,
            updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER auto_create_work_item_trigger
    AFTER INSERT OR UPDATE ON tenant_references
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_work_item();
