-- Migration 097: Capture submission metadata (IP & geolocation) for references

ALTER TABLE tenant_references
  ADD COLUMN IF NOT EXISTS submitted_ip_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS submitted_geolocation_encrypted TEXT;

ALTER TABLE landlord_references
  ADD COLUMN IF NOT EXISTS submitted_ip_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS submitted_geolocation_encrypted TEXT;

ALTER TABLE agent_references
  ADD COLUMN IF NOT EXISTS submitted_ip_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS submitted_geolocation_encrypted TEXT;

ALTER TABLE employer_references
  ADD COLUMN IF NOT EXISTS submitted_ip_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS submitted_geolocation_encrypted TEXT;

ALTER TABLE accountant_references
  ADD COLUMN IF NOT EXISTS submitted_ip_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS submitted_geolocation_encrypted TEXT;

ALTER TABLE guarantor_references
  ADD COLUMN IF NOT EXISTS submitted_ip_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS submitted_geolocation_encrypted TEXT;

