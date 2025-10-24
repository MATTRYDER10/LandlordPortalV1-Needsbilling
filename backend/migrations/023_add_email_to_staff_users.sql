-- Add email column to staff_users table if it doesn't exist
ALTER TABLE staff_users
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add unique constraint on email if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'staff_users_email_key'
    ) THEN
        ALTER TABLE staff_users ADD CONSTRAINT staff_users_email_key UNIQUE (email);
    END IF;
END $$;

-- Create index on email if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_staff_users_email ON staff_users(email);
