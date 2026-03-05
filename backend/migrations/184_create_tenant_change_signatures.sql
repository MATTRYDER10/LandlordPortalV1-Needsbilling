-- Migration 184: Create Tenant Change Signatures Table
-- Tracks addendum signatures for Change of Tenant workflow (reuses pattern from agreement_signatures)

CREATE TABLE IF NOT EXISTS tenant_change_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_change_id UUID NOT NULL REFERENCES tenant_changes(id) ON DELETE CASCADE,

  -- Signer identification
  signer_type TEXT NOT NULL CHECK (signer_type IN ('outgoing_tenant', 'incoming_tenant', 'remaining_tenant', 'landlord_agent')),
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

  -- Audit trail for legal validity
  ip_address INET,
  user_agent TEXT,
  geolocation JSONB, -- {latitude, longitude, accuracy, city, country}
  signed_at TIMESTAMP WITH TIME ZONE,

  -- Email tracking
  last_email_sent_at TIMESTAMP WITH TIME ZONE,
  email_send_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique signer per tenant change
  CONSTRAINT unique_signer_per_tenant_change UNIQUE (tenant_change_id, signer_type, signer_index)
);

-- Audit log for signature events
CREATE TABLE IF NOT EXISTS tenant_change_signature_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_id UUID NOT NULL REFERENCES tenant_change_signatures(id) ON DELETE CASCADE,
  tenant_change_id UUID NOT NULL REFERENCES tenant_changes(id) ON DELETE CASCADE,

  -- Event type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',             -- Signature record created
    'email_sent',          -- Signing request email sent
    'email_opened',        -- Email opened (if tracking pixel used)
    'link_clicked',        -- Signing link was clicked
    'document_viewed',     -- Document was viewed
    'signature_started',   -- User started drawing/typing signature
    'signature_completed', -- Signature submitted successfully
    'signature_declined',  -- User declined to sign
    'reminder_sent',       -- Reminder email sent
    'token_expired',       -- Token expired without signing
    'token_regenerated'    -- New token generated (e.g., after expiry)
  )),

  -- Event context
  ip_address INET,
  user_agent TEXT,
  geolocation JSONB,
  metadata JSONB DEFAULT '{}', -- Additional event-specific data

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tc_sigs_tenant_change ON tenant_change_signatures(tenant_change_id);
CREATE INDEX IF NOT EXISTS idx_tc_sigs_token ON tenant_change_signatures(signing_token);
CREATE INDEX IF NOT EXISTS idx_tc_sigs_status ON tenant_change_signatures(status);
CREATE INDEX IF NOT EXISTS idx_tc_sigs_email ON tenant_change_signatures(signer_email);
CREATE INDEX IF NOT EXISTS idx_tc_sig_events_signature ON tenant_change_signature_events(signature_id);
CREATE INDEX IF NOT EXISTS idx_tc_sig_events_tenant_change ON tenant_change_signature_events(tenant_change_id);

-- Enable Row Level Security
ALTER TABLE tenant_change_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_change_signature_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenant_change_signatures
CREATE POLICY "Companies can view own tenant change signatures"
  ON tenant_change_signatures FOR SELECT
  USING (
    tenant_change_id IN (
      SELECT id FROM tenant_changes WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role full access to tenant_change_signatures"
  ON tenant_change_signatures FOR ALL
  USING (auth.role() = 'service_role');

-- RLS Policies for tenant_change_signature_events
CREATE POLICY "Companies can view own tenant change signature events"
  ON tenant_change_signature_events FOR SELECT
  USING (
    tenant_change_id IN (
      SELECT id FROM tenant_changes WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service role full access to tenant_change_signature_events"
  ON tenant_change_signature_events FOR ALL
  USING (auth.role() = 'service_role');

-- Add comments
COMMENT ON TABLE tenant_change_signatures IS 'Tracks individual signature status for Change of Tenant addendum documents';
COMMENT ON TABLE tenant_change_signature_events IS 'Audit log for all signature-related events in Change of Tenant workflow';
