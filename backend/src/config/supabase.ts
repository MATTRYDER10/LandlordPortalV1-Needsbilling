import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

// Get Supabase credentials from environment variables
// Fallback to hardcoded values for backward compatibility (should be removed in production)
const supabaseUrl = process.env.SUPABASE_URL || "https://spaetpdmlqfygsxiawul.supabase.co"
const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwYWV0cGRtbHFmeWdzeGlhd3VsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxMjU5NywiZXhwIjoyMDc0OTg4NTk3fQ.x9PyOkUKpj440Qs6DmfP_VMJXJvNKAG4chZOfDPeyRQ"

if (!supabaseUrl) {
    throw new Error(
        'SUPABASE_URL environment variable is required. Please set it in your backend .env file.'
    )
}

if (!supabaseServiceKey) {
    throw new Error(
        'Supabase service key is required. Set SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_SERVICE_KEY in your backend .env file.'
    )
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey)
