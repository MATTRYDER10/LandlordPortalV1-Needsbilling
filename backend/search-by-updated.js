const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
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
  console.log('Searching all references for Dongola...\n');

  let found = false;
  let offset = 0;
  const limit = 100;

  while (!found) {
    const { data: refs } = await supabase
      .from('tenant_references')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (!refs || refs.length === 0) {
      console.log('No more references to search');
      break;
    }

    console.log('Checking', offset, 'to', offset + refs.length);

    for (const ref of refs) {
      const address = decrypt(ref.property_address_encrypted) || ref.property_address || '';
      if (address.toLowerCase().includes('dongola')) {
        console.log('\n*** FOUND DONGOLA REFERENCE ***\n');
        console.log('ID:', ref.id);
        console.log('Address:', address);
        console.log('Status:', ref.status);
        console.log('Verification State:', ref.verification_state);
        console.log('Created:', ref.created_at);
        console.log('Updated:', ref.updated_at);
        console.log('Company ID:', ref.company_id);
        
        const firstName = decrypt(ref.tenant_first_name_encrypted) || '';
        const lastName = decrypt(ref.tenant_last_name_encrypted) || '';
        console.log('Tenant:', firstName, lastName);
        
        found = true;
      }
    }

    if (found) break;
    offset += limit;
    
    if (offset > 1000) {
      console.log('Searched 1000 references, stopping');
      break;
    }
  }

  if (!found) {
    console.log('\nDongola reference not found in recent references');
    console.log('Checking if it might have been deleted...\n');
    
    // Check for references with many guarantors recently
    const { data: multiGuarantor } = await supabase
      .from('tenant_references')
      .select('id, created_at')
      .not('guarantor_reference_id', 'is', null)
      .gte('created_at', '2026-01-01')
      .order('created_at', { ascending: false });
    
    if (multiGuarantor) {
      const refCounts = {};
      for (const g of multiGuarantor) {
        const mainRefId = g.guarantor_reference_id;
        refCounts[mainRefId] = (refCounts[mainRefId] || 0) + 1;
      }
      
      console.log('References with multiple guarantors:');
      for (const [refId, count] of Object.entries(refCounts)) {
        if (count >= 4) {
          console.log(' -', refId.substring(0, 8) + '...', 'has', count, 'guarantors');
        }
      }
    }
  }
})();
