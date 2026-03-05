-- Migration 156: Add move-in time request fields to tenancies
-- Allows agents to request move-in time preferences from tenants

-- Add move-in time request tracking fields
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_requested_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_requested_by UUID REFERENCES auth.users(id);

-- Tenant's response - stores two preferred time slots
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_slot_1 TEXT;  -- e.g., "9:00 AM"
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_slot_2 TEXT;  -- e.g., "2:00 PM"
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_tenant_notes TEXT;

-- Confirmed time by agent
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_confirmed TEXT;
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenancies ADD COLUMN IF NOT EXISTS move_in_time_confirmed_by UUID REFERENCES auth.users(id);

-- Index for quick lookup of pending time requests
CREATE INDEX IF NOT EXISTS idx_tenancies_move_in_time_pending
  ON tenancies(company_id)
  WHERE move_in_time_requested_at IS NOT NULL
    AND move_in_time_submitted_at IS NULL;
