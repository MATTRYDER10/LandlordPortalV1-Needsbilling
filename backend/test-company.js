const { supabase } = require('./dist/config/supabase');

(async () => {
  const companyId = 'cbeb33ea-d601-4ddb-8964-9d832d289ba1';

  console.log('Checking company data...\n');

  const { data, error } = await supabase
    .from('companies')
    .select('id, name_encrypted, email_encrypted, phone_encrypted, stripe_customer_id')
    .eq('id', companyId)
    .single();

  if (error) {
    console.error('ERROR:', error.message);
  } else {
    console.log('Company data:');
    console.log('- ID:', data.id);
    console.log('- name_encrypted:', data.name_encrypted ? 'EXISTS' : 'NULL');
    console.log('- email_encrypted:', data.email_encrypted ? 'EXISTS' : 'NULL');
    console.log('- phone_encrypted:', data.phone_encrypted ? 'EXISTS' : 'NULL');
    console.log('- stripe_customer_id:', data.stripe_customer_id || 'NULL');

    if (data.name_encrypted || data.email_encrypted) {
      const { decrypt } = require('./dist/services/encryption');
      if (data.name_encrypted) {
        try {
          const name = decrypt(data.name_encrypted);
          console.log('- Decrypted name:', name || 'FAILED TO DECRYPT');
        } catch (e) {
          console.log('- Decrypted name: ERROR -', e.message);
        }
      }
      if (data.email_encrypted) {
        try {
          const email = decrypt(data.email_encrypted);
          console.log('- Decrypted email:', email || 'FAILED TO DECRYPT');
        } catch (e) {
          console.log('- Decrypted email: ERROR -', e.message);
        }
      }
    }
  }

  process.exit(0);
})();
