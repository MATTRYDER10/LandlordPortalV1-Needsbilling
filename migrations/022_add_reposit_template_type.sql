-- Add 'reposit' to the agreement_template_type enum

-- First, add the new value to the enum
ALTER TYPE agreement_template_type ADD VALUE IF NOT EXISTS 'reposit';
