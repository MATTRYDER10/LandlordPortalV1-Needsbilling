import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'

async function checkReference() {
  const referenceId = 'a59a6f41-f2dc-4c63-a9c8-fcd0fd3d0479'

  console.log('=== CHECKING REFERENCE ===')
  console.log(`ID: ${referenceId}\n`)

  // Get main reference details
  const { data: reference } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', referenceId)
    .single()

  if (!reference) {
    console.log('❌ Reference not found')
    return
  }

  const tenantName = reference.tenant_first_name_encrypted && reference.tenant_last_name_encrypted
    ? `${decrypt(reference.tenant_first_name_encrypted)} ${decrypt(reference.tenant_last_name_encrypted)}`
    : 'Unknown'

  console.log('TENANT INFO:')
  console.log(`  Name: ${tenantName}`)
  console.log(`  Status: ${reference.status}`)
  console.log(`  Verification State: ${reference.verification_state}`)
  console.log(`  Employment Type: ${reference.employment_type || 'Not specified'}`)

  // Check verification sections
  console.log('\n=== VERIFICATION SECTIONS ===')
  const { data: sections } = await supabase
    .from('verification_sections')
    .select('*')
    .eq('reference_id', referenceId)
    .order('section_type')

  if (sections && sections.length > 0) {
    sections.forEach(section => {
      console.log(`\n${section.section_type}:`)
      console.log(`  Status: ${section.status}`)
      console.log(`  Decision: ${section.decision || 'Not set'}`)
      console.log(`  Evidence Source: ${section.evidence_source || 'None'}`)
      console.log(`  Last Reviewed: ${section.reviewed_at || 'Never'}`)
      console.log(`  Reviewed By: ${section.reviewed_by || 'None'}`)
    })
  } else {
    console.log('  No verification sections found')
  }

  // Check for external references (employer/accountant)
  console.log('\n=== EXTERNAL REFERENCES ===')

  // Employer reference
  const { data: employerRef } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  if (employerRef) {
    console.log('\nEMPLOYER REFERENCE:')
    console.log(`  Company: ${employerRef.company_name_encrypted ? decrypt(employerRef.company_name_encrypted) : 'N/A'}`)
    console.log(`  Email: ${employerRef.employer_email_encrypted ? decrypt(employerRef.employer_email_encrypted) : 'N/A'}`)
    console.log(`  Submitted: ${employerRef.submitted_at || 'NOT SUBMITTED ⏳'}`)
    console.log(`  Token Expires: ${employerRef.token_expires_at || 'N/A'}`)
  } else {
    console.log('\nNo employer reference found')
  }

  // Accountant reference
  const { data: accountantRef } = await supabase
    .from('accountant_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  if (accountantRef) {
    console.log('\nACCOUNTANT REFERENCE:')
    console.log(`  Firm: ${accountantRef.firm_name_encrypted ? decrypt(accountantRef.firm_name_encrypted) : 'N/A'}`)
    console.log(`  Email: ${accountantRef.accountant_email_encrypted ? decrypt(accountantRef.accountant_email_encrypted) : 'N/A'}`)
    console.log(`  Submitted: ${accountantRef.submitted_at || 'NOT SUBMITTED ⏳'}`)
    console.log(`  Token Expires: ${accountantRef.token_expires_at || 'N/A'}`)
  } else {
    console.log('\nNo accountant reference found')
  }

  // Check for uploaded documents
  console.log('\n=== UPLOADED DOCUMENTS ===')
  const docFields = [
    'identity_document_path',
    'selfie_path',
    'payslip_path',
    'bank_statement_path',
    'p60_path',
    'tax_return_path',
    'other_income_proof_path',
    'right_to_rent_share_code',
    'right_to_rent_document_path'
  ]

  let hasDocuments = false
  docFields.forEach(field => {
    if (reference[field]) {
      console.log(`  ✅ ${field}: ${reference[field]}`)
      hasDocuments = true
    }
  })

  if (!hasDocuments) {
    console.log('  No documents uploaded')
  }

  // Check chase dependencies
  console.log('\n=== CHASE DEPENDENCIES ===')
  const { data: chaseDeps } = await supabase
    .from('chase_dependencies')
    .select('*')
    .eq('reference_id', referenceId)
    .order('created_at', { ascending: false })

  if (chaseDeps && chaseDeps.length > 0) {
    chaseDeps.forEach(dep => {
      console.log(`\n${dep.dependency_type}:`)
      console.log(`  Status: ${dep.status}`)
      console.log(`  Created: ${dep.created_at}`)
      console.log(`  Completed: ${dep.completed_at || 'Not completed'}`)
    })
  } else {
    console.log('  No chase dependencies found')
  }

  // Summary
  console.log('\n=== SUMMARY ===')

  const incomeSection = sections?.find(s => s.section_type === 'INCOME')
  if (incomeSection) {
    console.log(`\nINCOME SECTION:`)
    console.log(`  Status: ${incomeSection.status}`)
    console.log(`  Evidence Source: ${incomeSection.evidence_source || 'NONE'}`)

    if (incomeSection.status === 'ACTION_REQUIRED') {
      console.log(`  ✅ AWAITING ACTION (could be referee response or upload)`)
    }

    if (incomeSection.evidence_source === 'UPLOAD') {
      console.log(`  ✅ Should have UPLOADED evidence`)
    } else if (incomeSection.evidence_source === 'EMPLOYER_REF' || incomeSection.evidence_source === 'ACCOUNTANT_REF') {
      console.log(`  ✅ Should have REFEREE response (${incomeSection.evidence_source})`)
    }

    if (employerRef && !employerRef.submitted_at) {
      console.log(`  ⏳ EMPLOYER referee response PENDING`)
    }

    if (accountantRef && !accountantRef.submitted_at) {
      console.log(`  ⏳ ACCOUNTANT referee response PENDING`)
    }

    if (incomeSection.status === 'ACTION_REQUIRED' && !incomeSection.evidence_source) {
      console.log(`  ⚠️  Evidence source not set - should be UPLOAD, EMPLOYER_REF, or ACCOUNTANT_REF`)
    }
  }
}

checkReference()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Check failed:', error)
    process.exit(1)
  })
