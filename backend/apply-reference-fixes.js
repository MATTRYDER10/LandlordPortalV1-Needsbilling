const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔧 APPLYING REFERENCE FIXES\n');
  console.log('='.repeat(80));
  console.log('');

  // Load fixes from file
  const fixesPath = path.join(__dirname, 'reference-fixes.json');

  if (!fs.existsSync(fixesPath)) {
    console.error('❌ No fixes file found. Run validate-all-references.js first.\n');
    return;
  }

  const fixes = JSON.parse(fs.readFileSync(fixesPath, 'utf-8'));

  if (fixes.length === 0) {
    console.log('✅ No fixes to apply - all references are valid!\n');
    return;
  }

  console.log(`📋 Found ${fixes.length} reference(s) to fix\n`);
  console.log('='.repeat(80));
  console.log('');

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < fixes.length; i++) {
    const fix = fixes[i];
    const refId = fix.id.substring(0, 8);

    console.log(`\n${i + 1}. Fixing reference: ${refId}...`);

    const updates = {};
    if (fix.status) {
      updates.status = fix.status;
      console.log(`   - Setting status to: ${fix.status}`);
    }
    if (fix.verification_state !== undefined) {
      updates.verification_state = fix.verification_state;
      console.log(`   - Setting verification_state to: ${fix.verification_state || 'NULL'}`);
    }

    const { error } = await supabase
      .from('tenant_references')
      .update(updates)
      .eq('id', fix.id);

    if (error) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    } else {
      console.log(`   ✅ Fixed successfully`);
      successCount++;
    }
  }

  console.log('\n');
  console.log('='.repeat(80));
  console.log('\n📊 RESULTS:\n');
  console.log(`✅ Successfully fixed: ${successCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  console.log('');
  console.log('='.repeat(80));
  console.log('');

  // Delete fixes file after applying
  if (successCount > 0) {
    fs.unlinkSync(fixesPath);
    console.log('🗑️  Fixes file deleted\n');
  }
})();
