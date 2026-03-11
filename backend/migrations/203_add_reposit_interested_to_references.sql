ALTER TABLE tenant_references_v2
ADD COLUMN IF NOT EXISTS reposit_interested BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN tenant_references_v2.reposit_interested IS 'True if tenant expressed interest in Reposit when it was not offered via offer stage';
