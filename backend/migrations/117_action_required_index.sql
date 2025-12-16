-- Migration 117: Add index for action_required status
-- Run this AFTER migration 116 has been committed

-- 1. Add index for efficient querying of action_required references by company
CREATE INDEX IF NOT EXISTS idx_tenant_references_action_required
ON tenant_references(company_id, status) WHERE status = 'action_required';

-- 2. Add documentation comment
COMMENT ON COLUMN tenant_references.status IS 'Reference status: pending (not started), in_progress (tenant filling), pending_verification (ready for staff review), action_required (chase cycles exhausted - needs agent intervention), completed, rejected, cancelled, awaiting_guarantor';
