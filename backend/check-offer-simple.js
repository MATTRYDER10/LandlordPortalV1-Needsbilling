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

  console.log('🔍 Checking if reference was created from an offer\n');
  console.log('='.repeat(80));
  console.log('');

  // Find offers that link to this reference
  const { data: offers, error: offerError } = await supabase
    .from('tenant_offers')
    .select('*')
    .eq('reference_id', refId);

  if (offerError) {
    console.error('❌ Error fetching offers:', offerError);
    return;
  }

  if (offers && offers.length > 0) {
    console.log(`✅ Found ${offers.length} offer(s) linked to this reference:\n`);

    offers.forEach((offer, i) => {
      const propertyAddress = decrypt(offer.property_address_encrypted);
      const specialConditions = decrypt(offer.special_conditions_encrypted);

      console.log(`${i + 1}. Offer ID: ${offer.id}`);
      console.log(`   Status: ${offer.status}`);
      console.log(`   Property: ${propertyAddress || 'N/A'}`);
      console.log(`   Rent: £${offer.offered_rent_amount}`);
      console.log(`   Move-in Date: ${offer.proposed_move_in_date}`);
      console.log(`   Tenancy Length: ${offer.proposed_tenancy_length_months} months`);
      console.log(`   Created: ${offer.created_at}`);
      console.log('');
    });
  } else {
    console.log('❌ No offers found linking to this reference\n');
  }

  // Check the reference itself
  const { data: ref, error: refError } = await supabase
    .from('tenant_references')
    .select('*')
    .eq('id', refId)
    .single();

  if (refError) {
    console.error('❌ Error fetching reference:', refError);
    return;
  }

  console.log('📋 REFERENCE DETAILS:\n');

  const firstName = decrypt(ref.tenant_first_name_encrypted) || ref.tenant_first_name;
  const lastName = decrypt(ref.tenant_last_name_encrypted) || ref.tenant_last_name;
  const email = decrypt(ref.tenant_email_encrypted) || ref.tenant_email;
  const phone = decrypt(ref.tenant_phone_encrypted) || ref.tenant_phone;
  const propertyAddress = decrypt(ref.property_address_encrypted) || ref.property_address;

  console.log(`Tenant Name: ${firstName || 'N/A'} ${lastName || 'N/A'}`);
  console.log(`Email: ${email || 'N/A'}`);
  console.log(`Phone: ${phone || 'N/A'}`);
  console.log(`Property: ${propertyAddress || 'N/A'}`);
  console.log(`Status: ${ref.status}`);
  console.log(`Submitted: ${ref.submitted_at || '❌ NOT SUBMITTED'}`);
  console.log('');

  console.log('='.repeat(80));
  console.log('\n🔍 DIAGNOSIS:\n');

  if (!firstName && !email) {
    console.log('❌ PROBLEM: Reference has NO tenant contact information');
    console.log('');

    if (offers && offers.length > 0) {
      console.log('The reference was created from an offer, but tenant details');
      console.log('were not populated in the reference record.');
      console.log('');
      console.log('POSSIBLE CAUSES:');
      console.log('1. The offer was created without tenant information initially');
      console.log('2. Bug in the "Create Reference" flow from the offers tab');
      console.log('3. The reference was created before the offer was fully filled out');
    } else {
      console.log('No linked offer found - cannot determine how this reference was created');
    }
  }

  if (!ref.submitted_at) {
    console.log('\n❌ Tenant has not submitted the reference form');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Check if tenant contact info exists anywhere');
    console.log('2. If yes, update the reference with correct tenant details');
    console.log('3. Resend invitation email to tenant');
    console.log('4. If no contact info, request it from the agent/landlord');
  }

  console.log('');
})();
