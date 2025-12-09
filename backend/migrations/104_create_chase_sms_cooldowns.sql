-- Create chase_sms_cooldowns table to track when SMS was last sent to a contact
-- Used to hide contacts from chase list for 12 hours after SMS is sent

CREATE TABLE IF NOT EXISTS chase_sms_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
  contact_type VARCHAR(50) NOT NULL, -- 'Guarantor', 'Landlord', 'Agent', 'Employer', 'Accountant'
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint to allow upsert on reference_id + contact_type
  UNIQUE(reference_id, contact_type)
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_chase_sms_cooldowns_lookup
  ON chase_sms_cooldowns(reference_id, contact_type, sent_at);

-- Enable RLS
ALTER TABLE chase_sms_cooldowns ENABLE ROW LEVEL SECURITY;

-- Policy to allow service role full access
CREATE POLICY "Service role has full access to chase_sms_cooldowns"
  ON chase_sms_cooldowns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
