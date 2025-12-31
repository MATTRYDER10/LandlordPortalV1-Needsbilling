-- Migration 128: Create Properties Module Tables
-- This migration creates the complete properties module schema including:
-- - properties (core entity)
-- - property_landlords (many-to-many with ownership %)
-- - compliance_records (Gas, EICR, EPC, etc.)
-- - compliance_documents (history of certificates)
-- - property_documents (documents linked to properties)
-- - compliance_overrides (audit trail for agreement overrides)
-- - property_reminders (compliance expiry reminders)
-- - notification_queue (in-app notifications)

-- ============================================================================
-- PROPERTIES TABLE
-- Core property entity with address encryption and company-based multi-tenancy
-- ============================================================================
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Address (encrypted) - supports both full address OR split fields
  full_address_encrypted TEXT,
  address_line1_encrypted TEXT,
  address_line2_encrypted TEXT,
  city_encrypted TEXT,
  county_encrypted TEXT,
  postcode TEXT NOT NULL, -- NOT encrypted - needed for search/validation
  country TEXT DEFAULT 'GB',

  -- Property Details
  property_type TEXT, -- 'flat', 'house', 'bungalow', 'studio', 'hmo', 'commercial', 'other'
  number_of_bedrooms INTEGER,
  number_of_bathrooms INTEGER,
  furnishing_status TEXT, -- 'furnished', 'unfurnished', 'part_furnished'

  -- Status
  status TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN ('vacant', 'in_tenancy')),
  status_override BOOLEAN DEFAULT FALSE,
  status_override_reason TEXT,
  status_override_by UUID REFERENCES auth.users(id),
  status_override_at TIMESTAMP WITH TIME ZONE,

  -- Licensing
  is_licensed BOOLEAN DEFAULT FALSE,
  license_number TEXT,
  license_expiry_date DATE,
  license_authority TEXT,

  -- Notes
  notes_encrypted TEXT,

  -- Soft delete
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by UUID REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes for properties
CREATE INDEX IF NOT EXISTS idx_properties_company_id ON properties(company_id);
CREATE INDEX IF NOT EXISTS idx_properties_postcode ON properties(postcode);
CREATE INDEX IF NOT EXISTS idx_properties_postcode_pattern ON properties(postcode text_pattern_ops);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_not_deleted ON properties(company_id) WHERE deleted_at IS NULL;

-- Enable RLS
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

-- RLS Policies for properties
DROP POLICY IF EXISTS "Company members can view their properties" ON properties;
CREATE POLICY "Company members can view their properties"
  ON properties FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can create properties" ON properties;
CREATE POLICY "Company members can create properties"
  ON properties FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can update properties" ON properties;
CREATE POLICY "Company members can update properties"
  ON properties FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can delete properties" ON properties;
CREATE POLICY "Company members can delete properties"
  ON properties FOR DELETE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Updated at trigger for properties
DROP TRIGGER IF EXISTS update_properties_updated_at ON properties;
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PROPERTY_LANDLORDS TABLE (Many-to-Many Join)
-- Links properties to landlords with ownership percentage
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_landlords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES landlords(id) ON DELETE CASCADE,

  -- Ownership
  ownership_percentage DECIMAL(5, 2) NOT NULL DEFAULT 100.00
    CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  is_primary_contact BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- One landlord per property
  CONSTRAINT unique_property_landlord UNIQUE (property_id, landlord_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_landlords_property_id ON property_landlords(property_id);
CREATE INDEX IF NOT EXISTS idx_property_landlords_landlord_id ON property_landlords(landlord_id);

-- Enable RLS
ALTER TABLE property_landlords ENABLE ROW LEVEL SECURITY;

-- RLS Policy (inherit from property)
DROP POLICY IF EXISTS "Company members can manage property landlords" ON property_landlords;
CREATE POLICY "Company members can manage property landlords"
  ON property_landlords FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- Updated at trigger
DROP TRIGGER IF EXISTS update_property_landlords_updated_at ON property_landlords;
CREATE TRIGGER update_property_landlords_updated_at
  BEFORE UPDATE ON property_landlords
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLIANCE_RECORDS TABLE
-- Tracks compliance certificates (Gas Safety, EICR, EPC, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Compliance Details
  compliance_type TEXT NOT NULL CHECK (compliance_type IN (
    'gas_safety', 'eicr', 'epc', 'council_licence', 'pat_test',
    'legionella', 'fire_safety', 'hmo_licence', 'other'
  )),
  custom_type_name TEXT, -- For 'other' type

  -- Dates
  issue_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  expiry_date_overridden BOOLEAN DEFAULT FALSE,

  -- Certificate Details
  certificate_number TEXT,
  issuer_name TEXT,
  issuer_company TEXT,

  -- Status (auto-derived via trigger)
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'expiring_soon', 'expired', 'not_required')),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_records_property_id ON compliance_records(property_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_company_id ON compliance_records(company_id);
CREATE INDEX IF NOT EXISTS idx_compliance_records_type ON compliance_records(compliance_type);
CREATE INDEX IF NOT EXISTS idx_compliance_records_expiry_date ON compliance_records(expiry_date);
CREATE INDEX IF NOT EXISTS idx_compliance_records_status ON compliance_records(status);
CREATE INDEX IF NOT EXISTS idx_compliance_records_expired ON compliance_records(company_id, status) WHERE status = 'expired';
-- Index for finding records expiring soon (query will filter by date)
CREATE INDEX IF NOT EXISTS idx_compliance_records_expiring ON compliance_records(company_id, expiry_date);

-- Enable RLS
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Company members can manage compliance records" ON compliance_records;
CREATE POLICY "Company members can manage compliance records"
  ON compliance_records FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Function to auto-update compliance status based on expiry date
CREATE OR REPLACE FUNCTION update_compliance_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  ELSIF NEW.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'expiring_soon';
  ELSE
    NEW.status := 'valid';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update compliance status
DROP TRIGGER IF EXISTS trigger_update_compliance_status ON compliance_records;
CREATE TRIGGER trigger_update_compliance_status
  BEFORE INSERT OR UPDATE OF expiry_date ON compliance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_compliance_status();

-- Updated at trigger
DROP TRIGGER IF EXISTS update_compliance_records_updated_at ON compliance_records;
CREATE TRIGGER update_compliance_records_updated_at
  BEFORE UPDATE ON compliance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMPLIANCE_DOCUMENTS TABLE
-- Documents attached to compliance records (preserves history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_record_id UUID NOT NULL REFERENCES compliance_records(id) ON DELETE CASCADE,

  -- Document Details
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT, -- MIME type

  -- Version tracking
  version INTEGER DEFAULT 1,
  is_current BOOLEAN DEFAULT TRUE,

  -- Metadata
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_documents_record_id ON compliance_documents(compliance_record_id);
CREATE INDEX IF NOT EXISTS idx_compliance_documents_current ON compliance_documents(compliance_record_id) WHERE is_current = TRUE;

-- Enable RLS
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy (inherit from compliance_record -> property)
DROP POLICY IF EXISTS "Company members can manage compliance documents" ON compliance_documents;
CREATE POLICY "Company members can manage compliance documents"
  ON compliance_documents FOR ALL TO authenticated
  USING (
    compliance_record_id IN (
      SELECT id FROM compliance_records WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- PROPERTY_DOCUMENTS TABLE
-- Documents linked to properties with tagging
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,

  -- Document Details
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT, -- MIME type

  -- Tagging
  tag TEXT NOT NULL DEFAULT 'other' CHECK (tag IN ('gas', 'epc', 'agreement', 'reference', 'inventory', 'insurance', 'other')),
  custom_tag_name TEXT,

  -- Source tracking
  source_type TEXT CHECK (source_type IN ('direct_upload', 'tenancy', 'reference', 'compliance')),
  source_id UUID,

  -- Metadata
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  description TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_documents_property_id ON property_documents(property_id);
CREATE INDEX IF NOT EXISTS idx_property_documents_tag ON property_documents(tag);
CREATE INDEX IF NOT EXISTS idx_property_documents_source ON property_documents(source_type, source_id);

-- Enable RLS
ALTER TABLE property_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policy (inherit from property)
DROP POLICY IF EXISTS "Company members can manage property documents" ON property_documents;
CREATE POLICY "Company members can manage property documents"
  ON property_documents FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- PROPERTY_TENANCIES TABLE
-- Links properties to tenant_references (tenancies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

  -- Tenancy status relative to property
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  linked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Unique constraint
  CONSTRAINT unique_property_tenancy UNIQUE (property_id, reference_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_tenancies_property_id ON property_tenancies(property_id);
CREATE INDEX IF NOT EXISTS idx_property_tenancies_reference_id ON property_tenancies(reference_id);
CREATE INDEX IF NOT EXISTS idx_property_tenancies_active ON property_tenancies(property_id) WHERE is_active = TRUE;

-- Enable RLS
ALTER TABLE property_tenancies ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Company members can manage property tenancies" ON property_tenancies;
CREATE POLICY "Company members can manage property tenancies"
  ON property_tenancies FOR ALL TO authenticated
  USING (
    property_id IN (
      SELECT id FROM properties WHERE company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- COMPLIANCE_OVERRIDES TABLE
-- Records when agreements are created with expired compliance
-- ============================================================================
CREATE TABLE IF NOT EXISTS compliance_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  tenancy_id UUID REFERENCES tenant_references(id) ON DELETE SET NULL,
  agreement_id UUID REFERENCES agreements(id) ON DELETE SET NULL,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Override Details
  compliance_type TEXT NOT NULL,
  compliance_record_id UUID REFERENCES compliance_records(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,

  -- Audit
  overridden_by UUID NOT NULL REFERENCES auth.users(id),
  overridden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Additional context
  was_expired BOOLEAN DEFAULT TRUE,
  expiry_date DATE,
  days_expired INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_property_id ON compliance_overrides(property_id);
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_tenancy_id ON compliance_overrides(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_agreement_id ON compliance_overrides(agreement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_overrides_company_id ON compliance_overrides(company_id);

-- Enable RLS
ALTER TABLE compliance_overrides ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Company members can view compliance overrides" ON compliance_overrides;
CREATE POLICY "Company members can view compliance overrides"
  ON compliance_overrides FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can create compliance overrides" ON compliance_overrides;
CREATE POLICY "Company members can create compliance overrides"
  ON compliance_overrides FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- PROPERTY_REMINDERS TABLE
-- Compliance expiry reminders
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  compliance_record_id UUID REFERENCES compliance_records(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Reminder Details
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('30_days_before', '14_days_before', '7_days_before', 'on_expiry', 'custom')),
  custom_days_before INTEGER,
  due_date DATE NOT NULL,

  -- Recipients (encrypted JSON array)
  recipients_encrypted TEXT,

  -- Status
  sent_at TIMESTAMP WITH TIME ZONE,
  send_failed BOOLEAN DEFAULT FALSE,
  send_error TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_reminders_property_id ON property_reminders(property_id);
CREATE INDEX IF NOT EXISTS idx_property_reminders_compliance_id ON property_reminders(compliance_record_id);
CREATE INDEX IF NOT EXISTS idx_property_reminders_due_date ON property_reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_property_reminders_pending ON property_reminders(due_date) WHERE sent_at IS NULL;

-- Enable RLS
ALTER TABLE property_reminders ENABLE ROW LEVEL SECURITY;

-- RLS Policy
DROP POLICY IF EXISTS "Company members can manage property reminders" ON property_reminders;
CREATE POLICY "Company members can manage property reminders"
  ON property_reminders FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- NOTIFICATION_QUEUE TABLE
-- In-app notifications for compliance and other alerts
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- What triggered this notification
  notification_type TEXT NOT NULL, -- 'COMPLIANCE_EXPIRING', 'COMPLIANCE_EXPIRED', etc.
  resource_type TEXT NOT NULL, -- 'property', 'compliance_record'
  resource_id UUID NOT NULL,

  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'URGENT')),

  -- Delivery tracking
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  in_app_created BOOLEAN DEFAULT TRUE,

  -- User interaction
  read_by UUID[] DEFAULT '{}',
  dismissed_by UUID[] DEFAULT '{}',
  actioned_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notification_queue_company ON notification_queue(company_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type ON notification_queue(notification_type);
-- Index for fetching notifications by company (filtering done in query)
CREATE INDEX IF NOT EXISTS idx_notification_queue_unread ON notification_queue(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_resource ON notification_queue(resource_type, resource_id);

-- Enable RLS
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Company members can view notifications" ON notification_queue;
CREATE POLICY "Company members can view notifications"
  ON notification_queue FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Company members can update notifications" ON notification_queue;
CREATE POLICY "Company members can update notifications"
  ON notification_queue FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can create notifications" ON notification_queue;
CREATE POLICY "System can create notifications"
  ON notification_queue FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- PROPERTY_AUDIT_LOG TABLE
-- Audit trail for property actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS property_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Action Details
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Audit
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_property_audit_log_property_id ON property_audit_log(property_id);
CREATE INDEX IF NOT EXISTS idx_property_audit_log_company_id ON property_audit_log(company_id);
CREATE INDEX IF NOT EXISTS idx_property_audit_log_action ON property_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_property_audit_log_created_at ON property_audit_log(created_at DESC);

-- Enable RLS
ALTER TABLE property_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Company members can view property audit logs" ON property_audit_log;
CREATE POLICY "Company members can view property audit logs"
  ON property_audit_log FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "System can insert property audit logs" ON property_audit_log;
CREATE POLICY "System can insert property audit logs"
  ON property_audit_log FOR INSERT TO authenticated
  WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate default expiry date based on compliance type
CREATE OR REPLACE FUNCTION calculate_compliance_expiry(
  p_compliance_type TEXT,
  p_issue_date DATE
) RETURNS DATE AS $$
BEGIN
  CASE p_compliance_type
    WHEN 'gas_safety' THEN RETURN p_issue_date + INTERVAL '1 year';
    WHEN 'eicr' THEN RETURN p_issue_date + INTERVAL '5 years';
    WHEN 'epc' THEN RETURN p_issue_date + INTERVAL '10 years';
    WHEN 'pat_test' THEN RETURN p_issue_date + INTERVAL '1 year';
    WHEN 'legionella' THEN RETURN p_issue_date + INTERVAL '2 years';
    ELSE RETURN p_issue_date + INTERVAL '1 year';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to check if ownership percentages exceed 100%
CREATE OR REPLACE FUNCTION check_ownership_percentage()
RETURNS TRIGGER AS $$
DECLARE
  v_total_percentage DECIMAL(5, 2);
BEGIN
  SELECT COALESCE(SUM(ownership_percentage), 0)
  INTO v_total_percentage
  FROM property_landlords
  WHERE property_id = NEW.property_id
  AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

  v_total_percentage := v_total_percentage + NEW.ownership_percentage;

  IF v_total_percentage > 100.00 THEN
    RAISE EXCEPTION 'Total ownership percentage cannot exceed 100%%. Current total would be: %', v_total_percentage;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for ownership percentage validation
DROP TRIGGER IF EXISTS trigger_check_ownership_percentage ON property_landlords;
CREATE TRIGGER trigger_check_ownership_percentage
  BEFORE INSERT OR UPDATE ON property_landlords
  FOR EACH ROW
  EXECUTE FUNCTION check_ownership_percentage();

-- ============================================================================
-- STORAGE BUCKET FOR PROPERTY DOCUMENTS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-documents',
  'property-documents',
  false,
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Users can upload property documents" ON storage.objects;
CREATE POLICY "Users can upload property documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-documents' AND
  auth.uid() IN (SELECT user_id FROM company_users)
);

DROP POLICY IF EXISTS "Users can view property documents" ON storage.objects;
CREATE POLICY "Users can view property documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'property-documents' AND
  auth.uid() IN (SELECT user_id FROM company_users)
);

DROP POLICY IF EXISTS "Users can delete property documents" ON storage.objects;
CREATE POLICY "Users can delete property documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-documents' AND
  auth.uid() IN (SELECT user_id FROM company_users)
);

-- ============================================================================
-- ADD linked_property_id TO TENANT_REFERENCES (for optional property linking)
-- ============================================================================
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS linked_property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_references_linked_property ON tenant_references(linked_property_id)
  WHERE linked_property_id IS NOT NULL;

COMMENT ON COLUMN tenant_references.linked_property_id IS 'Optional link to a property record for pre-filling address data';

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE properties IS 'Core property entity for the Properties module';
COMMENT ON TABLE property_landlords IS 'Links properties to landlords with ownership percentage';
COMMENT ON TABLE compliance_records IS 'Tracks compliance certificates (Gas Safety, EICR, EPC, etc.)';
COMMENT ON TABLE compliance_documents IS 'Documents attached to compliance records with version history';
COMMENT ON TABLE property_documents IS 'Documents linked to properties with tagging';
COMMENT ON TABLE property_tenancies IS 'Links properties to tenant references/tenancies';
COMMENT ON TABLE compliance_overrides IS 'Audit trail for agreement creation with expired compliance';
COMMENT ON TABLE property_reminders IS 'Scheduled compliance expiry reminders';
COMMENT ON TABLE notification_queue IS 'In-app notifications for compliance and other alerts';
COMMENT ON TABLE property_audit_log IS 'Audit trail for all property-related actions';
