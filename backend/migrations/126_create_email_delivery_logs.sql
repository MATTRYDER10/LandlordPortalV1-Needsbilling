-- Migration: Create email delivery logs table for Resend integration
-- Tracks email messages sent and their delivery status via webhooks
-- Pattern follows sms_delivery_logs table structure

CREATE TABLE IF NOT EXISTS email_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Resend message identification
    resend_email_id TEXT UNIQUE NOT NULL,

    -- Reference association (optional - emails may be sent for other purposes)
    reference_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL,
    reference_type TEXT, -- 'tenant', 'guarantor', 'landlord', 'employer', 'accountant', 'agent'

    -- Recipient (encrypted for PII compliance)
    to_email_encrypted TEXT NOT NULL,

    -- Message details
    subject TEXT NOT NULL,

    -- Delivery tracking (Resend statuses)
    -- 'sent' - Initial status when email is sent to Resend
    -- 'delivered' - Email successfully delivered to recipient's mail server
    -- 'bounced' - Email permanently rejected
    -- 'complained' - Recipient marked as spam
    -- 'delivery_delayed' - Temporary delivery issue
    status TEXT DEFAULT 'sent',
    bounce_type TEXT,     -- 'hard' or 'soft' for bounced emails
    error_message TEXT,

    -- Timestamps
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_reference_id ON email_delivery_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_resend_id ON email_delivery_logs(resend_email_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_status ON email_delivery_logs(status);

-- Enable Row Level Security
ALTER TABLE email_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role (backend) to have full access
CREATE POLICY "Allow service role full access on email_delivery_logs"
    ON email_delivery_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
