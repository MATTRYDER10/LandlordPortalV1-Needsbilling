import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getVerificationProgress } from '../services/verificationSectionService';

dotenv.config();

const referenceId = 'febb2150-33dd-47b1-93cb-eb011a195eb2';

async function testProgress() {
  console.log(`Testing getVerificationProgress for ${referenceId}\n`);

  const progress = await getVerificationProgress(referenceId);

  console.log('Progress Result:');
  console.log(`  totalSections: ${progress.totalSections}`);
  console.log(`  completedSections: ${progress.completedSections}`);
  console.log(`  sectionsWithIssues: ${progress.sectionsWithIssues}`);
  console.log(`  canFinalize: ${progress.canFinalize}`);
  console.log(`  hasActionRequired: ${progress.hasActionRequired}`);
  console.log(`  hasFail: ${progress.hasFail}`);
  console.log('');

  console.log('Sections:');
  progress.sections.forEach(s => {
    console.log(`  - ${s.type}: ${s.decision}`);
  });
  console.log('');

  if (progress.hasActionRequired && progress.canFinalize) {
    console.log('⚠️  BUG DETECTED: hasActionRequired is true but canFinalize is also true!');
    console.log('This should not be possible - canFinalize should be false when hasActionRequired is true');
  } else if (progress.hasActionRequired && !progress.canFinalize) {
    console.log('✅  Logic is correct: hasActionRequired=true and canFinalize=false');
    console.log('The finalize endpoint SHOULD block PASS/FAIL decisions');
  } else if (!progress.hasActionRequired && progress.canFinalize) {
    console.log('✅  No ACTION_REQUIRED sections, can finalize normally');
  }
}

testProgress();
