import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSignatures() {
  console.log('=== AGREEMENT SIGNATURES INVESTIGATION ===\n');

  // 1. Check agreements in pending_signatures status
  console.log('1. Agreements in pending_signatures status:');
  const { data: agreements } = await supabase
    .from('tenancy_agreements')
    .select('id, property_id, status, created_at')
    .eq('status', 'pending_signatures')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`   Found ${agreements?.length || 0} agreements in pending_signatures\n`);

  if (agreements && agreements.length > 0) {
    for (const agreement of agreements) {
      console.log(`   Agreement ${agreement.id}:`);
      console.log(`   - Created: ${agreement.created_at}`);

      // Check signatures for this agreement
      const { data: signatures } = await supabase
        .from('agreement_signatures')
        .select('*')
        .eq('agreement_id', agreement.id)
        .order('created_at', { ascending: true });

      if (signatures && signatures.length > 0) {
        console.log(`   - Total signatures: ${signatures.length}`);

        const pending = signatures.filter(s => s.status === 'pending');
        const sent = signatures.filter(s => s.status === 'sent');
        const signed = signatures.filter(s => s.status === 'signed');

        console.log(`     - Pending: ${pending.length}`);
        console.log(`     - Sent: ${sent.length}`);
        console.log(`     - Signed: ${signed.length}`);

        if (pending.length > 0) {
          console.log(`     Pending signatures (email not sent):`);
          pending.forEach(sig => {
            const daysSinceCreated = Math.floor(
              (Date.now() - new Date(sig.created_at).getTime()) / (1000 * 60 * 60 * 24)
            );
            console.log(`       - ${sig.signer_name} (${sig.signer_type}): ${sig.signer_email}`);
            console.log(`         Created ${daysSinceCreated} days ago, email_send_count: ${sig.email_send_count}`);
          });
        }

        if (sent.length > 0) {
          console.log(`     Sent signatures (awaiting signature):`);
          sent.forEach(sig => {
            const lastSent = sig.last_email_sent_at
              ? new Date(sig.last_email_sent_at).toLocaleString()
              : 'never';
            console.log(`       - ${sig.signer_name} (${sig.signer_type}): ${sig.signer_email}`);
            console.log(`         Last sent: ${lastSent}, send count: ${sig.email_send_count}`);
          });
        }
      } else {
        console.log(`   - No signatures found`);
      }
      console.log('');
    }
  }

  // 2. Check for signatures in 'pending' status across all agreements
  console.log('\n2. All signatures in pending status (never emailed):');
  const { data: allPending } = await supabase
    .from('agreement_signatures')
    .select(`
      *,
      agreement:tenancy_agreements!agreement_signatures_agreement_id_fkey (
        id,
        status,
        created_at
      )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  console.log(`   Found ${allPending?.length || 0} signatures in pending status\n`);

  if (allPending && allPending.length > 0) {
    const byAgreement = allPending.reduce((acc: any, sig: any) => {
      const agreementId = sig.agreement_id;
      if (!acc[agreementId]) {
        acc[agreementId] = [];
      }
      acc[agreementId].push(sig);
      return acc;
    }, {});

    console.log(`   Grouped by agreement (${Object.keys(byAgreement).length} agreements):`);
    for (const [agreementId, sigs] of Object.entries(byAgreement) as any) {
      const sigList = sigs as any[];
      console.log(`     Agreement ${agreementId}: ${sigList.length} pending signatures`);
      sigList.forEach((sig: any) => {
        console.log(`       - ${sig.signer_name} (${sig.signer_type}): ${sig.signer_email}`);
      });
    }
  }

  console.log('\n=== END INVESTIGATION ===');
}

checkSignatures();
