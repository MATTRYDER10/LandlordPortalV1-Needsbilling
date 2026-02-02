import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { decrypt } from '../services/encryption';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findReference() {
  console.log('=== SEARCHING FOR CLAIRE LADWA ===\n');

  // Search by name (encrypted)
  const { data: refs } = await supabase
    .from('tenant_references')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (!refs) {
    console.log('No references found');
    return;
  }

  const matches = refs.filter(ref => {
    const firstName = decrypt(ref.tenant_first_name_encrypted)?.toLowerCase();
    const lastName = decrypt(ref.tenant_last_name_encrypted)?.toLowerCase();
    return (firstName?.includes('clair') || firstName?.includes('clare')) &&
           (lastName?.includes('ladwa'));
  });

  console.log(`Found ${matches.length} matching references\n`);

  for (const ref of matches) {
    const firstName = decrypt(ref.tenant_first_name_encrypted);
    const lastName = decrypt(ref.tenant_last_name_encrypted);
    const email = decrypt(ref.tenant_email_encrypted);

    console.log(`\nReference: ${ref.id}`);
    console.log(`  Name: ${firstName} ${lastName}`);
    console.log(`  Email: ${email}`);
    console.log(`  Created: ${new Date(ref.created_at).toLocaleString()}`);
    console.log(`  Status: ${ref.status}`);
    console.log(`  Verification State: ${ref.verification_state || 'null'}`);
    console.log(`  Submitted At: ${ref.submitted_at ? new Date(ref.submitted_at).toLocaleString() : 'NOT SUBMITTED'}`);

    // Check verification sections
    const { data: sections } = await supabase
      .from('verification_sections')
      .select('*')
      .eq('reference_id', ref.id);

    if (sections && sections.length > 0) {
      console.log(`  Verification Sections: ${sections.length}`);

      const EXTERNAL_TYPES = ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE', 'AGENT_REFERENCE'];
      const externalSections = sections.filter(s => EXTERNAL_TYPES.includes(s.section_type));

      if (externalSections.length > 0) {
        console.log(`  External Reference Sections:`);
        externalSections.forEach(s => {
          console.log(`    - ${s.section_type}:`);
          console.log(`      Decision: ${s.decision}`);
          console.log(`      Initial sent: ${s.initial_request_sent_at ? new Date(s.initial_request_sent_at).toLocaleString() : 'NO'}`);
          console.log(`      Last chase: ${s.last_chase_sent_at ? new Date(s.last_chase_sent_at).toLocaleString() : 'NEVER'}`);
        });
      }

      // Check if should be in chase queue
      const notReviewedExternal = externalSections.filter(s =>
        s.decision === 'NOT_REVIEWED' && s.initial_request_sent_at
      );

      if (notReviewedExternal.length > 0) {
        console.log(`\n  ⚠️  Should be in Pending Responses queue: ${notReviewedExternal.length} sections`);
        console.log(`  Reference state: ${ref.verification_state}`);

        if (ref.verification_state === 'COMPLETED' || ref.verification_state === 'REJECTED' || ref.verification_state === 'CANCELLED') {
          console.log(`  ❌ FILTERED OUT: Reference is in terminal state (${ref.verification_state})`);
        } else {
          console.log(`  ✅ SHOULD APPEAR: Reference is in active state`);
        }
      }
    } else {
      console.log(`  Verification Sections: NONE`);
    }

    // Check employment/residential history
    const { data: employment } = await supabase
      .from('employment_history')
      .select('*')
      .eq('tenant_reference_id', ref.id);

    const { data: residential } = await supabase
      .from('residential_history')
      .select('*')
      .eq('tenant_reference_id', ref.id);

    console.log(`  Employment History: ${employment?.length || 0}`);
    console.log(`  Residential History: ${residential?.length || 0}`);
  }

  console.log('\n=== END SEARCH ===');
}

findReference();
