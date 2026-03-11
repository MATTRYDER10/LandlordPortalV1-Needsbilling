ALTER TABLE sent_offer_forms
ADD COLUMN IF NOT EXISTS form_ref TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_sent_offer_forms_form_ref ON sent_offer_forms(form_ref);

UPDATE sent_offer_forms
SET form_ref = 'OF-' || UPPER(SUBSTRING(id::text, 1, 8))
WHERE form_ref IS NULL;

ALTER TABLE sent_offer_forms
ALTER COLUMN form_ref SET NOT NULL;
