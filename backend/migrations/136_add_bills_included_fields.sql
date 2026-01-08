-- Migration 136: Add bills_included field to properties, tenant_offers, tenant_references, and agreements
-- This tracks whether utility bills are included in the rent amount

-- Add to properties table (default for the property)
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS bills_included BOOLEAN DEFAULT FALSE;

-- Add to tenant_offers table (captured at offer stage)
ALTER TABLE tenant_offers
ADD COLUMN IF NOT EXISTS bills_included BOOLEAN DEFAULT FALSE;

-- Add to tenant_references table (passed through from offer)
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS bills_included BOOLEAN DEFAULT FALSE;

-- Add to agreements table (final value for the agreement)
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS bills_included BOOLEAN DEFAULT FALSE;
