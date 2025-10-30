-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create enum for agreement template types
CREATE TYPE agreement_template_type AS ENUM ('dps', 'mydeposits', 'tds', 'no_deposit');

-- Create agreements table
CREATE TABLE agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID REFERENCES tenant_references(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

    -- Template selection
    template_type agreement_template_type NOT NULL,

    -- Property details
    property_address JSONB NOT NULL,

    -- Parties (stored as JSONB arrays, each can have up to 20 entries)
    landlords JSONB NOT NULL DEFAULT '[]'::jsonb,
    tenants JSONB NOT NULL DEFAULT '[]'::jsonb,
    guarantors JSONB NOT NULL DEFAULT '[]'::jsonb,

    -- Additional agreement details
    deposit_amount DECIMAL(10, 2),
    rent_amount DECIMAL(10, 2),
    tenancy_start_date DATE,
    tenancy_end_date DATE,

    -- Generated PDF
    pdf_url TEXT,
    pdf_generated_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_agreements_reference_id ON agreements(reference_id);
CREATE INDEX idx_agreements_company_id ON agreements(company_id);
CREATE INDEX idx_agreements_created_at ON agreements(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE agreements ENABLE ROW LEVEL SECURITY;

-- Users can view agreements from their company
CREATE POLICY "Users can view their company's agreements"
    ON agreements FOR SELECT
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

-- Users can create agreements for their company
CREATE POLICY "Users can create agreements for their company"
    ON agreements FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

-- Users can update their company's agreements
CREATE POLICY "Users can update their company's agreements"
    ON agreements FOR UPDATE
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

-- Users can delete their company's agreements
CREATE POLICY "Users can delete their company's agreements"
    ON agreements FOR DELETE
    USING (company_id IN (
        SELECT company_id FROM company_users WHERE user_id = auth.uid()
    ));

-- Add updated_at trigger
CREATE TRIGGER update_agreements_updated_at
    BEFORE UPDATE ON agreements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
