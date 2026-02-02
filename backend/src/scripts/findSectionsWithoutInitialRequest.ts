import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { decrypt } from '../services/encryption';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findSectionsWithoutInitial() {
  console.log('=== EXTERNAL SECTIONS WITHOUT INITIAL REQUEST ===\n');

  const EXTERNAL_TYPES = ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE', 'AGENT_REFERENCE'];

  // Find external sections that:
  // - Are in NOT_REVIEWED status
  // - DON'T have initial_request_sent_at set
  // - Reference is submitted and in active state
  const { data: sections } = await supabase
    .from('verification_sections')
    .select(`
      id,
      section_type,
      decision,
      initial_request_sent_at,
      created_at,
      reference:tenant_references!verification_sections_reference_id_fkey (
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        verification_state,
        status,
        submitted_at,
        created_at
      )
    `)
    .in('section_type', EXTERNAL_TYPES)
    .eq('decision', 'NOT_REVIEWED')
    .is('initial_request_sent_at', null);

  console.log(`Total external sections WITHOUT initial request sent: ${sections?.length || 0}\n`);

  if (!sections || sections.length === 0) {
    console.log('✅ NO SECTIONS MISSING INITIAL REQUEST\n');
    return;
  }

  // Filter for submitted references
  const submittedSections = sections.filter((s: any) =>
    s.reference?.submitted_at !== null
  );

  // Filter for active references only
  const activeSections = submittedSections.filter((s: any) => {
    const state = s.reference?.verification_state;
    return state !== 'COMPLETED' && state !== 'REJECTED' && state !== 'CANCELLED';
  });

  console.log(`Sections from submitted references: ${submittedSections.length}`);
  console.log(`Sections from ACTIVE submitted references: ${activeSections.length}\n`);

  if (activeSections.length === 0) {
    console.log('✅ NO ACTIVE SECTIONS MISSING INITIAL REQUEST\n');
  } else {
    console.log('⚠️  SECTIONS THAT NEED INITIAL REQUEST SENT:\n');

    activeSections.forEach((s: any, index: number) => {
      const firstName = decrypt(s.reference?.tenant_first_name_encrypted);
      const lastName = decrypt(s.reference?.tenant_last_name_encrypted);
      const daysSinceSubmit = s.reference?.submitted_at
        ? Math.floor((Date.now() - new Date(s.reference.submitted_at).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      const daysSinceCreated = Math.floor(
        (Date.now() - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );

      console.log(`${index + 1}. ${firstName} ${lastName}`);
      console.log(`   Type: ${s.section_type}`);
      console.log(`   Reference ID: ${s.reference?.id}`);
      console.log(`   Reference State: ${s.reference?.verification_state || 'null'}`);
      console.log(`   Submitted: ${new Date(s.reference.submitted_at).toLocaleString()} (${daysSinceSubmit} days ago)`);
      console.log(`   Section created: ${new Date(s.created_at).toLocaleString()} (${daysSinceCreated} days ago)`);
      console.log(`   ⚠️  Initial request NEVER sent!`);
      console.log('');
    });

    console.log(`\n⚠️  FOUND ${activeSections.length} SECTIONS THAT NEED INITIAL REQUESTS SENT\n`);
    console.log('These should have been sent when the tenant submitted the reference!');
  }

  console.log('\n=== END CHECK ===');
}

findSectionsWithoutInitial();
