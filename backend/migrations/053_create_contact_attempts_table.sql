-- Create contact_attempts table for tracking all chase communications
CREATE TABLE IF NOT EXISTS contact_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'PHONE', 'WHATSAPP')),
    contact_type VARCHAR(50) NOT NULL, -- e.g., 'LANDLORD', 'EMPLOYER', 'TENANT', 'AGENT', 'ACCOUNTANT', 'GUARANTOR'
    recipient_name VARCHAR(255),
    recipient_contact VARCHAR(255), -- email address or phone number
    outcome VARCHAR(50) NOT NULL, -- e.g., 'SENT', 'DELIVERED', 'RESPONDED', 'NO_RESPONSE', 'BOUNCED', 'BUSY', 'NO_ANSWER'
    notes TEXT,
    attachments JSONB DEFAULT '[]'::jsonb, -- Array of attachment metadata
    created_by UUID NOT NULL REFERENCES staff_users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb -- For additional flexible data
);

-- Create indexes for efficient querying
CREATE INDEX idx_contact_attempts_work_item_id ON contact_attempts(work_item_id);
CREATE INDEX idx_contact_attempts_reference_id ON contact_attempts(reference_id);
CREATE INDEX idx_contact_attempts_channel ON contact_attempts(channel);
CREATE INDEX idx_contact_attempts_created_at ON contact_attempts(created_at);
CREATE INDEX idx_contact_attempts_created_by ON contact_attempts(created_by);
CREATE INDEX idx_contact_attempts_contact_type ON contact_attempts(contact_type);

-- Enable RLS
ALTER TABLE contact_attempts ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all contact attempts
CREATE POLICY "Staff can view all contact attempts" ON contact_attempts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can insert contact attempts
CREATE POLICY "Staff can insert contact attempts" ON contact_attempts
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
            AND staff_users.id = created_by
        )
    );

-- Policy: Staff can update their own contact attempts
CREATE POLICY "Staff can update own contact attempts" ON contact_attempts
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
            AND staff_users.id = created_by
        )
    );

-- Function to update work_item last_activity_at when contact attempt is created
CREATE OR REPLACE FUNCTION update_work_item_activity_on_contact()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE work_items
    SET last_activity_at = NEW.created_at
    WHERE id = NEW.work_item_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update work item activity
CREATE TRIGGER update_work_item_activity_trigger
    AFTER INSERT ON contact_attempts
    FOR EACH ROW
    EXECUTE FUNCTION update_work_item_activity_on_contact();

COMMENT ON TABLE contact_attempts IS 'Log of all chase communication attempts (email, SMS, phone, WhatsApp)';
COMMENT ON COLUMN contact_attempts.channel IS 'Communication channel: EMAIL, SMS, PHONE, WHATSAPP';
COMMENT ON COLUMN contact_attempts.contact_type IS 'Who was contacted: LANDLORD, EMPLOYER, TENANT, AGENT, ACCOUNTANT, GUARANTOR';
COMMENT ON COLUMN contact_attempts.outcome IS 'Result of attempt: SENT, DELIVERED, RESPONDED, NO_RESPONSE, BOUNCED, BUSY, NO_ANSWER';
COMMENT ON COLUMN contact_attempts.attachments IS 'Array of attachment metadata: [{filename, url, size, type}]';
