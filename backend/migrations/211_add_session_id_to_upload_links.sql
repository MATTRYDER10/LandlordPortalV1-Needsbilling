ALTER TABLE upload_links ADD COLUMN IF NOT EXISTS session_id UUID;
CREATE INDEX IF NOT EXISTS idx_upload_links_session ON upload_links(session_id);
