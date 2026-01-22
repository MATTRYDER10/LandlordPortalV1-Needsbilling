const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 CHECKING ALL VERIFICATION STATES\n');
  console.log('='.repeat(80));
  console.log('');

  // Get all references that are NOT completed/rejected/cancelled
  const { data: references, error } = await supabase
    .from('tenant_references')
    .select('id, status, submitted_at, verification_state')
    .not('status', 'in', '(completed,rejected,cancelled)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching references:', error);
    return;
  }

  console.log(`📊 Found ${references.length} active references\n`);
  console.log('='.repeat(80));
  console.log('');

  const issues = [];

  for (const ref of references) {
    const refId = ref.id.substring(0, 8);
    const hasSubmitted = !!ref.submitted_at;

    // Issue: verification_state set but tenant hasn't submitted
    if (!hasSubmitted && ref.verification_state) {
      issues.push({
        id: ref.id,
        shortId: refId,
        issue: `verification_state is '${ref.verification_state}' but NOT submitted`,
        currentStatus: ref.status,
        currentVerificationState: ref.verification_state,
        hasSubmitted: false
      });
    }
  }

  console.log('📋 VALIDATION RESULTS:\n');

  if (issues.length === 0) {
    console.log('✅ ALL VERIFICATION STATES ARE VALID - No issues found!\n');
  } else {
    console.log(`❌ Found ${issues.length} reference(s) with incorrect verification_state:\n`);

    issues.forEach((issue, index) => {
      console.log(`${index + 1}. Reference: ${issue.shortId}...`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   Status: ${issue.currentStatus}`);
      console.log(`   Verification State: ${issue.currentVerificationState}`);
      console.log(`   Has Submitted: No`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('\n🔧 FIXING ISSUES...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const issue of issues) {
      console.log(`Fixing ${issue.shortId}...`);

      const { error: updateError } = await supabase
        .from('tenant_references')
        .update({ verification_state: null })
        .eq('id', issue.id);

      if (updateError) {
        console.error(`  ❌ Error: ${updateError.message}`);
        errorCount++;
      } else {
        console.log(`  ✅ Fixed - verification_state cleared`);
        successCount++;
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('\n📊 RESULTS:\n');
    console.log(`✅ Successfully fixed: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('');
})();
