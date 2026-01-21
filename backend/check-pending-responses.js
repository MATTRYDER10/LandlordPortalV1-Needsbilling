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
  console.log('🔍 CHECKING ALL PENDING RESPONSES (CHASE STATUS)\n');
  console.log('='.repeat(80));
  console.log('');

  // Get all chase_dependencies that are in CHASING status
  const { data: dependencies, error: depsError } = await supabase
    .from('chase_dependencies')
    .select(`
      id,
      reference_id,
      dependency_type,
      status,
      created_at,
      last_chase_sent_at,
      reference:tenant_references!chase_dependencies_reference_id_fkey (
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        property_address_encrypted,
        employer_ref_name_encrypted,
        employer_ref_email_encrypted,
        previous_landlord_name_encrypted,
        previous_landlord_email_encrypted,
        reference_type,
        accountant_name_encrypted,
        accountant_email_encrypted,
        company:companies(name_encrypted)
      )
    `)
    .eq('status', 'CHASING')
    .order('created_at', { ascending: false });

  if (depsError) {
    console.error('Error fetching dependencies:', depsError);
    return;
  }

  console.log(`Found ${dependencies.length} items in CHASING status (Pending Responses)\n`);

  let checkedCount = 0;
  let needsUpdateCount = 0;
  const updates = [];

  for (const dep of dependencies) {
    checkedCount++;

    const tenantFirstName = decrypt(dep.reference.tenant_first_name_encrypted) || '';
    const tenantLastName = decrypt(dep.reference.tenant_last_name_encrypted) || '';
    const tenantName = `${tenantFirstName} ${tenantLastName}`.trim();
    const propertyAddress = decrypt(dep.reference.property_address_encrypted) || 'N/A';
    const companyName = decrypt(dep.reference.company?.name_encrypted) || 'N/A';

    console.log(`[${checkedCount}/${dependencies.length}] ${dep.dependency_type}`);
    console.log(`    Tenant: ${tenantName}`);
    console.log(`    Property: ${propertyAddress}`);
    console.log(`    Company: ${companyName}`);
    console.log(`    Dependency ID: ${dep.id}`);
    console.log(`    Reference ID: ${dep.reference_id}`);
    console.log(`    Last Chase Sent: ${dep.last_chase_sent_at || 'Never'}`);

    // Check actual submission status based on dependency type
    let actuallySubmitted = false;
    let submissionDetails = '';
    let submittedRefs = [];

    if (dep.dependency_type === 'EMPLOYER_REF') {
      // Check employer_references table
      const { data: employerRefs } = await supabase
        .from('employer_references')
        .select('id, submitted_at, company_name_encrypted, signature_encrypted, employer_email_encrypted')
        .eq('reference_id', dep.reference_id);

      if (employerRefs && employerRefs.length > 0) {
        submittedRefs = employerRefs.filter(ref => ref.submitted_at);
        if (submittedRefs.length > 0) {
          actuallySubmitted = true;
          submissionDetails = `${submittedRefs.length}/${employerRefs.length} employer reference(s) submitted`;
          console.log(`    ✅ SUBMITTED: ${submissionDetails}`);
          submittedRefs.forEach(ref => {
            const email = decrypt(ref.employer_email_encrypted);
            console.log(`       - Submitted at ${ref.submitted_at} (${email})`);
          });
        } else {
          console.log(`    ⏳ PENDING: ${employerRefs.length} employer reference(s) sent but not submitted yet`);
        }
      } else {
        console.log(`    ❌ NOT SENT: No employer references found in database`);
      }
    } else if (dep.dependency_type === 'RESIDENTIAL_REF') {
      // Check if it's landlord or agent
      const isAgent = dep.reference.reference_type === 'agent';

      if (isAgent) {
        // Check agent_references table
        const { data: agentRefs } = await supabase
          .from('agent_references')
          .select('id, submitted_at')
          .eq('reference_id', dep.reference_id);

        if (agentRefs && agentRefs.length > 0) {
          submittedRefs = agentRefs.filter(ref => ref.submitted_at);
          if (submittedRefs.length > 0) {
            actuallySubmitted = true;
            submissionDetails = `${submittedRefs.length}/${agentRefs.length} agent reference(s) submitted`;
            console.log(`    ✅ SUBMITTED: ${submissionDetails}`);
            submittedRefs.forEach(ref => {
              console.log(`       - Submitted at ${ref.submitted_at}`);
            });
          } else {
            console.log(`    ⏳ PENDING: ${agentRefs.length} agent reference(s) sent but not submitted yet`);
          }
        } else {
          console.log(`    ❌ NOT SENT: No agent references found in database`);
        }
      } else {
        // Check landlord_references table
        const { data: landlordRefs } = await supabase
          .from('landlord_references')
          .select('id, submitted_at')
          .eq('reference_id', dep.reference_id);

        if (landlordRefs && landlordRefs.length > 0) {
          submittedRefs = landlordRefs.filter(ref => ref.submitted_at);
          if (submittedRefs.length > 0) {
            actuallySubmitted = true;
            submissionDetails = `${submittedRefs.length}/${landlordRefs.length} landlord reference(s) submitted`;
            console.log(`    ✅ SUBMITTED: ${submissionDetails}`);
            submittedRefs.forEach(ref => {
              console.log(`       - Submitted at ${ref.submitted_at}`);
            });
          } else {
            console.log(`    ⏳ PENDING: ${landlordRefs.length} landlord reference(s) sent but not submitted yet`);
          }
        } else {
          console.log(`    ❌ NOT SENT: No landlord references found in database`);
        }
      }
    } else if (dep.dependency_type === 'ACCOUNTANT_REF') {
      // Check accountant_references table
      const { data: accountantRefs } = await supabase
        .from('accountant_references')
        .select('id, submitted_at, accountant_name_encrypted, accountant_email_encrypted')
        .eq('tenant_reference_id', dep.reference_id);

      if (accountantRefs && accountantRefs.length > 0) {
        submittedRefs = accountantRefs.filter(ref => ref.submitted_at);
        if (submittedRefs.length > 0) {
          actuallySubmitted = true;
          submissionDetails = `${submittedRefs.length}/${accountantRefs.length} accountant reference(s) submitted`;
          console.log(`    ✅ SUBMITTED: ${submissionDetails}`);
          submittedRefs.forEach(ref => {
            const name = decrypt(ref.accountant_name_encrypted);
            const email = decrypt(ref.accountant_email_encrypted);
            console.log(`       - Submitted at ${ref.submitted_at} (${name} - ${email})`);
          });
        } else {
          console.log(`    ⏳ PENDING: ${accountantRefs.length} accountant reference(s) sent but not submitted yet`);
        }
      } else {
        console.log(`    ❌ NOT SENT: No accountant references found in database`);
      }
    }

    // If actually submitted, mark for update
    if (actuallySubmitted) {
      needsUpdateCount++;
      updates.push({
        dependencyId: dep.id,
        dependencyType: dep.dependency_type,
        referenceId: dep.reference_id,
        tenantName,
        submissionDetails,
        submittedAt: submittedRefs[0]?.submitted_at
      });
      console.log(`    🔄 NEEDS UPDATE: Should be marked as RECEIVED`);
    }

    console.log('');
  }

  console.log('='.repeat(80));
  console.log('\n📊 SUMMARY\n');
  console.log(`Total dependencies checked: ${checkedCount}`);
  console.log(`Dependencies actually submitted: ${needsUpdateCount}`);
  console.log(`Still pending response: ${checkedCount - needsUpdateCount}`);
  console.log('');

  if (updates.length > 0) {
    console.log('⚠️  DEPENDENCIES THAT NEED TO BE UPDATED:\n');
    updates.forEach((update, i) => {
      console.log(`${i + 1}. ${update.dependencyType} - ${update.tenantName}`);
      console.log(`   Status: ${update.submissionDetails}`);
      console.log(`   Submitted: ${update.submittedAt}`);
      console.log(`   Dependency ID: ${update.dependencyId}`);
      console.log(`   Reference ID: ${update.referenceId}`);
      console.log('');
    });

    console.log('🔧 UPDATING NOW...\n');

    // Update each dependency to RECEIVED status
    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
      const { error } = await supabase
        .from('chase_dependencies')
        .update({
          status: 'RECEIVED'
        })
        .eq('id', update.dependencyId);

      if (error) {
        console.error(`❌ Failed to update ${update.dependencyType} for ${update.tenantName}:`, error.message);
        failCount++;
      } else {
        console.log(`✅ Updated ${update.dependencyType} for ${update.tenantName} to RECEIVED`);
        successCount++;
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log(`\n✅ Update complete: ${successCount} updated, ${failCount} failed\n`);
  } else {
    console.log('✅ All dependencies in CHASING status are correctly pending (not yet submitted).\n');
  }
})();
