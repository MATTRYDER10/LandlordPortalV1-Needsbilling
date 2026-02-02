import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { decrypt } from '../services/encryption';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAllOutstanding() {
  console.log('=== ALL OUTSTANDING EXTERNAL REFERENCES ===\n');

  const EXTERNAL_TYPES = ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE'];

  // Get all external reference sections with:
  // - decision = NOT_REVIEWED
  // - initial_request_sent_at is set
  // - reference is NOT in terminal state
  const { data: sections } = await supabase
    .from('verification_sections')
    .select(`
      id,
      section_type,
      decision,
      initial_request_sent_at,
      last_chase_sent_at,
      created_at,
      reference:tenant_references!verification_sections_reference_id_fkey (
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        verification_state,
        status,
        created_at
      )
    `)
    .in('section_type', EXTERNAL_TYPES)
    .eq('decision', 'NOT_REVIEWED')
    .not('initial_request_sent_at', 'is', null);

  console.log(`Total external sections with NOT_REVIEWED and initial sent: ${sections?.length || 0}\n`);

  if (!sections || sections.length === 0) {
    console.log('No outstanding external references found');
    return;
  }

  // Filter for active references only
  const activeSections = sections.filter((s: any) => {
    const state = s.reference?.verification_state;
    return state !== 'COMPLETED' && state !== 'REJECTED' && state !== 'CANCELLED';
  });

  console.log(`Active (should be in queue): ${activeSections.length}`);
  console.log(`Completed/Rejected/Cancelled (filtered out): ${sections.length - activeSections.length}\n`);

  if (activeSections.length === 0) {
    console.log('\n✅ NO OUTSTANDING ITEMS - Queue is correct!\n');
  } else {
    console.log('\n⚠️  OUTSTANDING ITEMS THAT SHOULD BE IN QUEUE:\n');

    activeSections.forEach((s: any, index: number) => {
      const firstName = decrypt(s.reference?.tenant_first_name_encrypted);
      const lastName = decrypt(s.reference?.tenant_last_name_encrypted);
      const daysSince = Math.floor(
        (Date.now() - new Date(s.initial_request_sent_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      console.log(`${index + 1}. ${firstName} ${lastName}`);
      console.log(`   Type: ${s.section_type}`);
      console.log(`   Reference ID: ${s.reference?.id}`);
      console.log(`   Reference State: ${s.reference?.verification_state || 'null'}`);
      console.log(`   Initial sent: ${new Date(s.initial_request_sent_at).toLocaleString()} (${daysSince} days ago)`);
      console.log(`   Last chase: ${s.last_chase_sent_at ? new Date(s.last_chase_sent_at).toLocaleString() : 'NEVER'}`);
      console.log('');
    });
  }

  console.log('=== END CHECK ===');
}

checkAllOutstanding();
