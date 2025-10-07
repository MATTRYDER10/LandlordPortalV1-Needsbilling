-- Add signature_name column to agent_references
ALTER TABLE agent_references
ADD COLUMN signature_name TEXT;
