import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { decrypt } from '../services/encryption';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkChaseDependencies() {
  console.log('=== CHECKING CHASE_DEPENDENCIES TABLE ===\n');

  // Check for any active chase dependencies
  const { data: deps } = await supabase
    .from('chase_dependencies')
    .select(`
      *,
      reference:tenant_references!chase_dependencies_reference_id_fkey (
        id,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        verification_state,
        status
      )
    `)
    .in('status', ['PENDING', 'CHASING', 'ACTION_REQUIRED'])
    .order('created_at', { ascending: false });

  console.log(`Found ${deps?.length || 0} active chase dependencies\n`);

  if (!deps || deps.length === 0) {
    console.log('✅ NO ACTIVE CHASE DEPENDENCIES\n');
    return;
  }

  deps.forEach((dep: any, index: number) => {
    const firstName = decrypt(dep.reference?.tenant_first_name_encrypted);
    const lastName = decrypt(dep.reference?.tenant_last_name_encrypted);

    console.log(`${index + 1}. ${firstName} ${lastName}`);
    console.log(`   Dependency Type: ${dep.dependency_type}`);
    console.log(`   Status: ${dep.status}`);
    console.log(`   Reference ID: ${dep.reference_id}`);
    console.log(`   Reference State: ${dep.reference?.verification_state || 'null'}`);
    console.log(`   Created: ${new Date(dep.created_at).toLocaleString()}`);
    console.log(`   Email attempts: ${dep.email_attempts || 0}`);
    console.log(`   Last contacted: ${dep.last_contacted_at ? new Date(dep.last_contacted_at).toLocaleString() : 'NEVER'}`);
    console.log('');
  });

  console.log('\n=== END CHECK ===');
}

checkChaseDependencies();
