-- Migration 141: Migrate Chase Dependencies to Verification Sections
--
-- Converts existing chase_dependencies into verification_sections
-- Part of the Verify System Simplification (2026-01-12)
--
-- IMPORTANT: This migration is DATA-ONLY and safe to run multiple times (idempotent)
-- It does NOT drop the chase_dependencies table (that will be done after validation)

-- ============================================================================
-- 1. MIGRATE EMPLOYER_REF DEPENDENCIES
-- ============================================================================

INSERT INTO verification_sections (
  reference_id,
  person_type,
  section_type,
  section_order,
  decision,
  decision_notes,
  contact_name_encrypted,
  contact_email_encrypted,
  contact_phone_encrypted,
  initial_request_sent_at,
  last_chase_sent_at,
  next_chase_due_at,
  chase_cycle,
  email_attempts,
  sms_attempts,
  call_attempts,
  form_url,
  linked_table,
  linked_record_id,
  chase_metadata,
  created_at,
  updated_at
)
SELECT
  cd.reference_id,
  CASE
    WHEN tr.is_guarantor THEN 'GUARANTOR'::VARCHAR(20)
    ELSE 'TENANT'::VARCHAR(20)
  END as person_type,
  'EMPLOYER_REFERENCE'::VARCHAR(50) as section_type,
  10 as section_order, -- Order after standard sections
  CASE cd.status
    WHEN 'PENDING' THEN 'NOT_REVIEWED'::VARCHAR(30)
    WHEN 'CHASING' THEN 'NOT_REVIEWED'::VARCHAR(30)
    WHEN 'RECEIVED' THEN 'PASS'::VARCHAR(30)
    WHEN 'EXHAUSTED' THEN 'ACTION_REQUIRED'::VARCHAR(30)
    WHEN 'ACTION_REQUIRED' THEN 'ACTION_REQUIRED'::VARCHAR(30)
    ELSE 'NOT_REVIEWED'::VARCHAR(30)
  END as decision,
  CASE
    WHEN cd.status = 'RECEIVED' THEN 'Employer reference received'
    WHEN cd.status = 'EXHAUSTED' THEN 'Chase exhausted - requires manual intervention'
    WHEN cd.status = 'ACTION_REQUIRED' THEN 'Action required'
    ELSE NULL
  END as decision_notes,
  cd.contact_name_encrypted,
  cd.contact_email_encrypted,
  cd.contact_phone_encrypted,
  cd.initial_request_sent_at,
  cd.last_chase_sent_at,
  cd.next_chase_due_at,
  cd.chase_cycle,
  cd.email_attempts,
  cd.sms_attempts,
  0 as call_attempts, -- Not tracked in old system
  cd.form_url,
  cd.linked_table,
  cd.linked_record_id,
  cd.metadata as chase_metadata,
  cd.created_at,
  cd.updated_at
FROM chase_dependencies cd
JOIN tenant_references tr ON tr.id = cd.reference_id
WHERE cd.dependency_type = 'EMPLOYER_REF'
ON CONFLICT (reference_id, section_type) DO UPDATE SET
  -- Update existing sections with latest chase data
  contact_name_encrypted = EXCLUDED.contact_name_encrypted,
  contact_email_encrypted = EXCLUDED.contact_email_encrypted,
  contact_phone_encrypted = EXCLUDED.contact_phone_encrypted,
  initial_request_sent_at = EXCLUDED.initial_request_sent_at,
  last_chase_sent_at = EXCLUDED.last_chase_sent_at,
  next_chase_due_at = EXCLUDED.next_chase_due_at,
  chase_cycle = EXCLUDED.chase_cycle,
  email_attempts = EXCLUDED.email_attempts,
  sms_attempts = EXCLUDED.sms_attempts,
  form_url = EXCLUDED.form_url,
  linked_table = EXCLUDED.linked_table,
  linked_record_id = EXCLUDED.linked_record_id,
  chase_metadata = EXCLUDED.chase_metadata,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- 2. MIGRATE RESIDENTIAL_REF DEPENDENCIES (as LANDLORD_REFERENCE)
-- ============================================================================

INSERT INTO verification_sections (
  reference_id,
  person_type,
  section_type,
  section_order,
  decision,
  decision_notes,
  contact_name_encrypted,
  contact_email_encrypted,
  contact_phone_encrypted,
  initial_request_sent_at,
  last_chase_sent_at,
  next_chase_due_at,
  chase_cycle,
  email_attempts,
  sms_attempts,
  call_attempts,
  form_url,
  linked_table,
  linked_record_id,
  chase_metadata,
  created_at,
  updated_at
)
SELECT
  cd.reference_id,
  CASE
    WHEN tr.is_guarantor THEN 'GUARANTOR'::VARCHAR(20)
    ELSE 'TENANT'::VARCHAR(20)
  END as person_type,
  'LANDLORD_REFERENCE'::VARCHAR(50) as section_type,
  11 as section_order,
  CASE cd.status
    WHEN 'PENDING' THEN 'NOT_REVIEWED'::VARCHAR(30)
    WHEN 'CHASING' THEN 'NOT_REVIEWED'::VARCHAR(30)
    WHEN 'RECEIVED' THEN 'PASS'::VARCHAR(30)
    WHEN 'EXHAUSTED' THEN 'ACTION_REQUIRED'::VARCHAR(30)
    WHEN 'ACTION_REQUIRED' THEN 'ACTION_REQUIRED'::VARCHAR(30)
    ELSE 'NOT_REVIEWED'::VARCHAR(30)
  END as decision,
  CASE
    WHEN cd.status = 'RECEIVED' THEN 'Residential reference received'
    WHEN cd.status = 'EXHAUSTED' THEN 'Chase exhausted - requires manual intervention'
    WHEN cd.status = 'ACTION_REQUIRED' THEN 'Action required'
    ELSE NULL
  END as decision_notes,
  cd.contact_name_encrypted,
  contact_email_encrypted,
  cd.contact_phone_encrypted,
  cd.initial_request_sent_at,
  cd.last_chase_sent_at,
  cd.next_chase_due_at,
  cd.chase_cycle,
  cd.email_attempts,
  cd.sms_attempts,
  0 as call_attempts,
  cd.form_url,
  cd.linked_table,
  cd.linked_record_id,
  cd.metadata as chase_metadata,
  cd.created_at,
  cd.updated_at
FROM chase_dependencies cd
JOIN tenant_references tr ON tr.id = cd.reference_id
WHERE cd.dependency_type = 'RESIDENTIAL_REF'
ON CONFLICT (reference_id, section_type) DO UPDATE SET
  contact_name_encrypted = EXCLUDED.contact_name_encrypted,
  contact_email_encrypted = EXCLUDED.contact_email_encrypted,
  contact_phone_encrypted = EXCLUDED.contact_phone_encrypted,
  initial_request_sent_at = EXCLUDED.initial_request_sent_at,
  last_chase_sent_at = EXCLUDED.last_chase_sent_at,
  next_chase_due_at = EXCLUDED.next_chase_due_at,
  chase_cycle = EXCLUDED.chase_cycle,
  email_attempts = EXCLUDED.email_attempts,
  sms_attempts = EXCLUDED.sms_attempts,
  form_url = EXCLUDED.form_url,
  linked_table = EXCLUDED.linked_table,
  linked_record_id = EXCLUDED.linked_record_id,
  chase_metadata = EXCLUDED.chase_metadata,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- 3. MIGRATE ACCOUNTANT_REF DEPENDENCIES
-- ============================================================================

INSERT INTO verification_sections (
  reference_id,
  person_type,
  section_type,
  section_order,
  decision,
  decision_notes,
  contact_name_encrypted,
  contact_email_encrypted,
  contact_phone_encrypted,
  initial_request_sent_at,
  last_chase_sent_at,
  next_chase_due_at,
  chase_cycle,
  email_attempts,
  sms_attempts,
  call_attempts,
  form_url,
  linked_table,
  linked_record_id,
  chase_metadata,
  created_at,
  updated_at
)
SELECT
  cd.reference_id,
  CASE
    WHEN tr.is_guarantor THEN 'GUARANTOR'::VARCHAR(20)
    ELSE 'TENANT'::VARCHAR(20)
  END as person_type,
  'ACCOUNTANT_REFERENCE'::VARCHAR(50) as section_type,
  12 as section_order,
  CASE cd.status
    WHEN 'PENDING' THEN 'NOT_REVIEWED'::VARCHAR(30)
    WHEN 'CHASING' THEN 'NOT_REVIEWED'::VARCHAR(30)
    WHEN 'RECEIVED' THEN 'PASS'::VARCHAR(30)
    WHEN 'EXHAUSTED' THEN 'ACTION_REQUIRED'::VARCHAR(30)
    WHEN 'ACTION_REQUIRED' THEN 'ACTION_REQUIRED'::VARCHAR(30)
    ELSE 'NOT_REVIEWED'::VARCHAR(30)
  END as decision,
  CASE
    WHEN cd.status = 'RECEIVED' THEN 'Accountant reference received'
    WHEN cd.status = 'EXHAUSTED' THEN 'Chase exhausted - requires manual intervention'
    WHEN cd.status = 'ACTION_REQUIRED' THEN 'Action required'
    ELSE NULL
  END as decision_notes,
  cd.contact_name_encrypted,
  cd.contact_email_encrypted,
  cd.contact_phone_encrypted,
  cd.initial_request_sent_at,
  cd.last_chase_sent_at,
  cd.next_chase_due_at,
  cd.chase_cycle,
  cd.email_attempts,
  cd.sms_attempts,
  0 as call_attempts,
  cd.form_url,
  cd.linked_table,
  cd.linked_record_id,
  cd.metadata as chase_metadata,
  cd.created_at,
  cd.updated_at
FROM chase_dependencies cd
JOIN tenant_references tr ON tr.id = cd.reference_id
WHERE cd.dependency_type = 'ACCOUNTANT_REF'
ON CONFLICT (reference_id, section_type) DO UPDATE SET
  contact_name_encrypted = EXCLUDED.contact_name_encrypted,
  contact_email_encrypted = EXCLUDED.contact_email_encrypted,
  contact_phone_encrypted = EXCLUDED.contact_phone_encrypted,
  initial_request_sent_at = EXCLUDED.initial_request_sent_at,
  last_chase_sent_at = EXCLUDED.last_chase_sent_at,
  next_chase_due_at = EXCLUDED.next_chase_due_at,
  chase_cycle = EXCLUDED.chase_cycle,
  email_attempts = EXCLUDED.email_attempts,
  sms_attempts = EXCLUDED.sms_attempts,
  form_url = EXCLUDED.form_url,
  linked_table = EXCLUDED.linked_table,
  linked_record_id = EXCLUDED.linked_record_id,
  chase_metadata = EXCLUDED.chase_metadata,
  updated_at = EXCLUDED.updated_at;

-- ============================================================================
-- 4. LOG MIGRATION RESULTS
-- ============================================================================

DO $$
DECLARE
  v_employer_count INTEGER;
  v_landlord_count INTEGER;
  v_accountant_count INTEGER;
  v_tenant_form_count INTEGER;
  v_guarantor_form_count INTEGER;
BEGIN
  -- Count migrated sections
  SELECT COUNT(*) INTO v_employer_count FROM verification_sections WHERE section_type = 'EMPLOYER_REFERENCE';
  SELECT COUNT(*) INTO v_landlord_count FROM verification_sections WHERE section_type = 'LANDLORD_REFERENCE';
  SELECT COUNT(*) INTO v_accountant_count FROM verification_sections WHERE section_type = 'ACCOUNTANT_REFERENCE';

  -- Count unmigrated dependencies (TENANT_FORM, GUARANTOR_FORM)
  SELECT COUNT(*) INTO v_tenant_form_count FROM chase_dependencies WHERE dependency_type = 'TENANT_FORM';
  SELECT COUNT(*) INTO v_guarantor_form_count FROM chase_dependencies WHERE dependency_type = 'GUARANTOR_FORM';

  RAISE NOTICE 'Migration 141 completed successfully!';
  RAISE NOTICE '  - Migrated % EMPLOYER_REFERENCE sections', v_employer_count;
  RAISE NOTICE '  - Migrated % LANDLORD_REFERENCE sections', v_landlord_count;
  RAISE NOTICE '  - Migrated % ACCOUNTANT_REFERENCE sections', v_accountant_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Not migrated (form submission tracking):';
  RAISE NOTICE '  - % TENANT_FORM dependencies (tracked via verification_state instead)', v_tenant_form_count;
  RAISE NOTICE '  - % GUARANTOR_FORM dependencies (tracked via verification_state instead)', v_guarantor_form_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test chase queue with new verification_sections';
  RAISE NOTICE '  2. Update chaseDependencyService to query verification_sections';
  RAISE NOTICE '  3. After validation, drop chase_dependencies table';
END $$;
