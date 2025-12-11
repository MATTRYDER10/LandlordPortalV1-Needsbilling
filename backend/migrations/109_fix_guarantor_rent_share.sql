-- Migration: Fix guarantor references missing rent_share
-- Guarantors should inherit the rent_share from the tenant they're guaranteeing
-- Previously, guarantors only had monthly_rent (full property rent) but not rent_share

-- Update guarantor references to inherit rent_share from their parent tenant reference
UPDATE tenant_references g
SET rent_share = p.rent_share,
    updated_at = NOW()
FROM tenant_references p
WHERE g.is_guarantor = true
  AND g.guarantor_for_reference_id = p.id
  AND g.rent_share IS NULL
  AND p.rent_share IS NOT NULL;
