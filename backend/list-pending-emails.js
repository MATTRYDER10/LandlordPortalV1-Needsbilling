const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function decrypt(encryptedText) {
  if (!encryptedText) return null;
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
  const { data } = await supabase
    .from('verification_sections')
    .select('id, section_type, contact_email_encrypted, reference_id')
    .in('section_type', ['EMPLOYER_REFERENCE', 'LANDLORD_REFERENCE', 'ACCOUNTANT_REFERENCE', 'AGENT_REFERENCE'])
    .eq('decision', 'NOT_REVIEWED');

  const emails = data
    .map(d => ({
      id: d.id,
      refId: d.reference_id,
      sectionType: d.section_type,
      email: decrypt(d.contact_email_encrypted)
    }))
    .filter(d => d.email)
    .sort((a, b) => a.email.localeCompare(b.email));

  console.log(`Total pending sections: ${emails.length}\n`);

  emails.forEach((item, i) => {
    console.log(`${i + 1}. ${item.email} (${item.sectionType}) - Ref: ${item.refId}, Section: ${item.id}`);
  });

  // Look for any with "south" or "brook"
  const matches = emails.filter(item =>
    item.email.toLowerCase().includes('south') ||
    item.email.toLowerCase().includes('brook') ||
    item.email.toLowerCase().includes('property')
  );

  if (matches.length > 0) {
    console.log(`\n\nFound ${matches.length} matches with 'south', 'brook', or 'property':`);
    matches.forEach(item => {
      console.log(`  - ${item.email} (${item.sectionType}) - Ref: ${item.refId}`);
    });
  }
})();
