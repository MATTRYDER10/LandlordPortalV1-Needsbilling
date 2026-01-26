ALTER TABLE properties
ADD COLUMN IF NOT EXISTS council_tax_band text;

ALTER TABLE properties
DROP CONSTRAINT IF EXISTS properties_council_tax_band_check;

ALTER TABLE properties
ADD CONSTRAINT properties_council_tax_band_check
CHECK (council_tax_band IS NULL OR council_tax_band IN ('A','B','C','D','E','F','G','H'));
