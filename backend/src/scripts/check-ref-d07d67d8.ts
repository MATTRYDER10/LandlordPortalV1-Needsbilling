import { supabase } from '../config/supabase'
import { decrypt } from '../services/encryption'

async function checkReference() {
  const referenceId = 'd07d67d8-e799-4c6e-814f-8086ed1bb51a'

  console.log('=== CHECKING REFERENCE ===')
  console.log(`ID: ${referenceId}\n`)

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
    ? decrypt(reference.tenant_first_name_encrypted) + ' ' + decrypt(reference.tenant_last_name_encrypted)
    : 'Unknown'

  console.log('TENANT INFO:')
  console.log('  Name:', tenantName)
  console.log('  Status:', reference.status)
  console.log('  Verification State:', reference.verification_state)
  console.log('  Employment Type:', reference.employment_type || 'Not specified')

  const { data: sections } = await supabase
    .from('verification_sections')
    .select('*')
    .eq('reference_id', referenceId)
    .order('section_type')

  console.log('\n=== VERIFICATION SECTIONS ===')
  if (sections && sections.length > 0) {
    sections.forEach(section => {
      console.log(`\n${section.section_type}:`)
      console.log('  Status:', section.status)
      console.log('  Decision:', section.decision || 'Not set')
      console.log('  Evidence Source:', section.evidence_source || 'None')
    })
  }

  const { data: employerRef } = await supabase
    .from('employer_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  const { data: accountantRef } = await supabase
    .from('accountant_references')
    .select('*')
    .eq('reference_id', referenceId)
    .maybeSingle()

  console.log('\n=== EXTERNAL REFERENCES ===')
  if (employerRef) {
    console.log('EMPLOYER:', employerRef.submitted_at ? '✅ SUBMITTED' : '⏳ PENDING')
  } else {
    console.log('EMPLOYER: None')
  }
  if (accountantRef) {
    console.log('ACCOUNTANT:', accountantRef.submitted_at ? '✅ SUBMITTED' : '⏳ PENDING')
  } else {
    console.log('ACCOUNTANT: None')
  }

  console.log('\n=== EVIDENCE ===')
  if (reference.payslip_path) console.log('✅ Payslip uploaded')
  if (reference.bank_statement_path) console.log('✅ Bank statement uploaded')
  if (reference.p60_path) console.log('✅ P60 uploaded')
  if (!reference.payslip_path && !reference.bank_statement_path && !reference.p60_path) {
    console.log('No income documents uploaded')
  }

  console.log('\n=== SUMMARY ===')
  const incomeSection = sections?.find(s => s.section_type === 'INCOME')
  if (incomeSection) {
    console.log('\nINCOME STATUS:', incomeSection.status)
    console.log('EVIDENCE SOURCE:', incomeSection.evidence_source || 'NOT SET')

    if (incomeSection.evidence_source === 'EMPLOYER_REF') {
      console.log('\n✅ YES - Awaiting EMPLOYER referee response')
    } else if (incomeSection.evidence_source === 'ACCOUNTANT_REF') {
      console.log('\n✅ YES - Awaiting ACCOUNTANT referee response')
    } else if (incomeSection.evidence_source === 'UPLOAD') {
      console.log('\n✅ YES - Should have evidence UPLOADED')
    }

    if (incomeSection.decision === 'ACTION_REQUIRED') {
      console.log('⚠️  YES - Evidence is INSUFFICIENT')
    }
  }
}

checkReference().then(() => process.exit(0))
