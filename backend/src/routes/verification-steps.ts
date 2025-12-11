import { Router, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { supabase as supabaseAdmin } from '../config/supabase';
import { generateReferenceReportPDFV2 } from '../services/pdfReportServiceV2';
import { generatePassedPdfService } from '../services/generatePassedPdfService';
import { validateSubmitAssessmentBody } from '../utils/verification-validation';
import { assessApplicationScore } from '../services/application-assesment/assessApplication';

// Helper function to ensure storage bucket exists
async function ensureBucketExists(bucketId: string): Promise<boolean> {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();

    if (listError) {
      console.error(`[Bucket] Error listing buckets:`, listError);
      return false;
    }

    const bucketExists = buckets?.some(b => b.id === bucketId);

    if (bucketExists) {
      return true;
    }

    // Create bucket if it doesn't exist
    console.log(`[Bucket] Creating bucket "${bucketId}"...`);
    const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket(
      bucketId,
      {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['application/pdf'],
      }
    );

    if (createError) {
      console.error(`[Bucket] Error creating bucket "${bucketId}":`, createError);
      return false;
    }

    console.log(`[Bucket] Bucket "${bucketId}" created successfully`);
    return true;
  } catch (error: any) {
    console.error(`[Bucket] Error ensuring bucket exists:`, error);
    return false;
  }
}

const router = Router();

// Get evidence source options
router.get('/evidence-sources', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { step_type } = req.query;

    let query = supabaseAdmin
      .from('evidence_source_options')
      .select('*')
      .eq('active', true)
      .order('display_order');

    if (step_type) {
      query = query.eq('step_type', step_type);
    }

    const { data: options, error } = await query;

    if (error) throw error;

    // Group by step_type for easier frontend consumption
    const groupedOptions: { [key: string]: any[] } = {
      INCOME_AFFORDABILITY: [],
      RESIDENTIAL: [],
      CREDIT_TAS: []
    };

    options?.forEach(option => {
      if (groupedOptions[option.step_type]) {
        groupedOptions[option.step_type].push(option);
      }
    });

    res.json({
      options,  // Flat array for compatibility
      evidenceSources: groupedOptions  // Grouped by step type
    });
  } catch (error: any) {
    console.error('Error fetching evidence source options:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all verification steps for a reference
router.get('/reference/:referenceId/steps', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Get or create verification check
    let { data: verificationCheck, error: checkError } = await supabaseAdmin
      .from('verification_checks')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    // Create if doesn't exist
    if (!verificationCheck) {
      const { data: newCheck, error: createError } = await supabaseAdmin
        .from('verification_checks')
        .insert({
          reference_id: referenceId,
          verified_by: req.user?.id,
          current_step: 1,
          overall_status: 'in_progress'
        })
        .select()
        .single();

      if (createError) throw createError;
      verificationCheck = newCheck;
    }

    // Get verification steps
    const { data: steps, error: stepsError } = await supabaseAdmin
      .from('verification_steps')
      .select(`
        *,
        completed_by_staff:staff_users!verification_steps_completed_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('verification_check_id', verificationCheck.id)
      .order('step_number');

    if (stepsError) throw stepsError;

    res.json({
      verificationCheck,
      steps: steps || []
    });
  } catch (error: any) {
    console.error('Error fetching verification steps:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single verification step
router.get('/reference/:referenceId/steps/:stepNumber', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId, stepNumber } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const stepNum = parseInt(stepNumber);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > 4) {
      return res.status(400).json({ error: 'Invalid step number. Must be 1-4' });
    }

    // Get verification check
    const { data: verificationCheck, error: checkError } = await supabaseAdmin
      .from('verification_checks')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    if (checkError) throw checkError;
    if (!verificationCheck) {
      return res.status(404).json({ error: 'Verification check not found' });
    }

    // Get step
    const { data: step, error: stepError } = await supabaseAdmin
      .from('verification_steps')
      .select(`
        *,
        completed_by_staff:staff_users!verification_steps_completed_by_fkey (
          id,
          full_name,
          email
        )
      `)
      .eq('verification_check_id', verificationCheck.id)
      .eq('step_number', stepNum)
      .single();

    if (stepError && stepError.code !== 'PGRST116') {
      throw stepError;
    }

    // Return empty step if doesn't exist yet
    if (!step) {
      const stepTypes = ['ID_SELFIE', 'INCOME_AFFORDABILITY', 'RESIDENTIAL', 'CREDIT_TAS'];
      return res.json({
        step: {
          step_number: stepNum,
          step_type: stepTypes[stepNum - 1],
          checks: [],
          evidence_sources: [],
          evidence_files: [],
          overall_pass: null,
          notes: '',
          completed_at: null
        }
      });
    }

    res.json({ step });
  } catch (error: any) {
    console.error('Error fetching verification step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save/update a verification step
router.post('/reference/:referenceId/steps/:stepNumber', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId, stepNumber } = req.params;
    const { checks, overall_pass, notes, evidence_sources, evidence_files } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const stepNum = parseInt(stepNumber);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > 4) {
      return res.status(400).json({ error: 'Invalid step number. Must be 1-4' });
    }

    const stepTypes = ['ID_SELFIE', 'INCOME_AFFORDABILITY', 'RESIDENTIAL', 'CREDIT_TAS'];
    const stepType = stepTypes[stepNum - 1];

    // Get or create verification check
    let { data: verificationCheck, error: checkError } = await supabaseAdmin
      .from('verification_checks')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (!verificationCheck) {
      const { data: newCheck, error: createError } = await supabaseAdmin
        .from('verification_checks')
        .insert({
          reference_id: referenceId,
          verified_by: req.user?.id,
          current_step: stepNum,
          overall_status: 'in_progress'
        })
        .select()
        .single();

      if (createError) throw createError;
      verificationCheck = newCheck;
    }

    // Update current step if moving forward
    if (stepNum > verificationCheck.current_step) {
      await supabaseAdmin
        .from('verification_checks')
        .update({ current_step: stepNum })
        .eq('id', verificationCheck.id);
    }

    // Upsert verification step
    const stepData = {
      verification_check_id: verificationCheck.id,
      reference_id: referenceId,
      step_number: stepNum,
      step_type: stepType,
      checks: checks || [],
      overall_pass,
      notes: notes || '',
      evidence_sources: evidence_sources || [],
      evidence_files: evidence_files || [],
      completed_by: overall_pass !== null ? staffUser.id : null,
      completed_at: overall_pass !== null ? new Date().toISOString() : null
    };

    const { data: step, error: upsertError } = await supabaseAdmin
      .from('verification_steps')
      .upsert(stepData, {
        onConflict: 'verification_check_id,step_number'
      })
      .select(`
        *,
        completed_by_staff:staff_users!verification_steps_completed_by_fkey (
          id,
          full_name
        )
      `)
      .single();

    if (upsertError) throw upsertError;

    // Log to audit
    await supabaseAdmin.from('reference_audit_log').insert({
      reference_id: referenceId,
      action: 'VERIFICATION_STEP_UPDATED',
      details: {
        step_number: stepNum,
        step_type: stepType,
        overall_pass,
        completed: overall_pass !== null
      },
      performed_by: staffUser.id
    });

    res.json({ step, message: 'Verification step saved successfully' });
  } catch (error: any) {
    console.error('Error saving verification step:', error);
    res.status(500).json({ error: error.message });
  }
});

// Finalize verification and generate report
router.post('/reference/:referenceId/finalize', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const { tas_category, tas_reason, final_notes } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Validate TAS category (PASS_PLUS kept for backward compatibility)
    if (!['PASS_PLUS', 'PASS', 'PASS_WITH_GUARANTOR', 'REFER', 'FAIL'].includes(tas_category)) {
      return res.status(400).json({ error: 'Invalid TAS category' });
    }

    // Require reason for REFER and FAIL
    if ((tas_category === 'REFER' || tas_category === 'FAIL') && !tas_reason) {
      return res.status(400).json({ error: 'Reason required for REFER and FAIL decisions' });
    }

    // Get verification check
    const { data: verificationCheck, error: checkError } = await supabaseAdmin
      .from('verification_checks')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    if (checkError) throw checkError;
    if (!verificationCheck) {
      return res.status(404).json({ error: 'Verification check not found' });
    }

    // Verify all 4 steps are completed
    const { data: steps, error: stepsError } = await supabaseAdmin
      .from('verification_steps')
      .select('step_number, overall_pass, completed_at')
      .eq('verification_check_id', verificationCheck.id);

    if (stepsError) throw stepsError;

    const completedSteps = steps?.filter(s => s.completed_at !== null).length || 0;
    if (completedSteps < 4) {
      return res.status(400).json({
        error: 'All 4 verification steps must be completed before finalizing',
        completedSteps,
        requiredSteps: 4
      });
    }

    // Calculate overall pass/fail
    const allStepsPassed = steps?.every(s => s.overall_pass === true);
    const finalDecision = (tas_category === 'PASS_PLUS' || tas_category === 'PASS' || tas_category === 'PASS_WITH_GUARANTOR') && allStepsPassed ? 'passed' : 'failed';

    // Update verification check with final decision
    const { error: updateError } = await supabaseAdmin
      .from('verification_checks')
      .update({
        overall_status: finalDecision,
        tas_category,
        tas_reason: tas_reason || null,
        final_decision: tas_category,
        final_notes: final_notes || '',
        completed_at: new Date().toISOString()
      })
      .eq('id', verificationCheck.id);

    if (updateError) throw updateError;

    // Update reference status
    const newReferenceStatus = finalDecision === 'passed' ? 'completed' : 'rejected';
    const { error: refError } = await supabaseAdmin
      .from('tenant_references')
      .update({ status: newReferenceStatus })
      .eq('id', referenceId);

    if (refError) throw refError;

    // Complete work item if exists
    const { data: workItems } = await supabaseAdmin
      .from('work_items')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('work_type', 'VERIFY')
      .in('status', ['ASSIGNED', 'IN_PROGRESS']);

    if (workItems && workItems.length > 0) {
      await supabaseAdmin
        .from('work_items')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
        })
        .in('id', workItems.map(w => w.id));
    }

    // Log to audit
    await supabaseAdmin.from('reference_audit_log').insert({
      reference_id: referenceId,
      action: 'VERIFICATION_FINALIZED',
      details: {
        tas_category,
        final_decision: finalDecision,
        all_steps_passed: allStepsPassed
      },
      performed_by: staffUser.id
    });

    // Generate PDF report with evidence sources
    let pdfGenerated = false;
    let pdfUrl = null;
    try {
      const { buffer, firstName, lastName } = await generateReferenceReportPDFV2(referenceId);
      const timestamp = Date.now();
      const fileName = `reference-report-${firstName}-${lastName}-${timestamp}.pdf`;

      // Ensure bucket exists before uploading
      const bucketId = 'reference-pdfs';
      const bucketExists = await ensureBucketExists(bucketId);

      if (!bucketExists) {
        console.error('[Finalize] Failed to ensure bucket exists, skipping PDF upload');
      } else {
        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from(bucketId)
          .upload(`reports/${referenceId}/${fileName}`, buffer, {
            contentType: 'application/pdf',
            upsert: true
          });

        if (uploadError) {
          console.error('[Finalize] PDF upload error:', uploadError);
        } else {
          pdfGenerated = true;
          const { data: urlData } = supabaseAdmin.storage
            .from(bucketId)
            .getPublicUrl(`reports/${referenceId}/${fileName}`);
          pdfUrl = urlData.publicUrl;

          // Update reference with PDF URL
          await supabaseAdmin
            .from('tenant_references')
            .update({ report_url: pdfUrl })
            .eq('id', referenceId);

          console.log(`[Finalize] PDF generated and uploaded: ${pdfUrl}`);
        }
      }
    } catch (pdfError) {
      console.error('[Finalize] PDF generation error:', pdfError);
      // Don't fail the entire finalization if PDF fails
    }

    res.json({
      message: 'Verification finalized successfully',
      verificationCheck: {
        ...verificationCheck,
        overall_status: finalDecision,
        tas_category,
        completed_at: new Date().toISOString()
      },
      referenceStatus: newReferenceStatus,
      pdfGenerated,
      pdfUrl
    });
  } catch (error: any) {
    console.error('Error finalizing verification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get verification progress summary
router.get('/reference/:referenceId/progress', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { data: verificationCheck, error: checkError } = await supabaseAdmin
      .from('verification_checks')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (!verificationCheck) {
      return res.json({
        progress: {
          started: false,
          currentStep: 0,
          stepsCompleted: 0,
          totalSteps: 4,
          overallStatus: 'not_started'
        }
      });
    }

    const { data: steps, error: stepsError } = await supabaseAdmin
      .from('verification_steps')
      .select('step_number, overall_pass, completed_at')
      .eq('verification_check_id', verificationCheck.id);

    if (stepsError) throw stepsError;

    const stepsCompleted = steps?.filter(s => s.completed_at !== null).length || 0;

    res.json({
      progress: {
        started: true,
        currentStep: verificationCheck.current_step,
        stepsCompleted,
        totalSteps: 4,
        overallStatus: verificationCheck.overall_status,
        tasCategory: verificationCheck.tas_category,
        completedAt: verificationCheck.completed_at
      }
    });
  } catch (error: any) {
    console.error('Error fetching verification progress:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post(
  '/submit-assessment/:referenceId',
  staffAuth,
  async (req: StaffAuthRequest, res: Response) => {
    debugger
    try {
      const { referenceId } = req.params;
      const staffUser = req.staffUser;

      if (!referenceId) {
        return res.status(400).json({ error: 'Reference ID is required' });
      }
      if (!staffUser) {
        return res.status(403).json({ error: 'Access denied. Staff privileges required.' });
      }

      const { verdict } = req.body;
      if (!verdict || !['completed', 'rejected'].includes(verdict)) {
        return res.status(400).json({ error: 'Verdict is required, must be either COMPLETED or REJECTED' });
      }

      const { final_remarks } = req.body;
      if (!final_remarks) {
        return res.status(400).json({ error: 'Final remarks are required' });
      }

      // Get reference to check if it's a guarantor
      const { data: reference, error: fetchError } = await supabaseAdmin
        .from('tenant_references')
        .select('is_guarantor')
        .eq('id', referenceId)
        .single();

      if (fetchError) {
        return res.status(500).json({ error: 'Failed to fetch reference details' });
      }

      const isGuarantor = reference?.is_guarantor === true;

      // ---- Runtime validation ----
      const { isValid, final_remarks: validatedFinalRemarks } = validateSubmitAssessmentBody({
        ...req.body,
        is_guarantor: isGuarantor
      });
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid request payload' });
      }
      const { residential, credit_tas, income, rtr } = validatedFinalRemarks;

      const tas_category = credit_tas.tas_category;

      // Validate guarantor-specific rules
      if (isGuarantor && tas_category === 'PASS_WITH_GUARANTOR') {
        return res.status(400).json({
          error: 'Guarantors cannot have PASS_WITH_GUARANTOR status'
        });
      }

      // Validate allowed TAS categories
      const allowedTasCategories = ['PASS', 'PASS_WITH_GUARANTOR', 'PASS_ON_CONDITION', 'REFER', 'FAIL'];
      if (tas_category && !allowedTasCategories.includes(tas_category)) {
        return res.status(400).json({
          error: `Invalid TAS category. Allowed values: ${allowedTasCategories.join(', ')}`
        });
      }

      const finalDecision = verdict === 'completed' ? 'passed' : 'failed';

      // Not updating verification_checks as we didn't use that in new flow

      // Update reference status (skip residential for guarantors)
      const updateData: any = {
        status: verdict,
        income_assessment_status: income.decision,
        rtr_verified: rtr.decision === 'PASS',
        verified_by: staffUser.id,
        verified_at: new Date().toISOString()
      };

      // Only update residential status for non-guarantors
      if (!isGuarantor && residential) {
        updateData.res_assessment_status = residential.decision;
      }

      const { error: refError } = await supabaseAdmin
        .from('tenant_references')
        .update(updateData)
        .eq('id', referenceId);

      if (refError) throw refError;

      const getCCJAndInsCount = (decision: "PASS" | "FAIL") => {
          return decision === 'PASS' ? {
            "ccjCount": 0,
            "insolvencyCount": 0,
          } : {
            "ccjCount": 1,
            "insolvencyCount": 1,
          }
      }

      // Update creditsafe and sanctions
      // Skip if REFER, otherwise update based on decision
      if (credit_tas.tas_category !== 'REFER') {
        const isPassed = credit_tas.decision === 'PASS' || credit_tas.tas_category === 'PASS_ON_CONDITION';

        const { data: _, error: creditsafeError } = await supabaseAdmin
          .from("creditsafe_verifications")
          .update({
            fraud_indicators: {
              "insolvencyMatch": !isPassed,
              "ccjMatch": !isPassed,
              "deceasedMatch": !isPassed,
              "electoralRollMatch": isPassed,
              ...(getCCJAndInsCount(isPassed ? 'PASS' : 'FAIL'))
            },
            verification_status: isPassed ? 'passed' : 'failed'
          })
          .eq("reference_id", referenceId);

        if (creditsafeError) {
          console.error('Error updating creditsafe:', creditsafeError);
        }

        const { data: __, error: sanctionsError } = await supabaseAdmin
          .from("sanctions_screenings")
          .update({
            risk_level: isPassed ? 'clear' : 'high',
            sanctions_matches: isPassed ? [] : ['sanctions_match']
          })
          .eq("reference_id", referenceId);

        if (sanctionsError) {
          console.error('Error updating sanctions:', sanctionsError);
        }
      }


      // Complete work item if exists
      const { data: workItems, error: workItemsError } = await supabaseAdmin
        .from('work_items')
        .select('id')
        .eq('reference_id', referenceId)
        .eq('work_type', 'VERIFY')
        .in('status', ['ASSIGNED', 'IN_PROGRESS']);

      if (workItemsError) {
        console.error('Error fetching work items:', workItemsError);
      };

      if (workItems && workItems.length > 0) {
        const { error: workItemError } = await supabaseAdmin
          .from('work_items')
          .update({
            status: 'COMPLETED',
            completed_at: new Date().toISOString()
          })
          .in('id', workItems.map(w => w.id));
        if (workItemError) {
          console.error('Error completing work item:', workItemError);
        };
      }

      // Log to audit
      const { error: auditError } = await supabaseAdmin.from('reference_audit_log').insert({
        reference_id: referenceId,
        action: 'VERIFICATION_FINALIZED',
        metadata: {
          tas_category,
          final_decision: finalDecision,
          all_steps_passed: true
        },
        created_by: staffUser.id
      });
      if (auditError) {
        console.error('Error logging to audit:', auditError);
      };

      // Update new score
      await assessApplicationScore(referenceId, 'Staff', staffUser.id, validatedFinalRemarks);

      //PDF
      if (verdict !== 'completed') {
        return res.status(200).json({ message: 'Assessment submitted successfully' });
      }

      let pdfUrl = null;
      try {
        pdfUrl = await generatePassedPdfService(referenceId);
        console.log('[Assessment] Passed certificate PDF generated:', pdfUrl);

        // Update reference with PDF URL
        await supabaseAdmin
          .from('tenant_references')
          .update({ passed_certificate_url: pdfUrl })
          .eq('id', referenceId);
      } catch (pdfError) {
        console.error('Error generating passed PDF:', pdfError);
        // Don't fail the entire request if PDF generation fails
      }

      return res.status(200).json({
        message: 'Assessment submitted successfully',
        pdfUrl
      });

    } catch (error: any) {
      console.error("Error submitting assessment:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

router.get('/passed-certificate/:referenceId', async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const pdfUrl = await generatePassedPdfService(referenceId);
    return res.status(200).json({ pdfUrl });
  } catch (error: any) {
    console.error('Error generating passed PDF:', error);
    return res.status(500).json({ error: error.message });
  }
}
);


export default router;
