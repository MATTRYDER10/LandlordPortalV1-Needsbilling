-- Migration: Create agreement signatures tables for e-signing workflow
-- Date: 2025-12-10

-- Add new columns to agreements table for signing workflow
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'english' CHECK (language IN ('english', 'welsh')),
ADD COLUMN IF NOT EXISTS signing_status TEXT DEFAULT 'draft' CHECK (signing_status IN ('draft', 'pending_signatures', 'partially_signed', 'fully_signed', 'expired', 'cancelled')),
ADD COLUMN IF NOT EXISTS signed_pdf_url TEXT,
ADD COLUMN IF NOT EXISTS signed_pdf_generated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS signing_initiated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS signing_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS signing_expires_at TIMESTAMP WITH TIME ZONE;

-- Create agreement_signatures table for tracking individual signer status
CREATE TABLE IF NOT EXISTS agreement_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,

  -- Signer identification
  signer_type TEXT NOT NULL CHECK (signer_type IN ('landlord', 'tenant', 'guarantor')),
  signer_index INTEGER NOT NULL, -- Position in the array (0-based)
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,

  -- Signature data
  signature_data TEXT, -- Base64 encoded PNG image of signature
  signature_type TEXT CHECK (signature_type IN ('draw', 'type')),
  typed_name TEXT, -- If signature type is 'type', store the typed name

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
  decline_reason TEXT, -- If signer declines, store their reason

  -- Magic link authentication
  signing_token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  token_used_at TIMESTAMP WITH TIME ZONE,

  -- Audit trail for legal validity
  ip_address INET,
  user_agent TEXT,
  geolocation JSONB, -- {latitude, longitude, accuracy, city, country}
  email_verified_at TIMESTAMP WITH TIME ZONE,
  signed_at TIMESTAMP WITH TIME ZONE,

  -- Email tracking
  last_email_sent_at TIMESTAMP WITH TIME ZONE,
  email_send_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique signer per agreement
  CONSTRAINT unique_signer_per_agreement UNIQUE (agreement_id, signer_type, signer_index)
);

-- Create agreement_signature_events table for detailed audit log
CREATE TABLE IF NOT EXISTS agreement_signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id UUID NOT NULL REFERENCES agreement_signatures(id) ON DELETE CASCADE,
  agreement_id UUID NOT NULL REFERENCES agreements(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',           -- Signature record created
    'email_sent',        -- Signing request email sent
    'email_opened',      -- Email opened (if tracking pixel used)
    'link_clicked',      -- Signing link was clicked
    'document_viewed',   -- Document was viewed/scrolled
    'signature_started', -- User started drawing/typing signature
    'signature_completed', -- Signature submitted successfully
    'signature_declined',  -- User declined to sign
    'reminder_sent',     -- Reminder email sent
    'token_expired',     -- Token expired without signing
    'token_regenerated'  -- New token generated (e.g., after expiry)
  )),

  -- Event context
  ip_address INET,
  user_agent TEXT,
  geolocation JSONB,
  metadata JSONB, -- Additional event-specific data

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agreement_signatures_agreement_id ON agreement_signatures(agreement_id);
CREATE INDEX IF NOT EXISTS idx_agreement_signatures_signing_token ON agreement_signatures(signing_token);
CREATE INDEX IF NOT EXISTS idx_agreement_signatures_status ON agreement_signatures(status);
CREATE INDEX IF NOT EXISTS idx_agreement_signatures_email ON agreement_signatures(signer_email);
CREATE INDEX IF NOT EXISTS idx_agreement_signature_events_signature_id ON agreement_signature_events(signature_id);
CREATE INDEX IF NOT EXISTS idx_agreement_signature_events_agreement_id ON agreement_signature_events(agreement_id);
CREATE INDEX IF NOT EXISTS idx_agreements_signing_status ON agreements(signing_status);

-- Enable Row Level Security
ALTER TABLE agreement_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_signature_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agreement_signatures
-- Companies can view their own agreement signatures
CREATE POLICY "Companies can view own agreement signatures"
  ON agreement_signatures
  FOR SELECT
  USING (
    agreement_id IN (
      SELECT id FROM agreements WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access to agreement_signatures"
  ON agreement_signatures
  FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for agreement_signature_events
CREATE POLICY "Companies can view own signature events"
  ON agreement_signature_events
  FOR SELECT
  USING (
    agreement_id IN (
      SELECT id FROM agreements WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role full access to signature events"
  ON agreement_signature_events
  FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger to auto-update updated_at on agreement_signatures
CREATE OR REPLACE FUNCTION update_agreement_signatures_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_agreement_signatures_updated_at
  BEFORE UPDATE ON agreement_signatures
  FOR EACH ROW
  EXECUTE FUNCTION update_agreement_signatures_updated_at();
