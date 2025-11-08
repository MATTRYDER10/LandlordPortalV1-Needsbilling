import { config } from 'dotenv';

// Load environment variables from .env file for testing
config();

// Ensure required environment variables are set
if (!process.env.ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY environment variable is required for tests');
}

if (!process.env.SUPABASE_URL) {
  throw new Error('SUPABASE_URL environment variable is required for tests');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Supabase service key is required for tests. Set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_SERVICE_KEY.'
  );
}
