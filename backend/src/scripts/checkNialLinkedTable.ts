import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkLinkedTable() {
  const referenceId = 'd0d15d1b-83d8-4af4-96e0-5ba343e6d8d7';

  const { data: deps } = await supabase
    .from('chase_dependencies')
    .select('*')
    .eq('reference_id', referenceId);

  console.log('Chase dependencies for Nial Prince:\n');
  deps?.forEach(d => {
    console.log(`Dependency Type: ${d.dependency_type}`);
    console.log(`Linked Table: ${d.linked_table || 'NULL'}`);
    console.log(`Status: ${d.status}`);
    console.log('');
  });
}

checkLinkedTable();
