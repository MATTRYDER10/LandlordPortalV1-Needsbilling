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

  console.log('🔍 Checking offer and tenant details for reference\n');
  console.log('='.repeat(80));
  console.log('');

  // Get reference with offer details
  const { data: ref, error: refError } = await supabase
    .from('tenant_references')
    .select(`
      *,
      tenant_offer:tenant_offers(
        id,
        status,
        tenant_first_name,
        tenant_last_name,
        tenant_email,
        tenant_phone,
        property_address,
        monthly_rent,
        move_in_date,
        created_at
      )
    `)
    .eq('id', refId)
    .single();

  if (refError) {
    console.error('❌ Error fetching reference:', refError);
    return;
  }

  console.log('📋 REFERENCE INFO:\n');
  console.log(`Reference ID: ${ref.id}`);
  console.log(`Status: ${ref.status}`);
  console.log(`Verification State: ${ref.verification_state || 'N/A'}`);
  console.log(`Created: ${ref.created_at}`);
  console.log(`Submitted: ${ref.submitted_at || '❌ NOT SUBMITTED'}`);
  console.log('');

  // Check if linked to an offer
  if (ref.tenant_offer && ref.tenant_offer.length > 0) {
    const offer = ref.tenant_offer[0];

    console.log('🏠 LINKED TENANT OFFER:\n');
    console.log(`Offer ID: ${offer.id}`);
    console.log(`Offer Status: ${offer.status}`);
    console.log(`Created: ${offer.created_at}`);
    console.log('');

    console.log('👤 TENANT INFO (from offer):\n');
    console.log(`Name: ${offer.tenant_first_name || 'N/A'} ${offer.tenant_last_name || 'N/A'}`);
    console.log(`Email: ${offer.tenant_email || 'N/A'}`);
    console.log(`Phone: ${offer.tenant_phone || 'N/A'}`);
    console.log('');

    console.log('🏠 PROPERTY INFO:\n');
    console.log(`Address: ${offer.property_address || 'N/A'}`);
    console.log(`Monthly Rent: £${offer.monthly_rent || 'N/A'}`);
    console.log(`Move-in Date: ${offer.move_in_date || 'N/A'}`);
    console.log('');
  } else {
    console.log('⚠️  No linked tenant offer found\n');
  }

  // Check reference data
  const refFirstName = decrypt(ref.tenant_first_name_encrypted) || ref.tenant_first_name;
  const refLastName = decrypt(ref.tenant_last_name_encrypted) || ref.tenant_last_name;
  const refEmail = decrypt(ref.tenant_email_encrypted) || ref.tenant_email;
  const refPhone = decrypt(ref.tenant_phone_encrypted) || ref.tenant_phone;
  const refProperty = decrypt(ref.property_address_encrypted) || ref.property_address;

  console.log('📝 REFERENCE DATA (should be copied from offer):\n');
  console.log(`Name: ${refFirstName || '❌ MISSING'} ${refLastName || '❌ MISSING'}`);
  console.log(`Email: ${refEmail || '❌ MISSING'}`);
  console.log(`Phone: ${refPhone || '❌ MISSING'}`);
  console.log(`Property: ${refProperty || '❌ MISSING'}`);
  console.log('');

  // Check invitations
  const { data: invites, error: inviteError } = await supabase
    .from('invitations')
    .select('*')
    .eq('reference_id', refId)
    .order('created_at', { ascending: false });

  if (!inviteError && invites && invites.length > 0) {
    console.log('📧 INVITATIONS:\n');
    invites.forEach((invite, i) => {
      const inviteEmail = decrypt(invite.email_encrypted) || invite.email;
      console.log(`${i + 1}. Status: ${invite.status}`);
      console.log(`   Email: ${inviteEmail || 'N/A'}`);
      console.log(`   Sent: ${invite.sent_at || 'Not sent'}`);
      console.log(`   Accepted: ${invite.accepted_at || 'Not accepted'}`);
      console.log(`   Expires: ${invite.expires_at || 'N/A'}`);
      console.log('');
    });
  } else {
    console.log('📧 No invitations found\n');
  }

  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  if (ref.tenant_offer && ref.tenant_offer.length > 0) {
    const offer = ref.tenant_offer[0];

    if (!refFirstName && !refEmail) {
      console.log('❌ PROBLEM: Reference was created from offer but tenant details were NOT copied over');
      console.log('');
      console.log('The offer has:');
      console.log(`  Name: ${offer.tenant_first_name} ${offer.tenant_last_name}`);
      console.log(`  Email: ${offer.tenant_email}`);
      console.log(`  Phone: ${offer.tenant_phone}`);
      console.log('');
      console.log('But the reference has:');
      console.log(`  Name: ${refFirstName || 'MISSING'} ${refLastName || 'MISSING'}`);
      console.log(`  Email: ${refEmail || 'MISSING'}`);
      console.log(`  Phone: ${refPhone || 'MISSING'}`);
      console.log('');
      console.log('⚠️  This is likely a bug in the offer → reference creation process');
      console.log('');
      console.log('SOLUTION: The reference needs to have tenant details populated from the offer');
    }
  } else {
    console.log('❌ PROBLEM: Reference is not linked to a tenant offer');
    console.log('   Cannot determine original tenant details');
  }

  if (!invites || invites.length === 0) {
    console.log('⚠️  No invitation has been sent to the tenant');
    console.log('   The tenant cannot access their reference form without an invitation');
  } else if (invites.some(i => i.status === 'sent' || i.status === 'accepted')) {
    console.log('✅ Invitation was sent, but tenant has not submitted the form yet');
  }

  console.log('');
})();
