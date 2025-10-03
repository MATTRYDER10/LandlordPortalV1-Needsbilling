-- Staff System Migration - PART 1
-- Run this FIRST, then wait a moment before running Part 2
-- This must be run separately because PostgreSQL requires enum values to be committed before use

-- 1. Add 'pending_verification' to reference_status enum
ALTER TYPE reference_status ADD VALUE IF NOT EXISTS 'pending_verification';
