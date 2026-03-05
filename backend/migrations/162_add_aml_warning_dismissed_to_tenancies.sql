-- Migration 162: Add dismissed AML warning flag to tenancies
-- Allows users to dismiss the landlord AML warning per tenancy

ALTER TABLE tenancies
  ADD COLUMN IF NOT EXISTS aml_warning_dismissed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS aml_warning_dismissed_by UUID REFERENCES auth.users(id);
