-- Create work_items table for unified work queue
CREATE TABLE IF NOT EXISTS work_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_id UUID NOT NULL REFERENCES tenant_references(id) ON DELETE CASCADE,
    work_type VARCHAR(20) NOT NULL CHECK (work_type IN ('CHASE', 'VERIFY')),
    status VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'RETURNED')),
    priority INTEGER NOT NULL DEFAULT 0, -- Higher number = higher priority
    assigned_to UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    assigned_at TIMESTAMP WITH TIME ZONE,
    cooldown_until TIMESTAMP WITH TIME ZONE, -- For chase items with 4-hour cooldown
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb -- Flexible field for additional data
);

-- Create indexes for efficient querying
CREATE INDEX idx_work_items_reference_id ON work_items(reference_id);
CREATE INDEX idx_work_items_status ON work_items(status);
CREATE INDEX idx_work_items_work_type ON work_items(work_type);
CREATE INDEX idx_work_items_assigned_to ON work_items(assigned_to);
CREATE INDEX idx_work_items_cooldown_until ON work_items(cooldown_until) WHERE cooldown_until IS NOT NULL;
CREATE INDEX idx_work_items_created_at ON work_items(created_at);
CREATE INDEX idx_work_items_last_activity_at ON work_items(last_activity_at);
CREATE INDEX idx_work_items_priority ON work_items(priority);

-- Composite index for queue queries (available items, sorted by age and priority)
-- Note: We removed the cooldown_until check from the index predicate because NOW() is not immutable
-- The application will filter cooldown items in the query instead
CREATE INDEX idx_work_items_queue ON work_items(work_type, status, priority DESC, created_at ASC)
WHERE status = 'AVAILABLE';

-- Enable RLS
ALTER TABLE work_items ENABLE ROW LEVEL SECURITY;

-- Policy: Staff can view all work items
CREATE POLICY "Staff can view all work items" ON work_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can insert work items
CREATE POLICY "Staff can insert work items" ON work_items
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Policy: Staff can update work items
CREATE POLICY "Staff can update work items" ON work_items
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM staff_users
            WHERE staff_users.user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER work_items_updated_at_trigger
    BEFORE UPDATE ON work_items
    FOR EACH ROW
    EXECUTE FUNCTION update_work_items_updated_at();

-- Function to auto-create work items when reference reaches pending_verification
CREATE OR REPLACE FUNCTION auto_create_work_item()
RETURNS TRIGGER AS $$
BEGIN
    -- When reference moves to pending_verification, create VERIFY work item
    IF NEW.status = 'pending_verification' AND (OLD.status IS NULL OR OLD.status != 'pending_verification') THEN
        INSERT INTO work_items (reference_id, work_type, status, priority)
        VALUES (NEW.id, 'VERIFY', 'AVAILABLE', 0)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create work items
CREATE TRIGGER auto_create_work_item_trigger
    AFTER INSERT OR UPDATE ON tenant_references
    FOR EACH ROW
    EXECUTE FUNCTION auto_create_work_item();

COMMENT ON TABLE work_items IS 'Unified work queue for CHASE and VERIFY tasks';
COMMENT ON COLUMN work_items.work_type IS 'Type of work: CHASE (follow up missing info) or VERIFY (complete verification)';
COMMENT ON COLUMN work_items.status IS 'Current status: AVAILABLE (in queue), ASSIGNED (claimed by staff), IN_PROGRESS (actively working), COMPLETED, RETURNED (back to queue)';
COMMENT ON COLUMN work_items.priority IS 'Priority level - higher number = higher priority. Auto-incremented for aging items';
COMMENT ON COLUMN work_items.cooldown_until IS 'For CHASE items: timestamp when item becomes visible again after recent contact attempt';
COMMENT ON COLUMN work_items.last_activity_at IS 'Last time any activity occurred (assignment, contact attempt, update)';
