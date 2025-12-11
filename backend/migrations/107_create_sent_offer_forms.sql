-- Migration: Create sent_offer_forms table for tracking offer forms sent to tenants
-- This allows agents to see which offer forms have been sent but not yet submitted

CREATE TABLE sent_offer_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    sent_by UUID NOT NULL REFERENCES auth.users(id),
    tenant_email TEXT NOT NULL,
    property_address_encrypted TEXT NOT NULL,
    property_city_encrypted TEXT,
    property_postcode_encrypted TEXT,
    rent_amount DECIMAL(10,2),
    offer_deposit_replacement BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'submitted')),
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    tenant_offer_id UUID REFERENCES tenant_offers(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fetching sent offers by company
CREATE INDEX idx_sent_offer_forms_company ON sent_offer_forms(company_id);

-- Index for filtering by status
CREATE INDEX idx_sent_offer_forms_status ON sent_offer_forms(status);

-- Index for looking up by tenant email when they submit
CREATE INDEX idx_sent_offer_forms_email ON sent_offer_forms(tenant_email);
