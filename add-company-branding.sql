-- Add branding fields to companies table
-- Run this in Supabase SQL Editor

ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#FF8C41';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS button_color TEXT DEFAULT '#FF8C41';

-- Update existing records to have default values
UPDATE companies SET primary_color = '#FF8C41' WHERE primary_color IS NULL;
UPDATE companies SET button_color = '#FF8C41' WHERE button_color IS NULL;
