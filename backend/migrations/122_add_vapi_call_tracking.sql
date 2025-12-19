-- Migration: Add VAPI call tracking for voice call integration
-- Adds call_attempts column to chase_dependencies and creates call_delivery_logs table

-- Add call_attempts column to chase_dependencies
ALTER TABLE chase_dependencies ADD COLUMN IF NOT EXISTS call_attempts INTEGER DEFAULT 0;

-- Create call_delivery_logs table (mirrors sms_delivery_logs pattern)
CREATE TABLE IF NOT EXISTS call_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- VAPI call identification
    vapi_call_id TEXT UNIQUE NOT NULL,

    -- Reference association (optional)
    reference_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL,
    dependency_id UUID REFERENCES chase_dependencies(id) ON DELETE SET NULL,
    reference_type TEXT, -- 'tenant', 'guarantor', 'landlord', 'employer', 'accountant', 'agent'

    -- Recipient (encrypted for PII compliance)
    phone_number_encrypted TEXT NOT NULL,

    -- VAPI configuration used
    assistant_id TEXT,
    phone_number_id TEXT,

    -- Call outcome tracking
    status TEXT DEFAULT 'initiated', -- 'initiated', 'queued', 'ringing', 'in-progress', 'forwarding', 'ended', 'failed'
    ended_reason TEXT, -- Reason call ended (from VAPI end-of-call-report)
    call_duration_seconds INTEGER,

    -- Transcript and summary (if call connected)
    transcript TEXT,
    summary TEXT,

    -- Error tracking
    error_code TEXT,
    error_message TEXT,

    -- Timestamps
    initiated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE, -- When call connected
    ended_at TIMESTAMP WITH TIME ZONE,
    status_updated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_call_delivery_logs_reference_id ON call_delivery_logs(reference_id);
CREATE INDEX IF NOT EXISTS idx_call_delivery_logs_dependency_id ON call_delivery_logs(dependency_id);
CREATE INDEX IF NOT EXISTS idx_call_delivery_logs_vapi_call_id ON call_delivery_logs(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_call_delivery_logs_status ON call_delivery_logs(status);

-- Enable Row Level Security
ALTER TABLE call_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role (backend) to have full access
CREATE POLICY "Allow service role full access on call_delivery_logs"
    ON call_delivery_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE call_delivery_logs IS 'Tracks VAPI voice calls sent for chase reminders with delivery status';
