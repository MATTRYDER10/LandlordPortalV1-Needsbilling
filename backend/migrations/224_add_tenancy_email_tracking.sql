ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS html_body TEXT;
ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS email_category TEXT;
ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS tenancy_id UUID REFERENCES tenancies(id) ON DELETE SET NULL;
ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS attachment_names TEXT[];

CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_tenancy_id ON email_delivery_logs(tenancy_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_company_id ON email_delivery_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_category ON email_delivery_logs(email_category);

CREATE POLICY "Company members can read their email logs"
  ON email_delivery_logs
  FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

UPDATE email_delivery_logs edl
SET tenancy_id = tt.tenancy_id
FROM tenancy_tenants tt
WHERE edl.reference_id = tt.reference_id
  AND edl.tenancy_id IS NULL
  AND tt.reference_id IS NOT NULL;

UPDATE email_delivery_logs edl
SET tenancy_id = tt.tenancy_id
FROM tenancy_tenants tt
WHERE edl.reference_id = tt.guarantor_reference_id
  AND edl.tenancy_id IS NULL
  AND tt.guarantor_reference_id IS NOT NULL;

UPDATE email_delivery_logs edl
SET company_id = tr.company_id
FROM tenant_references tr
WHERE edl.reference_id = tr.id
  AND edl.company_id IS NULL;
