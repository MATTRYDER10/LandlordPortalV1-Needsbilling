-- Migration 119: Backdate initial_request_sent_at to 9 hours ago for testing
-- This makes existing chase dependencies appear in the queue immediately

UPDATE chase_dependencies
SET initial_request_sent_at = NOW() - INTERVAL '9 hours'
WHERE initial_request_sent_at > NOW() - INTERVAL '1 hour';
