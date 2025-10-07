-- PropertyGoose Multi-Tenancy Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies Table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  postcode TEXT,
  phone TEXT,
  website TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#FF8C41',
  button_color TEXT DEFAULT '#FF8C41',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Roles Enum
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member');

-- Company Users Junction Table (links auth.users to companies with roles)
CREATE TABLE company_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, user_id)
);

-- Invitations Table
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, expired
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_company_users_company_id ON company_users(company_id);
CREATE INDEX idx_company_users_user_id ON company_users(user_id);
CREATE INDEX idx_invitations_company_id ON invitations(company_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);

-- Row Level Security (RLS) Policies

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Companies: Users can only see companies they belong to
CREATE POLICY "Users can view their companies" ON companies
  FOR SELECT USING (
    id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Companies: Owners and admins can update their company
CREATE POLICY "Owners and admins can update company" ON companies
  FOR UPDATE USING (
    id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Companies: Allow company creation on signup (used by trigger)
CREATE POLICY "Allow company creation on signup" ON companies
  FOR INSERT
  WITH CHECK (true);

-- Company Users: Users can see members of their companies
CREATE POLICY "Users can view company members" ON company_users
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Company Users: Owners and admins can manage members
CREATE POLICY "Owners and admins can manage members" ON company_users
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Company Users: Allow insert on signup (used by trigger)
CREATE POLICY "Allow insert on signup" ON company_users
  FOR INSERT
  WITH CHECK (true);

-- Invitations: Users can see invitations for their companies
CREATE POLICY "Users can view company invitations" ON invitations
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_users WHERE user_id = auth.uid()
    )
  );

-- Invitations: Owners and admins can create invitations
CREATE POLICY "Owners and admins can create invitations" ON invitations
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Function to automatically create company and assign owner role on user signup
-- NOTE: If user is accepting an invitation (is_invited metadata = true), skip company creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  is_invited BOOLEAN;
  new_company_id UUID;
BEGIN
  -- Check if user is accepting an invitation (via metadata)
  is_invited := COALESCE((NEW.raw_user_meta_data->>'is_invited')::boolean, false);

  -- Only create a company if user is NOT accepting an invitation
  IF NOT is_invited THEN
    -- Create a new company with the company name from user metadata
    INSERT INTO public.companies (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'))
    RETURNING id INTO new_company_id;

    -- Link the user to the company as owner
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (new_company_id, NEW.id, 'owner');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Trigger to run the function on new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to get user's current company and role
CREATE OR REPLACE FUNCTION get_user_company()
RETURNS TABLE (
  company_id UUID,
  company_name TEXT,
  user_role user_role
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    cu.role
  FROM companies c
  JOIN company_users cu ON c.id = cu.company_id
  WHERE cu.user_id = auth.uid()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
