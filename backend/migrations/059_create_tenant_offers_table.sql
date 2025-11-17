-- Migration 059: Create tenant_offers table
-- This migration creates the tenant_offers table for storing rental property offers from tenants

-- ============================================================================
-- TENANT OFFERS TABLE
-- Stores tenant offers to rent properties, including offer details and tenant information
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Property Information (encrypted)
  property_address_encrypted TEXT NOT NULL,
  property_city_encrypted TEXT,
  property_postcode_encrypted TEXT,

  -- Offer Details
  offered_rent_amount DECIMAL(10, 2) NOT NULL,
  proposed_move_in_date DATE NOT NULL,
  proposed_tenancy_length_months INTEGER NOT NULL CHECK (proposed_tenancy_length_months >= 1 AND proposed_tenancy_length_months <= 12),
  deposit_amount DECIMAL(10, 2),
  special_conditions_encrypted TEXT,

  -- Offer Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'declined', 'accepted_with_changes'
  declined_reason_encrypted TEXT,
  holding_deposit_received BOOLEAN DEFAULT FALSE,
  holding_deposit_received_at TIMESTAMP WITH TIME ZONE,
  reference_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL, -- Link to created reference

  -- Agent Actions
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  declined_at TIMESTAMP WITH TIME ZONE,
  declined_by UUID REFERENCES auth.users(id),
  accepted_with_changes_at TIMESTAMP WITH TIME ZONE,
  accepted_with_changes_by UUID REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tenant_offers_company_id ON tenant_offers(company_id);
CREATE INDEX IF NOT EXISTS idx_tenant_offers_status ON tenant_offers(status);
CREATE INDEX IF NOT EXISTS idx_tenant_offers_created_at ON tenant_offers(created_at);
CREATE INDEX IF NOT EXISTS idx_tenant_offers_reference_id ON tenant_offers(reference_id);

-- Enable Row Level Security
ALTER TABLE tenant_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Company members can view offers from their company
CREATE POLICY "Company members can view their company's tenant offers"
  ON tenant_offers
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Company members can create offers for their company
CREATE POLICY "Company members can create tenant offers for their company"
  ON tenant_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Company members can update offers from their company
CREATE POLICY "Company members can update their company's tenant offers"
  ON tenant_offers
  FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policy: Company members can delete offers from their company
CREATE POLICY "Company members can delete their company's tenant offers"
  ON tenant_offers
  FOR DELETE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id
      FROM company_users
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- TENANT OFFER TENANTS TABLE
-- Stores tenant information for each offer (supports unlimited tenants)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_offer_tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_offer_id UUID NOT NULL REFERENCES tenant_offers(id) ON DELETE CASCADE,
  tenant_order INTEGER NOT NULL, -- Order of tenant in the offer (1, 2, 3, etc.)

  -- Tenant Information (encrypted)
  name_encrypted TEXT NOT NULL,
  address_encrypted TEXT NOT NULL,
  phone_encrypted TEXT NOT NULL,
  email_encrypted TEXT NOT NULL,
  annual_income_encrypted TEXT NOT NULL,

  -- Declarations
  no_ccj_bankruptcy_iva BOOLEAN NOT NULL DEFAULT FALSE, -- Confirmation checkbox

  -- Signature
  signature_encrypted TEXT,
  signature_name_encrypted TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tenant_offer_tenants_offer_id ON tenant_offer_tenants(tenant_offer_id);
CREATE INDEX IF NOT EXISTS idx_tenant_offer_tenants_order ON tenant_offer_tenants(tenant_offer_id, tenant_order);

-- Enable Row Level Security
ALTER TABLE tenant_offer_tenants ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Inherit from parent offer
CREATE POLICY "Company members can view tenant offer tenants"
  ON tenant_offer_tenants
  FOR SELECT
  TO authenticated
  USING (
    tenant_offer_id IN (
      SELECT id
      FROM tenant_offers
      WHERE company_id IN (
        SELECT company_id
        FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Company members can manage tenant offer tenants"
  ON tenant_offer_tenants
  FOR ALL
  TO authenticated
  USING (
    tenant_offer_id IN (
      SELECT id
      FROM tenant_offers
      WHERE company_id IN (
        SELECT company_id
        FROM company_users
        WHERE user_id = auth.uid()
      )
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tenant_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenant_offers_updated_at
  BEFORE UPDATE ON tenant_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_offers_updated_at();

CREATE TRIGGER update_tenant_offer_tenants_updated_at
  BEFORE UPDATE ON tenant_offer_tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_offers_updated_at();

