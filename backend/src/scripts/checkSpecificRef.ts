import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRef() {
  const refId = 'a1b2b039-aa02-4c79-9978-c78d35c0f614';

  const { data: ref } = await supabase
    .from('tenant_references')
    .select('id, status, verification_state, created_at, updated_at')
    .eq('id', refId)
    .single();

  console.log('Reference:', ref);
  console.log('');

  const { data: sections } = await supabase
    .from('verification_sections')
    .select('*')
    .eq('reference_id', refId);

  console.log(`Verification sections (${sections?.length || 0}):`);
  sections?.forEach(s => {
    console.log(`  - ${s.section_type}: decision=${s.decision}, initial_sent=${s.initial_request_sent_at}`);
  });
}

checkRef();
