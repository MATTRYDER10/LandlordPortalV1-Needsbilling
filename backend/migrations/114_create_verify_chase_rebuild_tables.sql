-- Migration 114: Create tables for Verify/Chase system rebuild
-- Creates: work_item_locks, chase_dependencies, verification_sections, action_reason_codes
-- Modifies: work_items, reference_audit_log

-- ============================================================================
-- 1. WORK_ITEM_LOCKS - Soft locking for concurrent access
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_item_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_item_id UUID NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
    locked_by UUID NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
    locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Default: locked_at + 30 minutes
    last_heartbeat_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(work_item_id) -- Only one active lock per work item
);

CREATE INDEX idx_work_item_locks_work_item ON work_item_locks(work_item_id);
CREATE INDEX idx_work_item_locks_expires ON work_item_locks(expires_at);
CREATE INDEX idx_work_item_locks_locked_by ON work_item_locks(locked_by);

-- Enable RLS
ALTER TABLE work_item_locks ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all locks
CREATE POLICY "Staff can view all work item locks" ON work_item_locks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can insert locks
CREATE POLICY "Staff can insert work item locks" ON work_item_locks
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can update/delete their own locks
CREATE POLICY "Staff can update their own locks" ON work_item_locks
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users s
            WHERE s.user_id = auth.uid() AND s.id = work_item_locks.locked_by
        )
    );

CREATE POLICY "Staff can delete their own locks" ON work_item_locks
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users s
            WHERE s.user_id = auth.uid() AND s.id = work_item_locks.locked_by
        )
    );

COMMENT ON TABLE work_item_locks IS 'Soft locks for work items - ensures only one staff member can edit at a time';
COMMENT ON COLUMN work_item_locks.expires_at IS '30-minute timeout for auto-release';
COMMENT ON COLUMN work_item_locks.last_heartbeat_at IS 'Updated by heartbeat to extend lock while actively working';

-- ============================================================================
-- 2. CHASE_DEPENDENCIES - Dependency-based chase queue
-- ============================================================================
CREATE TABLE IF NOT EXISTS chase_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL CHECK (dependency_type IN (
        'TENANT_FORM', 'GUARANTOR_FORM', 'EMPLOYER_REF',
        'RESIDENTIAL_REF', 'ACCOUNTANT_REF'
    )),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'CHASING', 'RECEIVED', 'EXHAUSTED', 'ACTION_REQUIRED'
    )),
    -- Contact information (encrypted for PII compliance)
    contact_name_encrypted TEXT,
    contact_email_encrypted TEXT,
    contact_phone_encrypted TEXT,
    -- Chase tracking
    initial_request_sent_at TIMESTAMP WITH TIME ZONE,
    last_chase_sent_at TIMESTAMP WITH TIME ZONE,
    next_chase_due_at TIMESTAMP WITH TIME ZONE,
    chase_cycle INTEGER DEFAULT 0, -- 0-3 (3 = exhausted after 3 full cycles)
    email_attempts INTEGER DEFAULT 0,
    sms_attempts INTEGER DEFAULT 0,
    -- Metadata
    form_url TEXT,
    linked_table VARCHAR(50), -- e.g., 'employer_references', 'landlord_references'
    linked_record_id UUID, -- ID in the linked table
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(reference_id, dependency_type)
);

CREATE INDEX idx_chase_deps_reference ON chase_dependencies(reference_id);
CREATE INDEX idx_chase_deps_status ON chase_dependencies(status);
CREATE INDEX idx_chase_deps_next_chase ON chase_dependencies(next_chase_due_at) WHERE status = 'CHASING';
CREATE INDEX idx_chase_deps_type ON chase_dependencies(dependency_type);

-- Enable RLS
ALTER TABLE chase_dependencies ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all chase dependencies
CREATE POLICY "Staff can view all chase dependencies" ON chase_dependencies
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can manage chase dependencies
CREATE POLICY "Staff can insert chase dependencies" ON chase_dependencies
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can update chase dependencies" ON chase_dependencies
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_chase_dependencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chase_dependencies_updated_at_trigger
    BEFORE UPDATE ON chase_dependencies
    FOR EACH ROW
    EXECUTE FUNCTION update_chase_dependencies_updated_at();

COMMENT ON TABLE chase_dependencies IS 'Dependency-centric chase queue - one row per missing external dependency';
COMMENT ON COLUMN chase_dependencies.dependency_type IS 'Type of dependency: TENANT_FORM, GUARANTOR_FORM, EMPLOYER_REF, RESIDENTIAL_REF, ACCOUNTANT_REF';
COMMENT ON COLUMN chase_dependencies.chase_cycle IS 'Current chase cycle (0-3). After cycle 3 completes, status becomes EXHAUSTED';
COMMENT ON COLUMN chase_dependencies.next_chase_due_at IS 'When the next automatic chase should be sent (respects quiet hours 20:00-08:00 GMT)';

-- ============================================================================
-- 3. ACTION_REASON_CODES - Lookup table for ACTION_REQUIRED reasons
-- ============================================================================
CREATE TABLE IF NOT EXISTS action_reason_codes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    display_label VARCHAR(100) NOT NULL,
    default_agent_message TEXT,
    section_types TEXT[] DEFAULT '{}', -- Which sections can use this code
    active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed common reason codes
INSERT INTO action_reason_codes (code, display_label, default_agent_message, section_types, display_order) VALUES
('MISSING_DOC', 'Missing Document', 'Please upload the required document.', ARRAY['IDENTITY_SELFIE', 'RTR', 'INCOME', 'RESIDENTIAL'], 1),
('ILLEGIBLE', 'Document Illegible', 'The uploaded document is not clear enough to read. Please re-upload a clearer copy.', ARRAY['IDENTITY_SELFIE', 'RTR', 'INCOME', 'RESIDENTIAL'], 2),
('EXPIRED', 'Document Expired', 'The document has expired. Please provide a current version.', ARRAY['IDENTITY_SELFIE', 'RTR'], 3),
('MISMATCH', 'Information Mismatch', 'The information provided does not match the documents. Please verify and resubmit.', ARRAY['IDENTITY_SELFIE', 'INCOME', 'RESIDENTIAL'], 4),
('INCOMPLETE', 'Incomplete Information', 'Some required information is missing. Please complete all fields.', ARRAY['IDENTITY_SELFIE', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML'], 5),
('SELFIE_MISMATCH', 'Selfie Does Not Match ID', 'The selfie photo does not appear to match the ID document photo.', ARRAY['IDENTITY_SELFIE'], 6),
('INCOME_UNVERIFIABLE', 'Income Cannot Be Verified', 'We cannot verify the income from the documents provided. Please provide additional evidence.', ARRAY['INCOME'], 7),
('ADDRESS_MISMATCH', 'Address Mismatch', 'The address on the documents does not match the address provided.', ARRAY['RESIDENTIAL'], 8),
('REFERENCE_NEEDED', 'Reference Required', 'We require a reference to complete verification.', ARRAY['RESIDENTIAL', 'INCOME'], 9),
('SHARE_CODE_INVALID', 'Share Code Invalid', 'The Right to Rent share code provided is invalid or expired.', ARRAY['RTR'], 10),
('OTHER', 'Other Issue', 'Please contact us for more information about the issue with your application.', ARRAY['IDENTITY_SELFIE', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML'], 99);

-- Enable RLS
ALTER TABLE action_reason_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read reason codes
CREATE POLICY "Anyone can view action reason codes" ON action_reason_codes
    FOR SELECT
    TO authenticated
    USING (true);

-- Policy: Only staff can manage reason codes
CREATE POLICY "Staff can manage action reason codes" ON action_reason_codes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

COMMENT ON TABLE action_reason_codes IS 'Lookup table for ACTION_REQUIRED reason codes with agent-facing messages';
COMMENT ON COLUMN action_reason_codes.section_types IS 'Array of section types that can use this reason code';

-- ============================================================================
-- 4. VERIFICATION_SECTIONS - Section-based verification (replaces verification_steps)
-- ============================================================================
CREATE TABLE IF NOT EXISTS verification_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
    person_type VARCHAR(20) NOT NULL CHECK (person_type IN ('TENANT', 'GUARANTOR')),
    section_type VARCHAR(50) NOT NULL CHECK (section_type IN (
        'IDENTITY_SELFIE', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML'
    )),
    section_order INTEGER NOT NULL,

    -- Decision state
    decision VARCHAR(30) NOT NULL DEFAULT 'NOT_REVIEWED' CHECK (decision IN (
        'NOT_REVIEWED', 'PASS', 'PASS_WITH_CONDITION', 'ACTION_REQUIRED', 'FAIL'
    )),
    decision_notes TEXT,
    decision_by UUID REFERENCES staff_users(id),
    decision_at TIMESTAMP WITH TIME ZONE,

    -- For PASS_WITH_CONDITION
    condition_text TEXT,

    -- For ACTION_REQUIRED
    action_reason_code VARCHAR(50) REFERENCES action_reason_codes(code),
    action_agent_note TEXT, -- Visible to agent
    action_internal_note TEXT, -- Staff only
    correction_cycle INTEGER DEFAULT 0, -- Increments each time ACTION_REQUIRED is set

    -- For FAIL
    fail_reason TEXT,

    -- Evidence tracking
    evidence_sources JSONB DEFAULT '[]'::jsonb, -- [{source_type, source_id, verified_at, verified_by}]
    evidence_files JSONB DEFAULT '[]'::jsonb, -- [{file_id, file_name, uploaded_at}]

    -- Checks performed (flexible structure per section)
    checks JSONB DEFAULT '[]'::jsonb, -- [{check_name, result: 'pass'|'fail'|'na', notes, checked_at}]

    -- Score contribution
    score_impact INTEGER DEFAULT 0, -- Points added/deducted from TAS score

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(reference_id, section_type)
);

CREATE INDEX idx_ver_sections_reference ON verification_sections(reference_id);
CREATE INDEX idx_ver_sections_decision ON verification_sections(decision);
CREATE INDEX idx_ver_sections_type ON verification_sections(section_type);
CREATE INDEX idx_ver_sections_person_type ON verification_sections(person_type);

-- Enable RLS
ALTER TABLE verification_sections ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all verification sections
CREATE POLICY "Staff can view all verification sections" ON verification_sections
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can manage verification sections
CREATE POLICY "Staff can insert verification sections" ON verification_sections
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff can update verification sections" ON verification_sections
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_verification_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER verification_sections_updated_at_trigger
    BEFORE UPDATE ON verification_sections
    FOR EACH ROW
    EXECUTE FUNCTION update_verification_sections_updated_at();

COMMENT ON TABLE verification_sections IS 'Section-based verification - replaces linear verification_steps with independent sections';
COMMENT ON COLUMN verification_sections.section_type IS 'Section type: IDENTITY_SELFIE, RTR (tenant only), INCOME, RESIDENTIAL (tenant only), CREDIT, AML';
COMMENT ON COLUMN verification_sections.decision IS 'Section decision: NOT_REVIEWED, PASS, PASS_WITH_CONDITION, ACTION_REQUIRED, FAIL';
COMMENT ON COLUMN verification_sections.condition_text IS 'For PASS_WITH_CONDITION: text that appears on certificate';
COMMENT ON COLUMN verification_sections.correction_cycle IS 'Increments each time ACTION_REQUIRED is set - tracks how many correction rounds';

-- ============================================================================
-- 5. MODIFY WORK_ITEMS - Add columns for dependency tracking and urgency
-- ============================================================================
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS dependency_id UUID REFERENCES chase_dependencies(id) ON DELETE CASCADE;
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS urgency VARCHAR(20) DEFAULT 'NORMAL' CHECK (urgency IN ('NORMAL', 'WARNING', 'URGENT'));
ALTER TABLE work_items ADD COLUMN IF NOT EXISTS urgency_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_work_items_dependency ON work_items(dependency_id) WHERE dependency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_work_items_urgency ON work_items(urgency);

COMMENT ON COLUMN work_items.dependency_id IS 'For CHASE items: links to specific chase_dependency being chased';
COMMENT ON COLUMN work_items.urgency IS 'Queue urgency: NORMAL (<24hrs), WARNING (24-48hrs), URGENT (>48hrs)';

-- ============================================================================
-- 6. MODIFY REFERENCE_AUDIT_LOG - Add columns for enhanced audit trail
-- ============================================================================
ALTER TABLE reference_audit_log ADD COLUMN IF NOT EXISTS old_value JSONB;
ALTER TABLE reference_audit_log ADD COLUMN IF NOT EXISTS new_value JSONB;
ALTER TABLE reference_audit_log ADD COLUMN IF NOT EXISTS section_type VARCHAR(50);
ALTER TABLE reference_audit_log ADD COLUMN IF NOT EXISTS visible_to_agent BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_audit_log_section ON reference_audit_log(section_type) WHERE section_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_log_agent_visible ON reference_audit_log(reference_id, visible_to_agent) WHERE visible_to_agent = TRUE;

COMMENT ON COLUMN reference_audit_log.old_value IS 'Previous value before change (for change tracking)';
COMMENT ON COLUMN reference_audit_log.new_value IS 'New value after change (for change tracking)';
COMMENT ON COLUMN reference_audit_log.section_type IS 'If action relates to a specific verification section';
COMMENT ON COLUMN reference_audit_log.visible_to_agent IS 'If true, this audit entry is visible to agents in their dashboard';

-- ============================================================================
-- 7. FUNCTION: Initialize sections for a reference
-- ============================================================================
CREATE OR REPLACE FUNCTION initialize_verification_sections(p_reference_id UUID)
RETURNS void AS $$
DECLARE
    v_is_guarantor BOOLEAN;
    v_sections TEXT[];
    v_section TEXT;
    v_order INTEGER := 1;
BEGIN
    -- Check if this is a guarantor
    SELECT COALESCE(is_guarantor, false) INTO v_is_guarantor
    FROM tenant_references
    WHERE id = p_reference_id;

    -- Define sections based on person type
    IF v_is_guarantor THEN
        -- Guarantor: 4 sections (no RTR, no RESIDENTIAL)
        v_sections := ARRAY['IDENTITY_SELFIE', 'INCOME', 'CREDIT', 'AML'];
    ELSE
        -- Tenant: 6 sections
        v_sections := ARRAY['IDENTITY_SELFIE', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML'];
    END IF;

    -- Create sections
    FOREACH v_section IN ARRAY v_sections
    LOOP
        INSERT INTO verification_sections (
            reference_id,
            person_type,
            section_type,
            section_order
        ) VALUES (
            p_reference_id,
            CASE WHEN v_is_guarantor THEN 'GUARANTOR' ELSE 'TENANT' END,
            v_section,
            v_order
        ) ON CONFLICT (reference_id, section_type) DO NOTHING;

        v_order := v_order + 1;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION initialize_verification_sections IS 'Creates the appropriate verification sections for a reference (6 for tenant, 4 for guarantor)';

-- ============================================================================
-- 8. FUNCTION: Calculate queue urgency based on age
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_work_item_urgency(p_created_at TIMESTAMP WITH TIME ZONE)
RETURNS VARCHAR(20) AS $$
DECLARE
    v_hours_in_queue NUMERIC;
BEGIN
    v_hours_in_queue := EXTRACT(EPOCH FROM (NOW() - p_created_at)) / 3600;

    IF v_hours_in_queue > 48 THEN
        RETURN 'URGENT';
    ELSIF v_hours_in_queue > 24 THEN
        RETURN 'WARNING';
    ELSE
        RETURN 'NORMAL';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_work_item_urgency IS 'Calculates urgency based on hours in queue: NORMAL (<24hrs), WARNING (24-48hrs), URGENT (>48hrs)';
