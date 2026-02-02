import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRecentAgreements() {
  console.log('=== RECENT AGREEMENTS INVESTIGATION ===\n');

  // Check recent agreements (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: agreements } = await supabase
    .from('tenancy_agreements')
    .select('id, property_id, status, created_at')
    .gte('created_at', sevenDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  console.log(`Found ${agreements?.length || 0} agreements created in the last 7 days\n`);

  if (agreements && agreements.length > 0) {
    for (const agreement of agreements) {
      console.log(`Agreement ${agreement.id}:`);
      console.log(`  Status: ${agreement.status}`);
      console.log(`  Created: ${new Date(agreement.created_at).toLocaleString()}`);

      // Get all signatures for this agreement
      const { data: signatures } = await supabase
        .from('agreement_signatures')
        .select('*')
        .eq('agreement_id', agreement.id)
        .order('created_at', { ascending: true });

      if (signatures && signatures.length > 0) {
        console.log(`  Signatures (${signatures.length} total):`);

        // Group by signer type
        const tenants = signatures.filter(s => s.signer_type === 'tenant');
        const landlords = signatures.filter(s => s.signer_type === 'landlord');
        const guarantors = signatures.filter(s => s.signer_type === 'guarantor');

        if (tenants.length > 0) {
          console.log(`    Tenants (${tenants.length}):`);
          tenants.forEach(sig => {
            console.log(`      - ${sig.signer_name}: status=${sig.status}, email_count=${sig.email_send_count}, last_sent=${sig.last_email_sent_at || 'never'}`);
          });
        }

        if (landlords.length > 0) {
          console.log(`    Landlords (${landlords.length}):`);
          landlords.forEach(sig => {
            console.log(`      - ${sig.signer_name}: status=${sig.status}, email_count=${sig.email_send_count}, last_sent=${sig.last_email_sent_at || 'never'}`);
          });
        }

        if (guarantors.length > 0) {
          console.log(`    Guarantors (${guarantors.length}):`);
          guarantors.forEach(sig => {
            console.log(`      - ${sig.signer_name}: status=${sig.status}, email_count=${sig.email_send_count}, last_sent=${sig.last_email_sent_at || 'never'}`);
          });
        }

        // Check for anomalies
        const sentButNoEmail = signatures.filter(
          s => s.status === 'sent' && s.email_send_count === 0
        );
        const pendingWithHighCount = signatures.filter(
          s => s.status === 'pending' && s.email_send_count > 0
        );

        if (sentButNoEmail.length > 0) {
          console.log(`  ⚠️  ANOMALY: ${sentButNoEmail.length} signatures marked 'sent' but email_send_count is 0`);
        }

        if (pendingWithHighCount.length > 0) {
          console.log(`  ⚠️  ANOMALY: ${pendingWithHighCount.length} signatures marked 'pending' but email_send_count > 0`);
        }

        // Check for partial sends (some sent, some pending for same agreement)
        const pendingCount = signatures.filter(s => s.status === 'pending').length;
        const sentCount = signatures.filter(s => s.status === 'sent').length;
        const signedCount = signatures.filter(s => s.status === 'signed').length;

        if (pendingCount > 0 && sentCount > 0) {
          console.log(`  ⚠️  PARTIAL SEND: ${pendingCount} pending, ${sentCount} sent, ${signedCount} signed`);
        }
      } else {
        console.log(`  No signatures found`);
      }

      console.log('');
    }
  }

  // Check for signature events (logs)
  console.log('\n=== SIGNATURE EVENT LOGS (last 50) ===\n');
  const { data: events } = await supabase
    .from('agreement_signature_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (events && events.length > 0) {
    const eventsByAgreement = events.reduce((acc: any, event: any) => {
      if (!acc[event.agreement_id]) {
        acc[event.agreement_id] = [];
      }
      acc[event.agreement_id].push(event);
      return acc;
    }, {});

    console.log(`Found ${events.length} events across ${Object.keys(eventsByAgreement).length} agreements\n`);

    for (const [agreementId, eventList] of Object.entries(eventsByAgreement) as any) {
      const events = eventList as any[];
      console.log(`  Agreement ${agreementId}:`);

      const emailSentEvents = events.filter((e: any) => e.event_type === 'email_sent');
      const signedEvents = events.filter((e: any) => e.event_type === 'signed');

      console.log(`    - email_sent events: ${emailSentEvents.length}`);
      console.log(`    - signed events: ${signedEvents.length}`);

      if (emailSentEvents.length > 0) {
        const recentEmailSent = emailSentEvents[0];
        console.log(`    - Most recent email sent: ${new Date(recentEmailSent.created_at).toLocaleString()}`);
      }
    }
  } else {
    console.log('No signature events found');
  }

  console.log('\n=== END INVESTIGATION ===');
}

checkRecentAgreements();
