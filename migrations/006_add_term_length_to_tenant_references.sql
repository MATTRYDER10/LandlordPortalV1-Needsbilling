-- Add term length fields to tenant_references table
ALTER TABLE tenant_references
ADD COLUMN term_years INTEGER DEFAULT 0,
ADD COLUMN term_months INTEGER DEFAULT 0;
