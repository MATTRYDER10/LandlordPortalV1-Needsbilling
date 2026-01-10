-- Migration 137: Fix duplicate work items by adding UNIQUE constraint
-- This prevents the same reference from having multiple work items of the same type

-- Step 1: Delete duplicate work items, keeping only the oldest one for each (reference_id, work_type) combination
DELETE FROM work_items
WHERE id NOT IN (
  SELECT DISTINCT ON (reference_id, work_type) id
  FROM work_items
  WHERE reference_id IS NOT NULL
  ORDER BY reference_id, work_type, created_at ASC
);

-- Step 2: Add UNIQUE constraint to prevent future duplicates
ALTER TABLE work_items
ADD CONSTRAINT unique_reference_work_type
UNIQUE (reference_id, work_type);

-- Step 3: Create index to improve query performance
CREATE INDEX IF NOT EXISTS idx_work_items_reference_type
ON work_items(reference_id, work_type)
WHERE reference_id IS NOT NULL;
