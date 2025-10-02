-- Fix for signup 500 error
-- The handle_new_user() function had a bug that prevented user signups
-- Run this in Supabase SQL Editor to fix the issue

-- Drop the existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create the corrected function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- Create a new company with the company name from user metadata
  INSERT INTO companies (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'))
  RETURNING id INTO new_company_id;

  -- Link the user to the company as owner
  INSERT INTO company_users (company_id, user_id, role)
  VALUES (
    new_company_id,
    NEW.id,
    'owner'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
