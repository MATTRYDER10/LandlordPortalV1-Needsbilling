-- Run this in Supabase SQL Editor
ALTER TABLE public.tenant_references
  ADD COLUMN IF NOT EXISTS previous_monthly_rent_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_tenancy_start_date DATE,
  ADD COLUMN IF NOT EXISTS previous_tenancy_end_date DATE,
  ADD COLUMN IF NOT EXISTS previous_agency_name_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS employment_end_date DATE,
  ADD COLUMN IF NOT EXISTS employment_salary_frequency TEXT;
