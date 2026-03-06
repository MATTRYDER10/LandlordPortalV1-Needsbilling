-- Migration 189: Add 'applied' to rent_increase_notices status check constraint
-- The rent increase scheduler sets status to 'applied' when the effective date is reached

ALTER TABLE rent_increase_notices DROP CONSTRAINT IF EXISTS rent_increase_notices_status_check;
ALTER TABLE rent_increase_notices ADD CONSTRAINT rent_increase_notices_status_check
  CHECK (status IN ('served', 'accepted', 'referred_to_tribunal', 'withdrawn', 'expired', 'applied'));
