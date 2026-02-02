import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPendingResponses() {
  console.log('=== PENDING RESPONSES INVESTIGATION ===\n');

  // 1. Check references in COLLECTING_EVIDENCE
  console.log('1. References in COLLECTING_EVIDENCE state:');
  const { data: collectingRefs } = await supabase
    .from('tenant_references')
    .select('id, status, verification_state, created_at')
    .eq('verification_state', 'COLLECTING_EVIDENCE')
    .order('created_at', { ascending: false });

  console.log(`   Found ${collectingRefs?.length || 0} references in COLLECTING_EVIDENCE\n`);

  // 2. Check verification_sections for external references
  console.log('2. Verification sections (external references):');
  const { data: sections } = await supabase
    .from('verification_sections')
    .select(`
      id,
      reference_id,
      section_type,
      decision,
      initial_request_sent_at,
      last_chase_sent_at,
      created_at,
      reference:tenant_references!verification_sections_reference_id_fkey (
        id,
        status,
        verification_state,
        created_at
      )
    `)
    .in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'AGENT_REFERENCE', 'ACCOUNTANT_REFERENCE'])
    .eq('decision', 'NOT_REVIEWED')
    .order('created_at', { ascending: false })
    .limit(50);

  console.log(`   Total sections with decision=NOT_REVIEWED: ${sections?.length || 0}\n`);

  // 3. Check which have initial_request_sent_at
  const withInitialRequest = sections?.filter(s => s.initial_request_sent_at) || [];
  const withoutInitialRequest = sections?.filter(s => !s.initial_request_sent_at) || [];

  console.log(`   - With initial_request_sent_at: ${withInitialRequest.length}`);
  console.log(`   - WITHOUT initial_request_sent_at: ${withoutInitialRequest.length}\n`);

  if (withoutInitialRequest.length > 0) {
    console.log('   Sections WITHOUT initial request (should have been sent on tenant submission):');
    withoutInitialRequest.slice(0, 10).forEach(s => {
      console.log(`     - ${s.id} (${s.section_type}): ref=${s.reference_id}, created=${s.created_at}`);
      console.log(`       Reference state: ${(s.reference as any)?.verification_state}, status: ${(s.reference as any)?.status}`);
    });
    console.log('');
  }

  // 4. Check what would appear in Pending Responses queue
  console.log('4. Items that SHOULD appear in Pending Responses:');
  const shouldAppear = sections?.filter((s: any) => {
    // Must have initial request sent
    if (!s.initial_request_sent_at) return false;

    // Must have reference
    if (!s.reference) return false;

    // Check verification state exclusions
    const excludedStates = ['COMPLETED', 'REJECTED', 'CANCELLED', 'IN_VERIFICATION', 'READY_FOR_REVIEW'];
    if (excludedStates.includes(s.reference.verification_state)) return false;

    return true;
  }) || [];

  console.log(`   Items that should appear: ${shouldAppear.length}`);
  if (shouldAppear.length > 0) {
    console.log('   First 10:');
    shouldAppear.slice(0, 10).forEach((s: any) => {
      console.log(`     - ${s.section_type}: ref=${s.reference_id}`);
      console.log(`       State: ${s.reference.verification_state}, Initial sent: ${s.initial_request_sent_at}`);
    });
  }
  console.log('');

  // 5. Check recent references (last 2 days)
  console.log('5. Recent references (last 48 hours):');
  const twoDaysAgo = new Date();
  twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

  const { data: recentRefs } = await supabase
    .from('tenant_references')
    .select('id, status, verification_state, submitted_at, created_at')
    .gte('created_at', twoDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  console.log(`   Found ${recentRefs?.length || 0} references created in last 48h`);
  if (recentRefs && recentRefs.length > 0) {
    console.log('   Details:');
    for (const ref of recentRefs.slice(0, 5)) {
      console.log(`     - ${ref.id}: state=${ref.verification_state}, status=${ref.status}`);

      // Check if they have verification sections
      const { data: refSections } = await supabase
        .from('verification_sections')
        .select('id, section_type, decision, initial_request_sent_at')
        .eq('reference_id', ref.id);

      if (refSections && refSections.length > 0) {
        refSections.forEach(sect => {
          console.log(`       Section: ${sect.section_type}, decision=${sect.decision}, initial_sent=${sect.initial_request_sent_at ? 'YES' : 'NO'}`);
        });
      } else {
        console.log(`       No verification sections found`);
      }
    }
  }

  console.log('\n=== END INVESTIGATION ===');
}

checkPendingResponses();
