-- Check all rejected references
SELECT 
  id,
  status,
  is_group_parent,
  parent_reference_id,
  created_at,
  CASE 
    WHEN is_group_parent = true THEN 'PARENT'
    WHEN parent_reference_id IS NOT NULL THEN 'CHILD'
    ELSE 'SINGLE'
  END as reference_type
FROM tenant_references
WHERE status = 'rejected'
ORDER BY created_at DESC;

-- Count by type
SELECT 
  CASE 
    WHEN is_group_parent = true THEN 'PARENT'
    WHEN parent_reference_id IS NOT NULL THEN 'CHILD'
    ELSE 'SINGLE'
  END as reference_type,
  COUNT(*) as count
FROM tenant_references
WHERE status = 'rejected'
GROUP BY reference_type;

-- Check if there are ANY parent references (rejected or not)
SELECT 
  COUNT(*) as total_parents,
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_parents
FROM tenant_references
WHERE is_group_parent = true;
