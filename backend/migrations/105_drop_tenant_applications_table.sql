-- Migration 105: Drop tenant_applications table
-- This table was a duplicate of tenant_offers functionality and has been removed

DROP TABLE IF EXISTS tenant_applications;
