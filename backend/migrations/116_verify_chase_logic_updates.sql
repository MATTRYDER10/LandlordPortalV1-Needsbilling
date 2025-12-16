-- Migration 116: Verify & Chase Queue Logic Updates
-- Adds 'action_required' status for references where chase cycles are exhausted

-- The status column uses an enum type (reference_status)
-- Add 'action_required' as a new enum value

-- 1. Add 'action_required' to the reference_status enum type
-- Note: In PostgreSQL, you can only add new values to an enum, not remove them
ALTER TYPE reference_status ADD VALUE IF NOT EXISTS 'action_required';

-- NOTE: Run migration 117 separately after this one completes
-- The index and comment require the enum value to be committed first
