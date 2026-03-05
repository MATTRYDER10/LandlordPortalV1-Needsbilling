-- Migration 151: Add conversion tracking to tenant_references
-- This migration adds columns to track when a reference is converted to a tenancy

-- Add conversion tracking columns to tenant_references
ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS converted_to_tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_at TIMESTAMP WITH TIME ZONE;

-- Index for finding converted references
CREATE INDEX IF NOT EXISTS idx_tenant_references_converted
  ON tenant_references(converted_to_tenancy_id)
  WHERE converted_to_tenancy_id IS NOT NULL;

-- Index for finding unconverted completed references
CREATE INDEX IF NOT EXISTS idx_tenant_references_ready_for_conversion
  ON tenant_references(company_id, status, verification_state)
  WHERE status = 'completed'
    AND verification_state = 'COMPLETED'
    AND converted_to_tenancy_id IS NULL
    AND is_guarantor = FALSE;
