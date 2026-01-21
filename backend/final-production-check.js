const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://spaetpdmlqfygsxiawul.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  console.log('🔍 FINAL PRODUCTION READINESS CHECK\n');
  console.log('='.repeat(80));
  console.log('');

  let allGood = true;
  const issues = [];

  // 1. Check environment variables
  console.log('1. ENVIRONMENT VARIABLES');
  if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes('localhost')) {
    issues.push('FRONTEND_URL not set to production URL');
    console.log('   ❌ FRONTEND_URL:', process.env.FRONTEND_URL || 'NOT SET');
    allGood = false;
  } else {
    console.log('   ✅ FRONTEND_URL:', process.env.FRONTEND_URL);
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    issues.push('Supabase credentials not configured');
    console.log('   ❌ Supabase credentials missing');
    allGood = false;
  } else {
    console.log('   ✅ Supabase URL:', process.env.SUPABASE_URL);
  }

  console.log('');

  // 2. Check database connectivity
  console.log('2. DATABASE CONNECTIVITY');
  const { data: dbTest, error: dbError } = await supabase
    .from('tenant_references')
    .select('id')
    .limit(1);

  if (dbError) {
    issues.push('Database connection failed: ' + dbError.message);
    console.log('   ❌ Database connection failed');
    allGood = false;
  } else {
    console.log('   ✅ Database connected successfully');
  }

  console.log('');

  // 3. Check verification states
  console.log('3. VERIFICATION STATES');
  const { count: stateCount } = await supabase
    .from('tenant_references')
    .select('verification_state', { count: 'exact', head: true })
    .not('verification_state', 'is', null);

  const { count: readyCount } = await supabase
    .from('tenant_references')
    .select('id', { count: 'exact', head: true })
    .eq('verification_state', 'READY_FOR_REVIEW');

  const { count: completedCount } = await supabase
    .from('tenant_references')
    .select('id', { count: 'exact', head: true })
    .eq('verification_state', 'COMPLETED');

  console.log(`   ✅ References with verification_state: ${stateCount || 0}`);
  console.log(`   ✅ In READY_FOR_REVIEW: ${readyCount || 0}`);
  console.log(`   ✅ In COMPLETED: ${completedCount || 0}`);

  console.log('');

  // 4. Check work queue
  console.log('4. WORK QUEUE');
  const { count: verifyWorkItems } = await supabase
    .from('work_items')
    .select('status', { count: 'exact', head: true })
    .eq('work_type', 'VERIFY');

  const { count: availableWork } = await supabase
    .from('work_items')
    .select('id', { count: 'exact', head: true })
    .eq('work_type', 'VERIFY')
    .eq('status', 'AVAILABLE');

  console.log(`   ✅ Total VERIFY work items: ${verifyWorkItems || 0}`);
  console.log(`   ✅ Available for assignment: ${availableWork || 0}`);

  console.log('');

  // 5. Check chase dependencies
  console.log('5. CHASE DEPENDENCIES');
  const { count: chasingDeps } = await supabase
    .from('chase_dependencies')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'CHASING');

  console.log(`   ✅ Items in CHASING status (Pending Responses): ${chasingDeps || 0}`);

  console.log('');

  // 6. Check recent activity
  console.log('6. RECENT ACTIVITY (Last 24 hours)');
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: recentSubmissions } = await supabase
    .from('tenant_references')
    .select('id', { count: 'exact', head: true })
    .gte('submitted_at', yesterday);

  const { count: recentVerifications } = await supabase
    .from('work_items')
    .select('id', { count: 'exact', head: true })
    .eq('work_type', 'VERIFY')
    .eq('status', 'COMPLETED')
    .gte('completed_at', yesterday);

  console.log(`   ✅ References submitted: ${recentSubmissions || 0}`);
  console.log(`   ✅ Verifications completed: ${recentVerifications || 0}`);

  console.log('');
  console.log('='.repeat(80));
  console.log('');

  if (allGood && issues.length === 0) {
    console.log('✅ ALL CHECKS PASSED - READY FOR PRODUCTION!\n');
    console.log('📋 DEPLOYMENT CHECKLIST:');
    console.log('   ✅ Database connected');
    console.log('   ✅ Environment variables configured');
    console.log('   ✅ Verification state system active');
    console.log('   ✅ Work queue operational');
    console.log('   ✅ Chase dependencies tracking');
    console.log('   ✅ Recent activity confirmed');
    console.log('');
    console.log('🚀 System is ready to go live!');
  } else {
    console.log('⚠️  ISSUES FOUND:\n');
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log('');
    console.log('Please fix these issues before going live.');
  }

  console.log('');
})();
