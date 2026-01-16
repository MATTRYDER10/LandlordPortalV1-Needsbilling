-- Add encrypted clarification_details column to employer_references
-- This column was referenced in code but never added to the schema
ALTER TABLE employer_references
ADD COLUMN IF NOT EXISTS clarification_details_encrypted TEXT;
