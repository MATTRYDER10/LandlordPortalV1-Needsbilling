-- Migration: Add agent_signs_on_behalf to agreements
-- Description: Adds a boolean flag to indicate whether the agent signs on behalf of the landlord
--              for managed properties. When true, no landlord signature record is created.
-- Date: 2026-01-10

-- Add the agent_signs_on_behalf column
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS agent_signs_on_behalf BOOLEAN DEFAULT false;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN agreements.agent_signs_on_behalf IS
'Indicates whether agent signs on behalf of landlord for managed properties. When true, no landlord signature record is created. Only applicable to managed properties.';

-- Create index for filtering by this field
CREATE INDEX IF NOT EXISTS idx_agreements_agent_signs_on_behalf
ON agreements(agent_signs_on_behalf)
WHERE agent_signs_on_behalf = true;

-- Add created_by_user_id column to track which user created the agreement (for identifying agent email)
ALTER TABLE agreements
ADD COLUMN IF NOT EXISTS created_by_user_id UUID;

-- Add foreign key to users table
ALTER TABLE agreements
ADD CONSTRAINT fk_agreements_created_by_user
FOREIGN KEY (created_by_user_id)
REFERENCES auth.users(id)
ON DELETE SET NULL;

COMMENT ON COLUMN agreements.created_by_user_id IS
'ID of the user who created the agreement. Used to identify agent email for managed properties.';

-- Create index for filtering by creator
CREATE INDEX IF NOT EXISTS idx_agreements_created_by_user
ON agreements(created_by_user_id)
WHERE created_by_user_id IS NOT NULL;
