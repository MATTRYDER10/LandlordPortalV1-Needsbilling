const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const referenceId = process.argv[2];

if (!referenceId) {
  console.error('Usage: node scripts/push-reference-to-verify.js <reference-id>');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const { data: reference, error: refError } = await supabase
    .from('tenant_references')
    .select('id, status, verification_state, is_guarantor')
    .eq('id', referenceId)
    .single();

  if (refError || !reference) {
    throw new Error(refError?.message || 'Reference not found');
  }

  if (['completed', 'rejected'].includes(reference.status)) {
    console.log(`Reference ${referenceId} is ${reference.status}; refusing to push to verify queue.`);
    return;
  }

  if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(reference.verification_state || '')) {
    console.log(`Reference ${referenceId} is ${reference.verification_state}; refusing to push to verify queue.`);
    return;
  }

  if (reference.is_guarantor !== true) {
    console.log(`Note: reference ${referenceId} is not marked as guarantor (is_guarantor=${reference.is_guarantor}).`);
  }

  const { error: updateError } = await supabase
    .from('tenant_references')
    .update({
      verification_state: 'READY_FOR_REVIEW',
      status: 'pending_verification'
    })
    .eq('id', referenceId);

  if (updateError) throw updateError;

  const { data: existingWorkItem } = await supabase
    .from('work_items')
    .select('id, status')
    .eq('reference_id', referenceId)
    .eq('work_type', 'VERIFY')
    .maybeSingle();

  if (!existingWorkItem) {
    const { error: createError } = await supabase
      .from('work_items')
      .insert({
        reference_id: referenceId,
        work_type: 'VERIFY',
        status: 'AVAILABLE',
        priority: 0
      });

    if (createError) throw createError;
    console.log(`Created VERIFY work item for ${referenceId}.`);
  } else if (existingWorkItem.status === 'COMPLETED') {
    const { error: reactivateError } = await supabase
      .from('work_items')
      .update({
        status: 'AVAILABLE',
        assigned_to: null,
        assigned_at: null,
        completed_at: null,
        metadata: {}
      })
      .eq('id', existingWorkItem.id);

    if (reactivateError) throw reactivateError;
    console.log(`Reactivated VERIFY work item ${existingWorkItem.id} for ${referenceId}.`);
  } else {
    console.log(`VERIFY work item ${existingWorkItem.id} already active for ${referenceId}.`);
  }

  const auditPayload = {
    reference_id: referenceId,
    action: 'PUSHED_TO_VERIFY',
    details: { source: 'script', reason: 'Manual push to verify queue' },
    performed_by: null
  };

  const { error: auditError } = await supabase
    .from('reference_audit_log')
    .insert(auditPayload);

  if (auditError) {
    if (auditError.message?.includes('details')) {
      const { error: fallbackError } = await supabase
        .from('reference_audit_log')
        .insert({
          reference_id: referenceId,
          action: 'PUSHED_TO_VERIFY',
          performed_by: null
        });

      if (fallbackError) {
        console.warn(`Warning: failed to write audit log: ${fallbackError.message}`);
      }
    } else {
      console.warn(`Warning: failed to write audit log: ${auditError.message}`);
    }
  }

  console.log(`Reference ${referenceId} set to READY_FOR_REVIEW and queued for verify.`);
}

main().catch((error) => {
  console.error('Failed to push reference to verify queue:', error.message || error);
  process.exit(1);
});
