-- Sync rejected status from parent references to their children
-- This fixes historical data where parents were rejected but children weren't

-- Update all children of rejected parents to also be rejected
UPDATE tenant_references AS child
SET 
  status = 'rejected',
  verified_at = parent.verified_at,
  verified_by = parent.verified_by,
  verification_notes_encrypted = parent.verification_notes_encrypted,
  updated_at = NOW()
FROM tenant_references AS parent
WHERE 
  child.parent_reference_id = parent.id
  AND parent.status = 'rejected'
  AND parent.is_group_parent = true
  AND child.status != 'rejected';

-- Log the number of affected rows
SELECT COUNT(*) as updated_children 
FROM tenant_references AS child
INNER JOIN tenant_references AS parent ON child.parent_reference_id = parent.id
WHERE 
  parent.status = 'rejected'
  AND parent.is_group_parent = true
  AND child.status = 'rejected';
