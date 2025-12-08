-- Migration: Create SMS delivery logs table for Twilio integration
-- Tracks SMS messages sent and their delivery status via webhooks

CREATE TABLE IF NOT EXISTS sms_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Twilio message identification
    twilio_message_sid TEXT UNIQUE NOT NULL,

    -- Reference association (optional - SMS may be sent for other purposes)
    reference_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL,
    reference_type TEXT, -- 'tenant', 'guarantor', 'landlord', 'employer', 'accountant', 'agent'

    -- Recipient (encrypted for PII compliance)
    phone_number_encrypted TEXT NOT NULL,

    -- Message content
    message_body TEXT NOT NULL,

    -- Delivery tracking
    status TEXT DEFAULT 'sent', -- 'queued', 'sent', 'delivered', 'undelivered', 'failed'
    error_code TEXT,
    error_message TEXT,

    -- Twilio metadata
    from_number TEXT,
    num_segments INTEGER DEFAULT 1,

    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_reference_id ON sms_delivery_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_twilio_sid ON sms_delivery_logs(twilio_message_sid);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_status ON sms_delivery_logs(status);

-- Enable Row Level Security
ALTER TABLE sms_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role (backend) to have full access
CREATE POLICY "Allow service role full access on sms_delivery_logs"
    ON sms_delivery_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
