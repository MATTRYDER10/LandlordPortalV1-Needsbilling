-- Find and fix references that were marked as "failed" in verification_checks
-- but have status "in_progress" instead of "rejected"

-- Update references that have failed verification but wrong status
UPDATE tenant_references AS ref
SET 
  status = 'rejected',
  updated_at = NOW()
FROM verification_checks AS vc
WHERE 
  ref.id = vc.reference_id
  AND vc.overall_status = 'failed'
  AND ref.status = 'in_progress';

-- Show what was updated
SELECT 
  ref.id,
  ref.status,
  vc.overall_status as verification_status,
  vc.final_decision,
  vc.completed_at
FROM tenant_references AS ref
INNER JOIN verification_checks AS vc ON ref.id = vc.reference_id
WHERE 
  vc.overall_status = 'failed'
  AND ref.status = 'rejected'
ORDER BY vc.completed_at DESC;
