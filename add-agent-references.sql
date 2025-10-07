-- Create agent_references table
CREATE TABLE IF NOT EXISTS agent_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

    -- Agent Information
    agent_name TEXT NOT NULL,
    agent_email TEXT NOT NULL,
    agent_phone TEXT NOT NULL,
    agency_name TEXT,

    -- Property & Tenancy Information
    property_address TEXT NOT NULL,
    property_city TEXT,
    property_postcode TEXT,
    tenancy_start_date DATE NOT NULL,
    tenancy_end_date DATE NOT NULL,
    monthly_rent DECIMAL(10, 2) NOT NULL,

    -- Reference Questions
    rent_paid_on_time TEXT NOT NULL,
    rent_paid_on_time_details TEXT,
    property_condition TEXT NOT NULL,
    property_condition_details TEXT,
    neighbour_complaints TEXT NOT NULL,
    neighbour_complaints_details TEXT,
    breach_of_tenancy TEXT NOT NULL,
    breach_of_tenancy_details TEXT,
    would_rent_again TEXT NOT NULL,
    would_rent_again_details TEXT,

    -- Additional Information
    additional_comments TEXT,

    -- Signature
    signature TEXT NOT NULL,
    date DATE NOT NULL,

    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for better query performance
CREATE INDEX idx_agent_references_reference_id ON agent_references(reference_id);

-- Enable Row Level Security
ALTER TABLE agent_references ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_references
-- Allow anyone to insert (public submission)
CREATE POLICY "Allow public insert on agent_references"
    ON agent_references
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow company members to read their references
CREATE POLICY "Allow company members to read agent_references"
    ON agent_references
    FOR SELECT
    TO authenticated
    USING (
        reference_id IN (
            SELECT tr.id
            FROM tenant_references tr
            INNER JOIN company_users cu ON cu.company_id = tr.company_id
            WHERE cu.user_id = auth.uid()
        )
    );

-- Add reference_type column to tenant_references table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name='tenant_references' AND column_name='reference_type') THEN
        ALTER TABLE tenant_references ADD COLUMN reference_type TEXT DEFAULT 'landlord';
    END IF;
END $$;
