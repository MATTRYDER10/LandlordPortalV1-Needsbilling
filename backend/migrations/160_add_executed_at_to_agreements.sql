-- Migration 160: Add executed_at column to agreements table
-- This tracks when the agreement was executed (all parties signed)

ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN agreements.executed_at IS 'Timestamp when the agreement was fully executed (all parties signed)';

-- Set executed_at for already executed agreements based on signing_status
UPDATE agreements
SET executed_at = updated_at
WHERE signing_status = 'executed' AND executed_at IS NULL;
