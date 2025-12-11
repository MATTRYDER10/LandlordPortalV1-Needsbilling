-- Migration: Add CASCADE delete to sent_offer_forms.tenant_offer_id foreign key
-- This ensures sent_offer_forms records are automatically deleted when the parent tenant_offer is deleted

ALTER TABLE sent_offer_forms
DROP CONSTRAINT sent_offer_forms_tenant_offer_id_fkey;

ALTER TABLE sent_offer_forms
ADD CONSTRAINT sent_offer_forms_tenant_offer_id_fkey
FOREIGN KEY (tenant_offer_id) REFERENCES tenant_offers(id) ON DELETE CASCADE;
