-- Migration 129: Agreement and Reference Property Integration
-- Date: 2025-12-31
--
-- This migration adds:
-- 1. property_id to agreements table for linking agreements to properties
-- 2. compliance_override fields for tracking when expired compliance is acknowledged
-- 3. linked_property_id to tenant_references for optional property linking

-- ============================================================================
-- AGREEMENTS TABLE - Add property integration columns
-- ============================================================================

-- Add property_id column to link agreements to properties
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Add compliance override tracking
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS compliance_override_acknowledged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS compliance_override_reason TEXT,
ADD COLUMN IF NOT EXISTS compliance_override_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS compliance_override_by UUID REFERENCES auth.users(id);

-- Create index for property lookups
CREATE INDEX IF NOT EXISTS idx_agreements_property_id ON agreements(property_id);

-- ============================================================================
-- TENANT_REFERENCES TABLE - Add optional property link
-- ============================================================================

-- Add linked_property_id to tenant_references
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Create index for property lookups
CREATE INDEX IF NOT EXISTS idx_tenant_references_linked_property_id ON tenant_references(linked_property_id);

-- ============================================================================
-- COMPLIANCE_OVERRIDES TABLE - Already exists in migration 128
-- We'll use it to track agreement-specific compliance overrides
-- ============================================================================

-- Add comments
COMMENT ON COLUMN agreements.property_id IS 'Optional link to a property from the Properties module';
COMMENT ON COLUMN agreements.compliance_override_acknowledged IS 'Whether user acknowledged expired compliance when creating agreement';
COMMENT ON COLUMN agreements.compliance_override_reason IS 'Reason provided for proceeding with expired compliance';
COMMENT ON COLUMN agreements.compliance_override_at IS 'When the compliance override was acknowledged';
COMMENT ON COLUMN agreements.compliance_override_by IS 'User who acknowledged the compliance override';
COMMENT ON COLUMN tenant_references.linked_property_id IS 'Optional link to a property - auto-fills address when selected';
