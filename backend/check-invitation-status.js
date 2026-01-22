const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'base64') : null;

function decrypt(encryptedText) {
  if (!encryptedText || !ENCRYPTION_KEY) return null;
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    return null;
  }
}

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  const refId = 'b00302e6-dc23-4637-99c5-4c5e3f38d0cc';

  console.log('🔍 Checking invitation and status for reference\n');
  console.log('='.repeat(80));
  console.log('');

  // Get reference
  const { data: ref, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', refId)
    .single();

  if (refError) {
    console.error('❌ Error:', refError);
    return;
  }

  console.log('📋 REFERENCE STATUS:\n');
  console.log(`Current Status: ${ref.status}`);
  console.log(`Should be: "pending" (waiting for tenant to submit)`);
  console.log(`Verification State: ${ref.verification_state || 'N/A'}`);
  console.log(`Submitted At: ${ref.submitted_at || 'NOT SUBMITTED'}`);
  console.log(`Created: ${ref.created_at}`);
  console.log('');

  // Check for invitations
  const { data: invitations, error: invError } = await supabase
    .from('invitations')
    .select('*')
    .eq('reference_id', refId)
    .order('created_at', { ascending: false });

  if (invError) {
    console.error('❌ Error fetching invitations:', invError);
  } else if (invitations && invitations.length > 0) {
    console.log('📧 INVITATIONS FOUND:\n');
    invitations.forEach((inv, i) => {
      const email = decrypt(inv.email_encrypted) || inv.email;
      console.log(`${i + 1}. Invitation ID: ${inv.id}`);
      console.log(`   Email: ${email}`);
      console.log(`   Status: ${inv.status}`);
      console.log(`   Sent At: ${inv.sent_at || 'Not sent'}`);
      console.log(`   Accepted At: ${inv.accepted_at || 'Not accepted'}`);
      console.log(`   Expires At: ${inv.expires_at}`);
      console.log(`   Created: ${inv.created_at}`);
      console.log('');
    });
  } else {
    console.log('📧 No invitations found in database\n');
  }

  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  if (ref.status === 'in_progress') {
    console.log('❌ ISSUE: Reference status is "in_progress"');
    console.log('');
    console.log('Expected flow:');
    console.log('1. Reference created → status: "pending"');
    console.log('2. Invitation sent → status: "pending" (waiting for tenant)');
    console.log('3. Tenant submits form → status: "in_progress" (ready for verification)');
    console.log('');
    console.log('Current situation:');
    console.log('- Status is "in_progress" BUT tenant has NOT submitted');
    console.log('- This suggests the status was incorrectly set to "in_progress"');
    console.log('');

    if (invitations && invitations.some(i => i.status === 'sent')) {
      console.log('✅ Invitation was sent (confirmed in Resend)');
      console.log('');
      console.log('🔧 FIX NEEDED:');
      console.log('The reference status should be changed from "in_progress" back to "pending"');
      console.log('to correctly reflect that we are waiting for the tenant to submit the form.');
    } else if (!invitations || invitations.length === 0) {
      console.log('⚠️  No invitation record found in database');
      console.log('   But you confirmed it was sent in Resend');
      console.log('   The invitation may have been sent but not recorded in the database');
    }
  }

  console.log('');
})();
