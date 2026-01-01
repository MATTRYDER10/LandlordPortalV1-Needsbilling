-- Migration 131: Add property linking to tenant offers
-- This allows offers to be linked to properties for activity tracking and document management

-- Add linked_property_id to tenant_offers table
ALTER TABLE tenant_offers
ADD COLUMN IF NOT EXISTS linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Add linked_property_id to sent_offer_forms table
ALTER TABLE sent_offer_forms
ADD COLUMN IF NOT EXISTS linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_offers_linked_property
ON tenant_offers(linked_property_id)
WHERE linked_property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sent_offer_forms_linked_property
ON sent_offer_forms(linked_property_id)
WHERE linked_property_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN tenant_offers.linked_property_id IS 'Links the offer to a property in the properties module for activity tracking';
COMMENT ON COLUMN sent_offer_forms.linked_property_id IS 'Links the sent offer form to a property in the properties module';
