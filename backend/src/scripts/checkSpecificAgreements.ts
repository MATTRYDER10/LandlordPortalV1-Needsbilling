import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const agreementIds = [
  'f96e5efc-75e0-4dd5-b148-b5085a2a2dff',
  'c99a5582-a299-466f-96df-ddabe3edba00',
  '020a6d0f-4a0b-4260-9e60-37a093f0b9c0',
  '96b5170a-05f3-4330-80f4-aa7316767faa',
  '247661e0-147a-4ee5-ae07-b30cb2376c88',
  '2cb118ff-9253-4c35-940f-44a52932ef9b'
];

async function checkAgreements() {
  console.log('=== CHECKING SPECIFIC AGREEMENTS ===\n');

  for (const agreementId of agreementIds) {
    console.log(`\nAgreement: ${agreementId}`);

    // Get agreement details
    const { data: agreement } = await supabase
      .from('tenancy_agreements')
      .select('*')
      .eq('id', agreementId)
      .single();

    if (!agreement) {
      console.log('  Agreement not found\n');
      continue;
    }

    console.log(`  Status: ${agreement.status}`);
    console.log(`  Created: ${new Date(agreement.created_at).toLocaleString()}`);

    // Get signatures
    const { data: signatures } = await supabase
      .from('agreement_signatures')
      .select('*')
      .eq('agreement_id', agreementId)
      .order('created_at', { ascending: true });

    if (signatures && signatures.length > 0) {
      console.log(`  Signatures (${signatures.length} total):`);

      signatures.forEach((sig: any, index: number) => {
        console.log(`    ${index + 1}. ${sig.signer_name} (${sig.signer_type})`);
        console.log(`       Email: ${sig.signer_email}`);
        console.log(`       Status: ${sig.status}`);
        console.log(`       Email send count: ${sig.email_send_count}`);
        console.log(`       Last email sent: ${sig.last_email_sent_at || 'never'}`);
        console.log(`       Signed at: ${sig.signed_at || 'not signed'}`);
        console.log(`       Created: ${new Date(sig.created_at).toLocaleString()}`);
      });

      // Check for issues
      const pending = signatures.filter((s: any) => s.status === 'pending');
      const sent = signatures.filter((s: any) => s.status === 'sent');
      const signed = signatures.filter((s: any) => s.status === 'signed');

      console.log(`\n  Summary: ${pending.length} pending, ${sent.length} sent, ${signed.length} signed`);

      // Check for the bug pattern: some signatures sent, some not
      if (pending.length > 0 && (sent.length > 0 || signed.length > 0)) {
        console.log(`  ⚠️  BUG DETECTED: Partial email send - ${pending.length} signatures never received email`);
        console.log(`     Signatures that didn't get emailed:`);
        pending.forEach((sig: any) => {
          console.log(`       - ${sig.signer_name} (${sig.signer_type}): ${sig.signer_email}`);
        });
      }
    } else {
      console.log('  No signatures found');
    }

    console.log('  ---');
  }

  console.log('\n=== END INVESTIGATION ===');
}

checkAgreements();
