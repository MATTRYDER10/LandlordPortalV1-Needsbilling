-- Migration 177: Add payment receipt fields to rent_due_date_changes table
-- Tracks payment receipt details and generated notice document

-- Add payment_received_at column (when agent confirms payment was received)
ALTER TABLE rent_due_date_changes
ADD COLUMN IF NOT EXISTS payment_received_at TIMESTAMP WITH TIME ZONE;

-- Add payment_reference column (bank reference, transaction ID, etc.)
ALTER TABLE rent_due_date_changes
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255);

-- Add notice_document_id column (FK to property_documents for the generated PDF)
ALTER TABLE rent_due_date_changes
ADD COLUMN IF NOT EXISTS notice_document_id UUID REFERENCES property_documents(id);

-- Add index for document lookup
CREATE INDEX IF NOT EXISTS idx_rent_due_date_changes_document
ON rent_due_date_changes(notice_document_id)
WHERE notice_document_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN rent_due_date_changes.payment_received_at IS 'Date/time when agent confirmed payment was received';
COMMENT ON COLUMN rent_due_date_changes.payment_reference IS 'Payment reference (bank transfer ref, card payment ID, etc.)';
COMMENT ON COLUMN rent_due_date_changes.notice_document_id IS 'Reference to generated confirmation notice PDF in property_documents';
