-- Create landlord_references table
CREATE TABLE IF NOT EXISTS landlord_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

    -- Landlord Information
    landlord_name TEXT NOT NULL,
    landlord_email TEXT NOT NULL,
    landlord_phone TEXT NOT NULL,

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

-- Create employer_references table
CREATE TABLE IF NOT EXISTS employer_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,

    -- Employer/Company Information
    company_name TEXT NOT NULL,
    employer_name TEXT NOT NULL,
    employer_position TEXT NOT NULL,
    employer_email TEXT NOT NULL,
    employer_phone TEXT NOT NULL,

    -- Employment Information
    employee_position TEXT NOT NULL,
    employment_type TEXT NOT NULL,
    employment_start_date DATE NOT NULL,
    employment_end_date DATE,
    is_current_employee BOOLEAN DEFAULT true,

    -- Salary Information
    annual_salary DECIMAL(10, 2) NOT NULL,
    salary_frequency TEXT NOT NULL,
    is_probation TEXT NOT NULL,
    probation_end_date DATE,

    -- Reference Questions
    employment_status TEXT NOT NULL,
    performance_rating TEXT NOT NULL,
    performance_details TEXT,
    disciplinary_issues TEXT NOT NULL,
    disciplinary_details TEXT,
    absence_record TEXT NOT NULL,
    absence_details TEXT,
    would_reemploy TEXT NOT NULL,
    would_reemploy_details TEXT,

    -- Additional Information
    additional_comments TEXT,

    -- Signature
    signature TEXT NOT NULL,
    date DATE NOT NULL,

    -- Timestamps
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_landlord_references_reference_id ON landlord_references(reference_id);
CREATE INDEX idx_employer_references_reference_id ON employer_references(reference_id);

-- Enable Row Level Security
ALTER TABLE landlord_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE employer_references ENABLE ROW LEVEL SECURITY;

-- RLS Policies for landlord_references
-- Allow anyone to insert (public submission)
CREATE POLICY "Allow public insert on landlord_references"
    ON landlord_references
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow company members to read their references
CREATE POLICY "Allow company members to read landlord_references"
    ON landlord_references
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

-- RLS Policies for employer_references
-- Allow anyone to insert (public submission)
CREATE POLICY "Allow public insert on employer_references"
    ON employer_references
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow company members to read their references
CREATE POLICY "Allow company members to read employer_references"
    ON employer_references
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
