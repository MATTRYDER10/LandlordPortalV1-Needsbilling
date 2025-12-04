-- Add admin role to staff_users table
ALTER TABLE staff_users
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add comment to explain the column
COMMENT ON COLUMN staff_users.is_admin IS 'Indicates if the staff user has admin privileges for managing the platform';

-- Create index for faster admin queries
CREATE INDEX IF NOT EXISTS idx_staff_users_is_admin ON staff_users(is_admin) WHERE is_admin = true;
