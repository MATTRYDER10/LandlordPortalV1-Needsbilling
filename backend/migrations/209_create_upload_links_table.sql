CREATE TABLE IF NOT EXISTS upload_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL REFERENCES tenant_references_v2(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  section TEXT NOT NULL,
  field TEXT NOT NULL,
  document_name TEXT NOT NULL,
  uploaded_file_path TEXT,
  uploaded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_upload_links_reference ON upload_links(reference_id);
CREATE INDEX idx_upload_links_token ON upload_links(token_hash);
CREATE INDEX idx_upload_links_expires ON upload_links(expires_at);
