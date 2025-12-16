-- Migration 118: Backfill initial_request_sent_at for existing chase_dependencies
-- This ensures existing records appear in the chase queue

-- Update all chase_dependencies where initial_request_sent_at is NULL
-- Set it to created_at (assumes the form was sent when the dependency was created)
UPDATE chase_dependencies
SET initial_request_sent_at = created_at
WHERE initial_request_sent_at IS NULL;
