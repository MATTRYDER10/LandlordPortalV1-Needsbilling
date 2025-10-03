-- Staff System Migration - PART 2
-- Run this AFTER Part 1 has been successfully executed

-- 2. Create staff_users table
CREATE TABLE IF NOT EXISTS staff_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  full_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add verification fields to tenant_references
ALTER TABLE tenant_references
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES staff_users(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS verification_notes TEXT;

-- 4. Create indexes for staff system
CREATE INDEX IF NOT EXISTS idx_staff_users_user_id ON staff_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_references_verified_by ON tenant_references(verified_by);
CREATE INDEX IF NOT EXISTS idx_tenant_references_status_pending_verification 
  ON tenant_references(status) WHERE status = 'pending_verification';

-- 5. Enable RLS on staff_users table
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for staff_users (staff can view other staff members)
CREATE POLICY "Staff can view all staff members" ON staff_users
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM staff_users WHERE is_active = true)
  );

-- 7. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_staff_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER staff_users_updated_at
  BEFORE UPDATE ON staff_users
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_users_updated_at();

-- Note: After running this migration, you'll need to manually insert staff users
-- Example:
-- INSERT INTO staff_users (user_id, full_name) 
-- VALUES ('<user_id_from_auth_users>', 'Staff Member Name');
