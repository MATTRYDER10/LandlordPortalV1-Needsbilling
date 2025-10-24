-- Create staff_users table for managing staff access to the staff portal
-- Staff users must also exist in auth.users (Supabase authentication)

CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_users_user_id ON staff_users(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users(email);
CREATE INDEX IF NOT EXISTS idx_staff_users_is_active ON staff_users(is_active);

-- Add comment to explain the table
COMMENT ON TABLE staff_users IS 'Stores staff members who have access to the staff verification portal. Staff users must also exist in auth.users.';

-- Add comments for key fields
COMMENT ON COLUMN staff_users.user_id IS 'References the Supabase auth.users.id - staff must authenticate through Supabase';
COMMENT ON COLUMN staff_users.is_active IS 'Whether this staff member is currently active and can access the staff portal';
