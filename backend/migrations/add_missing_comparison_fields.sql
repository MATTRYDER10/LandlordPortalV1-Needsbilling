-- Migration: Add missing fields for proper tenant vs reference comparison
-- Created: 2025-10-17

-- Add previous rental details for comparison with landlord/agent references
ALTER TABLE public.tenant_references
  ADD COLUMN IF NOT EXISTS previous_monthly_rent_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_tenancy_start_date DATE,
  ADD COLUMN IF NOT EXISTS previous_tenancy_end_date DATE,
  ADD COLUMN IF NOT EXISTS previous_agency_name_encrypted TEXT;

-- Add employment end date for proper employment verification
ALTER TABLE public.tenant_references
  ADD COLUMN IF NOT EXISTS employment_end_date DATE,
  ADD COLUMN IF NOT EXISTS employment_salary_frequency TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.tenant_references.previous_monthly_rent_encrypted IS 'Monthly rent tenant paid at previous address (for comparison with landlord/agent reference)';
COMMENT ON COLUMN public.tenant_references.previous_tenancy_start_date IS 'Exact start date of previous tenancy (for comparison with landlord/agent reference)';
COMMENT ON COLUMN public.tenant_references.previous_tenancy_end_date IS 'Exact end date of previous tenancy (for comparison with landlord/agent reference)';
COMMENT ON COLUMN public.tenant_references.previous_agency_name_encrypted IS 'Name of letting agency for previous rental (when reference_type is agent)';
COMMENT ON COLUMN public.tenant_references.employment_end_date IS 'Employment end date (for previous employment)';
COMMENT ON COLUMN public.tenant_references.employment_salary_frequency IS 'How often salary is paid (monthly, bi-weekly, weekly, annually)';

-- Note: The existing fields tenancy_years and tenancy_months can remain as duration backup
-- The new exact dates will be primary for comparison
