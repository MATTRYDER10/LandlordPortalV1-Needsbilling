import { Router, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { supabase as supabaseAdmin } from '../config/supabase';
import { decrypt, encrypt } from '../services/encryption';
import {
  getSections,
  getSection,
  setPass,
  setPassWithCondition,
  setActionRequired,
  setFail,
  resetSection,
  updateSectionChecks,
  updateEvidenceSources,
  getVerificationProgress,
  getActionReasonCodes,
  initializeSections
} from '../services/verificationSectionService';
import { logAuditAction } from '../services/auditService';
import { isReadyForVerification } from '../services/verificationReadinessService';
import { isInVerifyQueueState, VerificationState, transitionState } from '../services/verificationStateService';
import { cleanupStaleDependencies } from '../services/chaseDependencyService';
import { generatePassedPdfService } from '../services/generatePassedPdfService';

const router = Router();

// Helper function to calculate tenancy duration from start/end dates
function calculateTenancyDuration(startDate: string, endDate: string | null): string {
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();

  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  if (years === 0) {
    return `${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  } else if (remainingMonths === 0) {
    return `${years} year${years !== 1 ? 's' : ''}`;
  } else {
    return `${years} year${years !== 1 ? 's' : ''}, ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
  }
}

// ============================================================================
// VERIFY QUEUE ENDPOINTS
// ============================================================================

// Get person-centric verify queue
// Only returns references that are truly ready for verification (all required data present)
router.get('/queue', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { status, assigned_to } = req.query;

    // Get VERIFY work items with reference data
    let query = supabaseAdmin
      .from('work_items')
      .select(`
        *,
        reference:tenant_references!work_items_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          tenant_email_encrypted,
          property_address_encrypted,
          is_guarantor,
          status,
          verification_state,
          created_at,
          company:companies!inner(id, name_encrypted)
        ),
        assigned_staff:staff_users!work_items_assigned_to_fkey (
          id,
          full_name
        )
      `)
      .eq('work_type', 'VERIFY')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    } else {
      query = query.in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'RETURNED']);
    }

    // Filter by assigned staff
    if (assigned_to === 'me') {
      query = query.eq('assigned_to', staffUser.id);
    } else if (assigned_to) {
      query = query.eq('assigned_to', assigned_to);
    }

    // NOTE: Cooldown filter removed as per new state model (Issue #40)
    // Queue visibility is now controlled by verification_state, not cooldowns

    const { data: workItems, error } = await query;

    if (error) throw error;

    // Filter by verification_state - only show items ready for review or in verification
    // This replaces the old readiness check with explicit state filtering
    const filteredItems = (workItems || []).filter((item: any) => {
      if (!item.reference) return false;

      // Use verification_state for queue visibility
      const verificationState = item.reference.verification_state as VerificationState | null;
      if (!isInVerifyQueueState(verificationState)) {
        return false;
      }

      return true;
    });

    // Enrich items with display data (no longer re-evaluating evidence)
    const enrichedItems = filteredItems.map((item: any) => {
        const hoursInQueue = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);

        let urgency: 'NORMAL' | 'WARNING' | 'URGENT' = 'NORMAL';
        let urgencyReason = '';
        if (hoursInQueue > 48) {
          urgency = 'URGENT';
          urgencyReason = 'Over 48 hours in queue';
        } else if (hoursInQueue > 24) {
          urgency = 'WARNING';
          urgencyReason = 'Over 24 hours in queue';
        }

        return {
          id: item.id,
          referenceId: item.reference_id,
          workType: item.work_type,
          status: item.status,
          priority: item.priority,
          urgency,
          urgencyReason,
          hoursInQueue: Math.floor(hoursInQueue),
          createdAt: item.created_at,
          assignedTo: item.assigned_to,
          assignedAt: item.assigned_at,
          assignedStaffName: item.assigned_staff?.full_name || null,
          verificationState: item.reference.verification_state,
          person: {
            name: `${decrypt(item.reference.tenant_first_name_encrypted) || ''} ${decrypt(item.reference.tenant_last_name_encrypted) || ''}`.trim(),
            email: decrypt(item.reference.tenant_email_encrypted) || '',
            role: item.reference.is_guarantor ? 'GUARANTOR' : 'TENANT'
          },
          property: {
            address: decrypt(item.reference.property_address_encrypted) || ''
          },
          company: {
            name: decrypt(item.reference.company?.name_encrypted) || ''
          }
        };
    });

    // Sort by urgency and age
    enrichedItems.sort((a: any, b: any) => {
      const urgencyOrder: Record<string, number> = { URGENT: 0, WARNING: 1, NORMAL: 2 };
      if (urgencyOrder[a.urgency as string] !== urgencyOrder[b.urgency as string]) {
        return urgencyOrder[a.urgency as string] - urgencyOrder[b.urgency as string];
      }
      return b.hoursInQueue - a.hoursInQueue;
    });

    res.json({
      items: enrichedItems,
      total: enrichedItems.length
    });
  } catch (error: any) {
    console.error('Error fetching verify queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// PERSON ENDPOINTS
// ============================================================================

// Get full person data with sections for verification view
router.get('/person/:referenceId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Get reference data
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select(`
        *,
        company:companies!inner(id, name_encrypted)
      `)
      .eq('id', referenceId)
      .single();

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    // Calculate total income from encrypted fields
    // All income fields are stored as annual amounts
    const salaryAmount = reference.employment_salary_amount_encrypted
      ? parseFloat(decrypt(reference.employment_salary_amount_encrypted) || '0') : 0;
    const additionalIncome = reference.additional_income_amount_encrypted
      ? parseFloat(decrypt(reference.additional_income_amount_encrypted) || '0') : 0;
    const selfEmployedIncome = reference.self_employed_annual_income_encrypted
      ? parseFloat(decrypt(reference.self_employed_annual_income_encrypted) || '0') : 0;
    const benefitsIncome = reference.benefits_annual_amount_encrypted
      ? parseFloat(decrypt(reference.benefits_annual_amount_encrypted) || '0') : 0;

    const totalIncomeForDisplay = salaryAmount + additionalIncome + selfEmployedIncome + benefitsIncome;

    // Use rent_share for multi-tenant properties and guarantors, fallback to monthly_rent
    let rentForDisplay = reference.rent_share || reference.monthly_rent;

    // For guarantors without rent_share, get it from the parent tenant reference
    if (reference.is_guarantor && !reference.rent_share && reference.guarantor_for_reference_id) {
      const { data: parentRef } = await supabaseAdmin
        .from('tenant_references')
        .select('rent_share')
        .eq('id', reference.guarantor_for_reference_id)
        .single();
      if (parentRef?.rent_share) {
        rentForDisplay = parentRef.rent_share;
      }
    }

    // Decrypt reference data
    const decryptedReference = {
      id: reference.id,
      tenant_first_name: decrypt(reference.tenant_first_name_encrypted),
      tenant_last_name: decrypt(reference.tenant_last_name_encrypted),
      middle_name: decrypt(reference.middle_name_encrypted),
      tenant_email: decrypt(reference.tenant_email_encrypted),
      contact_number: decrypt(reference.contact_number_encrypted),
      property_address: decrypt(reference.property_address_encrypted),
      date_of_birth: reference.date_of_birth_encrypted ? decrypt(reference.date_of_birth_encrypted) : null,
      nationality: reference.nationality,
      monthly_rent: rentForDisplay,
      status: reference.status,
      is_guarantor: reference.is_guarantor,
      person_type: reference.is_guarantor ? 'GUARANTOR' : 'TENANT',
      submitted_at: reference.submitted_at,
      created_at: reference.created_at,
      // Income data
      total_income: totalIncomeForDisplay,
      income_ratio: reference.income_ratio,
      required_ratio: reference.required_ratio || 2.5,
      employment_type: reference.employment_type,
      employer_name: reference.employer_name,
      job_title: reference.job_title,
      employment_start_date: reference.employment_start_date,
      employment_end_date: reference.employment_end_date,
      employment_contract_type: reference.employment_contract_type,
      employment_salary_frequency: reference.employment_salary_frequency,
      income_student: reference.income_student || false,
      // Additional income
      additional_income_frequency: reference.additional_income_frequency,
      // Self-employed data
      self_employed_start_date: reference.self_employed_start_date,
      self_employed_nature_of_business: reference.self_employed_nature_of_business_encrypted
        ? decrypt(reference.self_employed_nature_of_business_encrypted) : null,
      // Benefits data
      benefits_monthly_amount: reference.benefits_monthly_amount_encrypted
        ? parseFloat(decrypt(reference.benefits_monthly_amount_encrypted) || '0') : null,
      benefits_annual_amount: benefitsIncome,
      // Adverse credit
      adverse_credit_details: decrypt(reference.adverse_credit_details_encrypted),
      // Credit data - TAS score now comes from reference_scores table
      // tas_score: will be included from score query below
      // RTR data - derive rtr_status from is_british_citizen if set
      rtr_status: reference.is_british_citizen ? 'uk_citizen' : reference.rtr_status,
      rtr_expiry_date: reference.rtr_expiry_date,
      share_code: reference.share_code,
      is_british_citizen: reference.is_british_citizen,
      // File paths
      id_document_path: reference.id_document_path,
      selfie_path: reference.selfie_path,
      signature_path: reference.signature_path,
      rtr_document_path: reference.rtr_document_path,
      rtr_alternative_document_path: reference.rtr_alternative_document_path,
      rtr_alternative_document_type: reference.rtr_alternative_document_type,
      // British citizen RTR documents
      rtr_british_passport_path: reference.rtr_british_passport_path,
      rtr_british_no_passport: reference.rtr_british_no_passport,
      rtr_british_alt_doc_type: reference.rtr_british_alt_doc_type,
      rtr_british_alt_doc_path: reference.rtr_british_alt_doc_path,
      // Staff RTR verification fields
      rtr_staff_expiry_date: reference.rtr_staff_expiry_date,
      rtr_staff_share_code_confirmed: reference.rtr_staff_share_code_confirmed,
      // Current address
      current_address_line1: decrypt(reference.current_address_line1_encrypted),
      current_address_line2: decrypt(reference.current_address_line2_encrypted),
      current_city: decrypt(reference.current_city_encrypted),
      current_postcode: decrypt(reference.current_postcode_encrypted),
      current_country: decrypt(reference.current_country_encrypted),
      time_at_address_years: reference.time_at_address_years,
      time_at_address_months: reference.time_at_address_months,
      // Previous address - construct from encrypted fields
      previous_address: reference.previous_rental_address_line1_encrypted
        ? `${decrypt(reference.previous_rental_address_line1_encrypted) || ''}${reference.previous_rental_city_encrypted ? ', ' + decrypt(reference.previous_rental_city_encrypted) : ''}${reference.previous_rental_postcode_encrypted ? ' ' + decrypt(reference.previous_rental_postcode_encrypted) : ''}`.trim()
        : null,
      // Address type - derive from reference_type (landlord/agent) - map to frontend expected values
      previous_address_type: reference.reference_type
        ? (reference.reference_type === 'agent' ? 'AGENT' : reference.reference_type === 'living_with_family' ? 'FAMILY' : 'LANDLORD')
        : null,
      // Tenancy dates
      previous_tenancy_start_date: reference.previous_tenancy_start_date,
      previous_tenancy_end_date: reference.previous_tenancy_end_date,
      // Tenancy duration - calculate from dates
      tenancy_duration: reference.previous_tenancy_start_date
        ? calculateTenancyDuration(reference.previous_tenancy_start_date, reference.previous_tenancy_end_date)
        : null,
      // Company
      company_name: decrypt(reference.company?.name_encrypted)
    };

    // Get sections (or initialize if none exist)
    let sections = await getSections(referenceId);

    // If no sections exist, initialize them
    if (!sections || sections.length === 0) {
      sections = await initializeSections(referenceId);
    }

    // Get work item ID for this reference
    const { data: workItem } = await supabaseAdmin
      .from('work_items')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('work_type', 'VERIFY')
      .in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'RETURNED'])
      .single();

    // Get Creditsafe verification data
    const { data: creditsafeVerification } = await supabaseAdmin
      .from('creditsafe_verifications')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    // Get Sanctions/AML screening data
    const { data: sanctionsScreening } = await supabaseAdmin
      .from('sanctions_screenings')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    // Get reference score
    const { data: score } = await supabaseAdmin
      .from('reference_scores')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    // Get employer reference summary for display
    const { data: employerReferences } = await supabaseAdmin
      .from('employer_references')
      .select('*')
      .eq('reference_id', referenceId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(1);

    let employerReferenceSummary = null;
    if (employerReferences && employerReferences.length > 0) {
      const empRef = employerReferences[0];

      // Only create summary if employer reference has actual data (not an empty submission)
      const hasData = empRef.annual_salary_encrypted ||
                      empRef.employer_name_encrypted ||
                      empRef.company_name_encrypted ||
                      empRef.employee_position_encrypted ||
                      empRef.employment_start_date ||
                      empRef.employment_status;

      if (hasData) {
        // Decrypt employer name and salary
        const employerName = empRef.employer_name_encrypted
          ? decrypt(empRef.employer_name_encrypted)
          : (empRef.company_name_encrypted ? decrypt(empRef.company_name_encrypted) : null);
        const salary = empRef.annual_salary_encrypted
          ? parseFloat(decrypt(empRef.annual_salary_encrypted) || '0')
          : null;

        employerReferenceSummary = {
          name: employerName || 'Not specified',
          status: empRef.is_current_employee ? 'Currently Employed' : (empRef.employment_status || 'Not specified'),
          salary: salary,
          startDate: empRef.employment_start_date || null
        };
      }
    }

    // Get accountant reference summary for display (for self-employed)
    const { data: accountantReferences } = await supabaseAdmin
      .from('accountant_references')
      .select('*')
      .eq('tenant_reference_id', referenceId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(1);

    let accountantReferenceSummary = null;
    if (accountantReferences && accountantReferences.length > 0) {
      const accRef = accountantReferences[0];
      const firmName = accRef.firm_name_encrypted ? decrypt(accRef.firm_name_encrypted) : null;

      // Calculate annual income
      let annualIncome = null;
      if (accRef.estimated_monthly_income_encrypted) {
        const monthly = parseFloat(decrypt(accRef.estimated_monthly_income_encrypted) || '0');
        annualIncome = monthly * 12;
      } else if (accRef.annual_profit_encrypted) {
        annualIncome = parseFloat(decrypt(accRef.annual_profit_encrypted) || '0');
      }

      // Calculate years trading
      let yearsTrading = null;
      if (accRef.business_start_date) {
        const startDate = new Date(accRef.business_start_date);
        yearsTrading = Math.floor((Date.now() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }

      accountantReferenceSummary = {
        firm: firmName || 'Not specified',
        status: accRef.submitted_at ? 'received' : 'pending',
        annualIncome: annualIncome,
        yearsTrading: yearsTrading
      };
    }

    // Add reference summaries to decryptedReference
    const referenceWithSummaries = {
      ...decryptedReference,
      employer_reference: employerReferenceSummary,
      accountant_reference: accountantReferenceSummary
    };

    res.json({
      reference: referenceWithSummaries,
      sections,
      workItemId: workItem?.id || null,
      creditsafeVerification: creditsafeVerification || null,
      sanctionsScreening: sanctionsScreening || null,
      score: score || null
    });
  } catch (error: any) {
    console.error('Error fetching person data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// SECTION ENDPOINTS
// ============================================================================

// Get all sections for a reference
router.get('/person/:referenceId/sections', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const sections = await getSections(referenceId);

    res.json({ sections });
  } catch (error: any) {
    console.error('Error fetching sections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Initialize sections for a reference (if not already created)
router.post('/person/:referenceId/sections/initialize', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const sections = await initializeSections(referenceId);

    res.json({
      message: 'Sections initialized successfully',
      sections
    });
  } catch (error: any) {
    console.error('Error initializing sections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update tenant name during verification (staff only)
router.patch('/person/:referenceId/tenant-name', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const { first_name, last_name } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!first_name || !last_name) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    // Get current values for audit
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select('tenant_first_name_encrypted, tenant_last_name_encrypted, company_id')
      .eq('id', referenceId)
      .single();

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    const oldFirstName = decrypt(reference.tenant_first_name_encrypted) || '';
    const oldLastName = decrypt(reference.tenant_last_name_encrypted) || '';

    // Update with encrypted values
    const { error: updateError } = await supabaseAdmin
      .from('tenant_references')
      .update({
        tenant_first_name_encrypted: encrypt(first_name),
        tenant_last_name_encrypted: encrypt(last_name)
      })
      .eq('id', referenceId);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // Audit log
    await logAuditAction({
      referenceId,
      action: 'tenant_name_updated',
      description: `Staff updated tenant name from "${oldFirstName} ${oldLastName}" to "${first_name} ${last_name}"`,
      userId: staffUser.id,
      metadata: {
        old_first_name: oldFirstName,
        old_last_name: oldLastName,
        new_first_name: first_name,
        new_last_name: last_name,
        updated_by_staff: staffUser.full_name
      }
    });

    res.json({ message: 'Tenant name updated successfully' });
  } catch (error: any) {
    console.error('Error updating tenant name:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update RTR data during verification (staff only)
router.patch('/person/:referenceId/rtr', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const { shareCodeConfirmed, expiryDate } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Get current reference to verify it exists
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select('id, company_id, rtr_share_code, rtr_staff_share_code_confirmed, rtr_staff_expiry_date')
      .eq('id', referenceId)
      .single();

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (shareCodeConfirmed !== undefined) {
      updateData.rtr_staff_share_code_confirmed = shareCodeConfirmed || null;
    }
    if (expiryDate !== undefined) {
      updateData.rtr_staff_expiry_date = expiryDate || null;
    }

    // Update tenant_references
    const { error: updateError } = await supabaseAdmin
      .from('tenant_references')
      .update(updateData)
      .eq('id', referenceId);

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    // Audit log
    await logAuditAction({
      referenceId,
      action: 'rtr_data_updated',
      description: `Staff updated RTR verification data`,
      userId: staffUser.id,
      metadata: {
        share_code_confirmed: shareCodeConfirmed || null,
        expiry_date: expiryDate || null,
        updated_by_staff: staffUser.full_name
      }
    });

    res.json({ message: 'RTR data updated successfully' });
  } catch (error: any) {
    console.error('Error updating RTR data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get verification progress for a reference
router.get('/person/:referenceId/progress', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const progress = await getVerificationProgress(referenceId);

    res.json(progress);
  } catch (error: any) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single section by ID
router.get('/sections/:sectionId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const section = await getSection(sectionId);

    if (!section) {
      return res.status(404).json({ error: 'Section not found' });
    }

    res.json({ section });
  } catch (error: any) {
    console.error('Error fetching section:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set section decision to PASS
router.post('/sections/:sectionId/pass', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { notes } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const section = await setPass(sectionId, staffUser.id, notes);

    res.json({
      message: 'Section passed',
      section
    });
  } catch (error: any) {
    console.error('Error setting pass:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set section decision to PASS_WITH_CONDITION
router.post('/sections/:sectionId/pass-with-condition', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { conditionText, notes } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!conditionText?.trim()) {
      return res.status(400).json({ error: 'Condition text is required' });
    }

    const section = await setPassWithCondition(
      sectionId,
      staffUser.id,
      { conditionText },
      notes
    );

    res.json({
      message: 'Section passed with condition',
      section
    });
  } catch (error: any) {
    console.error('Error setting pass with condition:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set section decision to ACTION_REQUIRED
router.post('/sections/:sectionId/action-required', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { reasonCode, agentNote, internalNote, notes } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!reasonCode?.trim()) {
      return res.status(400).json({ error: 'Reason code is required' });
    }

    if (!agentNote?.trim()) {
      return res.status(400).json({ error: 'Agent note is required' });
    }

    const section = await setActionRequired(
      sectionId,
      staffUser.id,
      { reasonCode, agentNote, internalNote },
      notes
    );

    res.json({
      message: 'Section marked as action required - verification returned to agent',
      section
    });
  } catch (error: any) {
    console.error('Error setting action required:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set section decision to FAIL
router.post('/sections/:sectionId/fail', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { failReason, notes } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!failReason?.trim()) {
      return res.status(400).json({ error: 'Fail reason is required' });
    }

    const section = await setFail(
      sectionId,
      staffUser.id,
      { failReason },
      notes
    );

    res.json({
      message: 'Section failed',
      section
    });
  } catch (error: any) {
    console.error('Error setting fail:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset section to NOT_REVIEWED
router.post('/sections/:sectionId/reset', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const section = await resetSection(sectionId, staffUser.id);

    res.json({
      message: 'Section reset',
      section
    });
  } catch (error: any) {
    console.error('Error resetting section:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update section checks
router.patch('/sections/:sectionId/checks', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { checks } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!Array.isArray(checks)) {
      return res.status(400).json({ error: 'Checks must be an array' });
    }

    const section = await updateSectionChecks(sectionId, checks, staffUser.id);

    res.json({ section });
  } catch (error: any) {
    console.error('Error updating checks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update section evidence sources
router.patch('/sections/:sectionId/evidence', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { evidenceSources } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    if (!Array.isArray(evidenceSources)) {
      return res.status(400).json({ error: 'Evidence sources must be an array' });
    }

    const section = await updateEvidenceSources(sectionId, evidenceSources, staffUser.id);

    res.json({ section });
  } catch (error: any) {
    console.error('Error updating evidence:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unified section update (PATCH)
router.patch('/sections/:sectionId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params;
    const { decision, conditionText, actionReasonCode, actionAgentNote, actionInternalNote, failReason, notes } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    let section;

    switch (decision) {
      case 'PASS':
        section = await setPass(sectionId, staffUser.id, notes);
        break;
      case 'PASS_WITH_CONDITION':
        if (!conditionText?.trim()) {
          return res.status(400).json({ error: 'Condition text is required for PASS_WITH_CONDITION' });
        }
        section = await setPassWithCondition(sectionId, staffUser.id, { conditionText }, notes);
        break;
      case 'ACTION_REQUIRED':
        if (!actionReasonCode?.trim()) {
          return res.status(400).json({ error: 'Reason code is required for ACTION_REQUIRED' });
        }
        if (!actionAgentNote?.trim()) {
          return res.status(400).json({ error: 'Agent note is required for ACTION_REQUIRED' });
        }
        section = await setActionRequired(sectionId, staffUser.id, {
          reasonCode: actionReasonCode,
          agentNote: actionAgentNote,
          internalNote: actionInternalNote
        }, notes);
        break;
      case 'FAIL':
        if (!failReason?.trim()) {
          return res.status(400).json({ error: 'Fail reason is required for FAIL' });
        }
        section = await setFail(sectionId, staffUser.id, { failReason }, notes);
        break;
      case 'NOT_REVIEWED':
        section = await resetSection(sectionId, staffUser.id);
        break;
      default:
        return res.status(400).json({ error: `Invalid decision: ${decision}` });
    }

    res.json({ section });
  } catch (error: any) {
    console.error('Error updating section:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// LOOKUP ENDPOINTS
// ============================================================================

// Get action reason codes
router.get('/reason-codes', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionType } = req.query;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const codes = await getActionReasonCodes(sectionType as any);

    res.json({ codes });
  } catch (error: any) {
    console.error('Error fetching reason codes:', error);
    res.status(500).json({ error: error.message });
  }
});

// Alias: Get action reason codes (for frontend compatibility)
router.get('/action-codes', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionType } = req.query;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const codes = await getActionReasonCodes(sectionType as any);

    res.json({ codes });
  } catch (error: any) {
    console.error('Error fetching action codes:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CONFIRMATION ENDPOINTS
// ============================================================================

// Confirm income for a reference
router.post('/confirm-income/:referenceId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const {
      confirmedSalary,
      confirmedBenefits,
      confirmedSelfEmployed,
      confirmedSavings,
      confirmedAdditional,
      confirmedPension,
      confirmedLandlordRental,
      confirmedTotal
    } = req.body;

    // Validate that at least confirmedTotal is provided
    if (confirmedTotal === undefined || confirmedTotal === null) {
      return res.status(400).json({ error: 'Confirmed total income is required' });
    }

    // Get reference to check it exists and get monthly rent
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select('id, monthly_rent, is_guarantor')
      .eq('id', referenceId)
      .single();

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    // Encrypt the confirmed income values
    const updateData: Record<string, any> = {
      confirmed_income_at: new Date().toISOString(),
      confirmed_income_by: staffUser.id,
      updated_at: new Date().toISOString()
    };

    // Update verified_* fields with encrypted values
    if (confirmedSalary !== undefined) {
      updateData.verified_salary_amount_encrypted = encrypt(confirmedSalary.toString());
    }
    if (confirmedBenefits !== undefined) {
      updateData.verified_benefits_amount_encrypted = encrypt(confirmedBenefits.toString());
    }
    if (confirmedSelfEmployed !== undefined) {
      updateData.verified_self_employed_income_encrypted = encrypt(confirmedSelfEmployed.toString());
    }
    if (confirmedSavings !== undefined) {
      updateData.verified_savings_amount_encrypted = encrypt(confirmedSavings.toString());
    }
    if (confirmedAdditional !== undefined) {
      updateData.verified_additional_income_amount_encrypted = encrypt(confirmedAdditional.toString());
    }
    if (confirmedPension !== undefined) {
      updateData.verified_pension_amount_encrypted = encrypt(confirmedPension.toString());
    }
    if (confirmedLandlordRental !== undefined) {
      updateData.verified_landlord_rental_amount_encrypted = encrypt(confirmedLandlordRental.toString());
    }
    if (confirmedTotal !== undefined) {
      updateData.verified_total_income_encrypted = encrypt(confirmedTotal.toString());
    }

    // Calculate affordability
    const monthlyRent = reference.monthly_rent || 0;
    const annualRent = monthlyRent * 12;
    const affordabilityRatio = annualRent > 0 ? confirmedTotal / annualRent : 0;
    // Tenants = income/30, Guarantors = income/32
    const divisor = reference.is_guarantor ? 32 : 30;
    const affordableRent = Math.round(confirmedTotal / divisor);

    // Update the reference (without income_ratio - that's in reference_scores)
    const { error: updateError } = await supabaseAdmin
      .from('tenant_references')
      .update(updateData)
      .eq('id', referenceId);

    if (updateError) {
      throw updateError;
    }

    // Update income_ratio in reference_scores (upsert to create if doesn't exist)
    const incomeRatioValue = Math.round(affordabilityRatio * 100) / 100;
    const { error: scoreError } = await supabaseAdmin
      .from('reference_scores')
      .upsert({
        reference_id: referenceId,
        income_ratio: incomeRatioValue,
        updated_at: new Date().toISOString()
      }, { onConflict: 'reference_id' });

    if (scoreError) {
      console.error('Error updating reference_scores:', scoreError);
      // Don't fail the whole operation if score update fails
    }

    // Log audit
    await logAuditAction({
      referenceId,
      action: 'INCOME_CONFIRMED',
      description: `Staff confirmed income: £${confirmedTotal.toLocaleString()}/year`,
      metadata: {
        confirmedSalary,
        confirmedBenefits,
        confirmedSelfEmployed,
        confirmedSavings,
        confirmedAdditional,
        confirmedTotal,
        affordabilityRatio,
        affordableRent,
        visible_to_agent: false
      },
      userId: staffUser.id
    });

    // Get staff name for response
    const { data: staffData } = await supabaseAdmin
      .from('staff_users')
      .select('full_name')
      .eq('id', staffUser.id)
      .single();

    res.json({
      success: true,
      confirmedIncome: confirmedTotal,
      affordabilityRatio: Math.round(affordabilityRatio * 100) / 100,
      affordableRent,
      confirmedBy: staffData?.full_name || 'Staff',
      confirmedAt: updateData.confirmed_income_at
    });
  } catch (error: any) {
    console.error('Error confirming income:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirm residential status for a reference
router.post('/confirm-residential/:referenceId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { status } = req.body;

    // Validate status
    const validStatuses = ['VERIFIED', 'LIVING_WITH_FAMILY', 'OWNER_OCCUPIER'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    // Check reference exists
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select('id')
      .eq('id', referenceId)
      .single();

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    // Update the reference with confirmed residential status
    const confirmedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('tenant_references')
      .update({
        confirmed_residential_status: status,
        confirmed_residential_at: confirmedAt,
        confirmed_residential_by: staffUser.id,
        updated_at: confirmedAt
      })
      .eq('id', referenceId);

    if (updateError) {
      throw updateError;
    }

    // Log audit
    await logAuditAction({
      referenceId,
      action: 'RESIDENTIAL_CONFIRMED',
      description: `Staff confirmed residential status: ${status}`,
      metadata: {
        confirmedStatus: status,
        visible_to_agent: false
      },
      userId: staffUser.id
    });

    // Cleanup any stale chase dependencies (e.g., RESIDENTIAL_REF no longer needed)
    await cleanupStaleDependencies(referenceId);

    // Get staff name for response
    const { data: staffData } = await supabaseAdmin
      .from('staff_users')
      .select('full_name')
      .eq('id', staffUser.id)
      .single();

    res.json({
      success: true,
      confirmedStatus: status,
      confirmedBy: staffData?.full_name || 'Staff',
      confirmedAt
    });
  } catch (error: any) {
    console.error('Error confirming residential:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get evidence files and references for a reference
router.get('/evidence/:referenceId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Get reference with income-related fields
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select(`
        id,
        employment_salary_amount_encrypted,
        benefits_annual_amount_encrypted,
        self_employed_annual_income_encrypted,
        additional_income_amount_encrypted,
        guarantor_for_reference_id,
        verified_salary_amount_encrypted,
        verified_benefits_amount_encrypted,
        verified_self_employed_income_encrypted,
        verified_savings_amount_encrypted,
        verified_additional_income_amount_encrypted,
        verified_total_income_encrypted,
        verified_pension_amount_encrypted,
        verified_landlord_rental_amount_encrypted,
        confirmed_income_at,
        confirmed_income_by,
        confirmed_residential_status,
        confirmed_residential_at,
        confirmed_residential_by,
        previous_rental_address_line1_encrypted,
        previous_rental_city_encrypted,
        previous_rental_postcode_encrypted,
        previous_tenancy_start_date,
        previous_tenancy_end_date,
        monthly_rent,
        rent_share,
        is_guarantor,
        created_at,
        payslip_files,
        bank_statements_paths,
        tax_return_path,
        proof_of_additional_income_path,
        proof_of_funds_path,
        id_document_path,
        selfie_path,
        proof_of_address_path,
        income_pension,
        pension_monthly_amount_encrypted,
        pension_provider_encrypted,
        pension_statement_path,
        income_landlord_rental,
        landlord_rental_monthly_amount_encrypted,
        landlord_rental_bank_statement_path
      `)
      .eq('id', referenceId)
      .single();

    if (refError) {
      console.error('Error fetching reference for evidence:', refError);
      return res.status(500).json({ error: 'Failed to fetch reference data', details: refError.message });
    }

    if (!reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    // Build evidence arrays from file path columns in tenant_references
    // (reference_evidence table doesn't exist - files are stored as paths in tenant_references)
    const buildEvidenceFromPaths = () => {
      const evidence: any[] = [];

      // Helper to create evidence object from file path
      // Paths are already in format: referenceId/folder/filename
      const addEvidence = (path: string | null, type: string, label: string) => {
        if (path) {
          evidence.push({
            id: `${type}-${path}`,
            file_url: path,
            file_name: path.split('/').pop() || label,
            file_type: path.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/*',
            evidence_type: type,
            created_at: reference.created_at
          });
        }
      };

      // Add payslips (array - stored as payslip_files)
      if (reference.payslip_files && Array.isArray(reference.payslip_files)) {
        reference.payslip_files.forEach((path: string, idx: number) => {
          addEvidence(path, 'PAYSLIP', `Payslip ${idx + 1}`);
        });
      }

      // Add bank statements (array - stored as bank_statements_paths)
      if (reference.bank_statements_paths && Array.isArray(reference.bank_statements_paths)) {
        reference.bank_statements_paths.forEach((path: string, idx: number) => {
          addEvidence(path, 'BANK_STATEMENT', `Bank Statement ${idx + 1}`);
        });
      }

      // Add single file evidence - Income related
      addEvidence(reference.tax_return_path, 'TAX_RETURN', 'Tax Return');
      addEvidence(reference.proof_of_additional_income_path, 'ADDITIONAL_INCOME', 'Additional Income Proof');
      addEvidence(reference.proof_of_funds_path, 'PROOF_OF_FUNDS', 'Proof of Funds');
      addEvidence(reference.pension_statement_path, 'PENSION_STATEMENT', 'Pension Statement');
      addEvidence(reference.landlord_rental_bank_statement_path, 'LANDLORD_RENTAL_BANK_STATEMENT', 'Landlord/Rental Income Bank Statement');

      // Identity related
      addEvidence(reference.id_document_path, 'ID_DOCUMENT', 'ID Document');
      addEvidence(reference.selfie_path, 'SELFIE', 'Selfie');

      // Residential related
      addEvidence(reference.proof_of_address_path, 'PROOF_OF_ADDRESS', 'Proof of Address');

      return evidence;
    };

    const evidenceFiles = buildEvidenceFromPaths();

    // Get employer reference if exists
    const { data: employerReferences, error: employerReferenceError } = await supabaseAdmin
      .from('employer_references')
      .select('*')
      .eq('reference_id', referenceId)
      .not('submitted_at', 'is', null)
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .limit(5);

    if (employerReferenceError) {
      console.error('Error fetching employer reference:', employerReferenceError);
    }

    // Only return employer references that have actual data (not empty submissions)
    const employerReference = (employerReferences || []).find((ref: any) =>
      ref.annual_salary_encrypted ||
      ref.employer_name_encrypted ||
      ref.company_name_encrypted ||
      ref.employee_position_encrypted ||
      ref.employment_start_date ||
      ref.employment_status
    ) || null; // Changed: Don't use empty employer references as fallback

    // Get accountant reference if exists
    const { data: accountantReference } = await supabaseAdmin
      .from('accountant_references')
      .select('*')
      .eq('tenant_reference_id', referenceId)
      .single();

    // Get landlord reference if exists
    const { data: landlordReference } = await supabaseAdmin
      .from('landlord_references')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    // Get agent reference if exists
    const { data: agentReference } = await supabaseAdmin
      .from('agent_references')
      .select('*')
      .eq('reference_id', referenceId)
      .single();

    // Get uploaded documents from reference_documents table
    const { data: referenceDocuments } = await supabaseAdmin
      .from('reference_documents')
      .select('*')
      .eq('reference_id', referenceId)
      .order('created_at', { ascending: false });

    // Get staff names for confirmed by fields
    let incomeConfirmedByName = null;
    let residentialConfirmedByName = null;

    if (reference.confirmed_income_by) {
      const { data: staffData } = await supabaseAdmin
        .from('staff_users')
        .select('full_name')
        .eq('id', reference.confirmed_income_by)
        .single();
      incomeConfirmedByName = staffData?.full_name;
    }

    if (reference.confirmed_residential_by) {
      const { data: staffData } = await supabaseAdmin
        .from('staff_users')
        .select('full_name')
        .eq('id', reference.confirmed_residential_by)
        .single();
      residentialConfirmedByName = staffData?.full_name;
    }

    // Decrypt claimed income values
    // All income fields are stored as annual amounts
    const salaryAmount = reference.employment_salary_amount_encrypted
      ? parseFloat(decrypt(reference.employment_salary_amount_encrypted) || '0') : 0;
    const additionalIncomeAmount = reference.additional_income_amount_encrypted
      ? parseFloat(decrypt(reference.additional_income_amount_encrypted) || '0') : 0;
    const selfEmployedIncome = reference.self_employed_annual_income_encrypted
      ? parseFloat(decrypt(reference.self_employed_annual_income_encrypted) || '0') : 0;
    const benefitsIncome = reference.benefits_annual_amount_encrypted
      ? parseFloat(decrypt(reference.benefits_annual_amount_encrypted) || '0') : 0;

    // Pension income (monthly stored, convert to annual for display)
    const pensionMonthlyAmount = reference.pension_monthly_amount_encrypted
      ? parseFloat(decrypt(reference.pension_monthly_amount_encrypted) || '0') : 0;
    const pensionAnnualAmount = pensionMonthlyAmount * 12;
    const pensionProvider = reference.pension_provider_encrypted
      ? decrypt(reference.pension_provider_encrypted) : null;

    // Landlord/Rental income (monthly stored, convert to annual for display)
    const landlordRentalMonthlyAmount = reference.landlord_rental_monthly_amount_encrypted
      ? parseFloat(decrypt(reference.landlord_rental_monthly_amount_encrypted) || '0') : 0;
    const landlordRentalAnnualAmount = landlordRentalMonthlyAmount * 12;

    const claimedTotal = salaryAmount + additionalIncomeAmount + selfEmployedIncome + benefitsIncome + pensionAnnualAmount + landlordRentalAnnualAmount;

    const claimedIncome = {
      salary: salaryAmount,
      benefits: benefitsIncome,
      selfEmployed: selfEmployedIncome,
      savings: 0,
      additional: additionalIncomeAmount,
      pension: pensionAnnualAmount,
      pensionMonthly: pensionMonthlyAmount,
      pensionProvider: pensionProvider,
      landlordRental: landlordRentalAnnualAmount,
      landlordRentalMonthly: landlordRentalMonthlyAmount,
      total: claimedTotal
    };

    // Decrypt verified income values (if they exist)
    const verifiedIncome = {
      salary: reference.verified_salary_amount_encrypted ? parseFloat(decrypt(reference.verified_salary_amount_encrypted) || '0') : null,
      benefits: reference.verified_benefits_amount_encrypted ? parseFloat(decrypt(reference.verified_benefits_amount_encrypted) || '0') : null,
      selfEmployed: reference.verified_self_employed_income_encrypted ? parseFloat(decrypt(reference.verified_self_employed_income_encrypted) || '0') : null,
      savings: reference.verified_savings_amount_encrypted ? parseFloat(decrypt(reference.verified_savings_amount_encrypted) || '0') : null,
      additional: reference.verified_additional_income_amount_encrypted ? parseFloat(decrypt(reference.verified_additional_income_amount_encrypted) || '0') : null,
      pension: reference.verified_pension_amount_encrypted ? parseFloat(decrypt(reference.verified_pension_amount_encrypted) || '0') : null,
      landlordRental: reference.verified_landlord_rental_amount_encrypted ? parseFloat(decrypt(reference.verified_landlord_rental_amount_encrypted) || '0') : null,
      total: reference.verified_total_income_encrypted ? parseFloat(decrypt(reference.verified_total_income_encrypted) || '0') : null,
      confirmedAt: reference.confirmed_income_at,
      confirmedBy: incomeConfirmedByName
    };

    // Categorize evidence files
    const incomeEvidence = (evidenceFiles || []).filter((f: any) =>
      ['PAYSLIP', 'BANK_STATEMENT', 'EMPLOYMENT_CONTRACT', 'TAX_RETURN', 'P60', 'P45', 'ACCOUNTANT_LETTER', 'ADDITIONAL_INCOME', 'PROOF_OF_FUNDS', 'PENSION_STATEMENT', 'LANDLORD_RENTAL_BANK_STATEMENT'].includes(f.evidence_type)
    );

    const residentialEvidence = (evidenceFiles || []).filter((f: any) =>
      ['LANDLORD_REFERENCE', 'TENANCY_AGREEMENT', 'UTILITY_BILL', 'COUNCIL_TAX', 'PROOF_OF_ADDRESS'].includes(f.evidence_type)
    );

    const idEvidence = (evidenceFiles || []).filter((f: any) =>
      ['ID_DOCUMENT', 'SELFIE', 'PASSPORT', 'DRIVING_LICENSE'].includes(f.evidence_type)
    );

    // Decrypt employer reference fields if exists
    let decryptedEmployerReference = null;
    const decryptField = (value: any) => {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value !== 'string') return value;
      try {
        return decrypt(value);
      } catch {
        return value;
      }
    };

    const getFirstValue = (...values: any[]) => {
      for (const value of values) {
        if (value !== null && value !== undefined && value !== '') {
          return value;
        }
      }
      return null;
    };

    const getDecryptedValue = (...values: any[]) => {
      const decryptedValues = values.map(decryptField);
      return getFirstValue(...decryptedValues);
    };

    const getDecryptedNumber = (...values: any[]) => {
      const raw = getDecryptedValue(...values);
      if (raw === null || raw === undefined || raw === '') return null;
      const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw));
      return Number.isFinite(parsed) ? parsed : null;
    };

    if (employerReference) {
      const employerRefAny = employerReference as any;
      decryptedEmployerReference = {
        id: employerReference.id,
        employerName: getDecryptedValue(
          employerRefAny.employer_name_encrypted,
          employerRefAny.employer_name
        ),
        contactName: getDecryptedValue(
          employerRefAny.contact_name_encrypted,
          employerRefAny.contact_name
        ),
        contactEmail: getDecryptedValue(
          employerRefAny.contact_email_encrypted,
          employerRefAny.contact_email,
          employerRefAny.employer_email_encrypted,
          employerRefAny.employer_email
        ),
        contactPhone: getDecryptedValue(
          employerRefAny.employer_phone_encrypted,
          employerRefAny.employer_phone,
          employerRefAny.contact_phone_encrypted,
          employerRefAny.contact_phone
        ),
        jobTitle: getDecryptedValue(
          employerRefAny.employee_position_encrypted,
          employerRefAny.employee_position
        ),
        employmentStartDate: getFirstValue(
          employerRefAny.employment_start_date,
          employerRefAny.employment_start
        ),
        employmentEndDate: employerReference.employment_end_date,
        salary: getDecryptedNumber(
          employerRefAny.annual_salary_encrypted,
          employerRefAny.annual_salary
        ),
        salaryFrequency: employerReference.salary_frequency,
        employmentStatus: employerReference.employment_status,
        isCurrentlyEmployed: employerReference.is_current_employee,
        employmentType: employerReference.employment_type || null,
        isProbation: employerReference.is_probation,
        probationEndDate: employerReference.probation_end_date,
        submittedAt: employerReference.submitted_at,
        signaturePath: employerReference.signature_path,
        // Additional fields
        companyName: getDecryptedValue(
          employerRefAny.company_name_encrypted,
          employerRefAny.employer_company_encrypted,
          employerRefAny.company_name,
          employerRefAny.employer_company
        ),
        employerPosition: getDecryptedValue(
          employerRefAny.employer_position_encrypted,
          employerRefAny.employer_position
        ),
        clarificationDetails: getDecryptedValue(
          employerRefAny.clarification_details_encrypted,
          employerRefAny.clarification_details
        ),
        contractTypeConfirmation: employerReference.contract_type_confirmation,
        incomeExpectation: employerReference.income_expectation,
        incomeExpectationDetails: employerReference.income_expectation_details,
        employmentStable: employerReference.employment_stable,
        employmentStableDetails: getDecryptedValue(
          employerRefAny.employment_stable_details_encrypted,
          employerRefAny.employment_stable_details
        ),
        additionalComments: getDecryptedValue(
          employerRefAny.additional_comments_encrypted,
          employerRefAny.additional_comments
        ),
        wouldReemployDetails: getDecryptedValue(
          employerRefAny.would_reemploy_details_encrypted,
          employerRefAny.would_reemploy_details
        ),
        performanceDetails: getDecryptedValue(
          employerRefAny.performance_details_encrypted,
          employerRefAny.performance_details
        ),
        disciplinaryDetails: getDecryptedValue(
          employerRefAny.disciplinary_details_encrypted,
          employerRefAny.disciplinary_details
        ),
        absenceDetails: getDecryptedValue(
          employerRefAny.absence_details_encrypted,
          employerRefAny.absence_details
        ),
        signature: getDecryptedValue(
          employerRefAny.signature_encrypted,
          employerRefAny.signature
        ),
        signatureDate: employerReference.date
      };
    }

    // Decrypt accountant reference fields if exists
    let decryptedAccountantReference = null;
    if (accountantReference) {
      // Calculate years trading from business_start_date
      let yearsTrading = null;
      if (accountantReference.business_start_date) {
        const startDate = new Date(accountantReference.business_start_date);
        yearsTrading = Math.floor((Date.now() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      }

      // Get annual income - prefer estimated_monthly_income * 12, fallback to annual_profit
      let annualIncome = null;
      if (accountantReference.estimated_monthly_income_encrypted) {
        const monthly = parseFloat(decrypt(accountantReference.estimated_monthly_income_encrypted) || '0');
        annualIncome = monthly * 12;
      } else if (accountantReference.annual_profit_encrypted) {
        annualIncome = parseFloat(decrypt(accountantReference.annual_profit_encrypted) || '0');
      }

      decryptedAccountantReference = {
        id: accountantReference.id,
        accountantName: accountantReference.accountant_name_encrypted ? decrypt(accountantReference.accountant_name_encrypted) : null,
        firmName: accountantReference.accountant_firm_encrypted ? decrypt(accountantReference.accountant_firm_encrypted) : null,
        contactEmail: accountantReference.accountant_email_encrypted ? decrypt(accountantReference.accountant_email_encrypted) : null,
        contactPhone: accountantReference.accountant_phone_encrypted ? decrypt(accountantReference.accountant_phone_encrypted) : null,
        annualIncome,
        yearsTrading,
        submittedAt: accountantReference.submitted_at,
        signaturePath: accountantReference.signature_path,
        // Additional fields
        businessName: accountantReference.business_name_encrypted ? decrypt(accountantReference.business_name_encrypted) : null,
        natureOfBusiness: accountantReference.nature_of_business_encrypted ? decrypt(accountantReference.nature_of_business_encrypted) : null,
        annualTurnover: accountantReference.annual_turnover_encrypted ? parseFloat(decrypt(accountantReference.annual_turnover_encrypted) || '0') : null,
        annualProfit: accountantReference.annual_profit_encrypted ? parseFloat(decrypt(accountantReference.annual_profit_encrypted) || '0') : null,
        businessStartDate: accountantReference.business_start_date,
        businessTradingStatus: accountantReference.business_trading_status,
        taxReturnsFiled: accountantReference.tax_returns_filed,
        lastTaxReturnDate: accountantReference.last_tax_return_date,
        accountsPrepared: accountantReference.accounts_prepared,
        accountsYearEnd: accountantReference.accounts_year_end,
        anyOutstandingTaxLiabilities: accountantReference.any_outstanding_tax_liabilities,
        taxLiabilitiesDetails: accountantReference.tax_liabilities_details_encrypted ? decrypt(accountantReference.tax_liabilities_details_encrypted) : null,
        businessFinanciallyStable: accountantReference.business_financially_stable,
        accountantConfirmsIncome: accountantReference.accountant_confirms_income,
        wouldRecommend: accountantReference.would_recommend,
        additionalComments: accountantReference.additional_comments_encrypted ? decrypt(accountantReference.additional_comments_encrypted) : null,
        recommendationComments: accountantReference.recommendation_comments_encrypted ? decrypt(accountantReference.recommendation_comments_encrypted) : null,
        signature: accountantReference.signature_encrypted ? decrypt(accountantReference.signature_encrypted) : null,
        signatureDate: accountantReference.date
      };
    }

    // Decrypt landlord reference fields if exists
    let decryptedLandlordReference = null;
    if (landlordReference) {
      decryptedLandlordReference = {
        id: landlordReference.id,
        landlordName: landlordReference.landlord_name_encrypted ? decrypt(landlordReference.landlord_name_encrypted) : null,
        landlordEmail: landlordReference.landlord_email_encrypted ? decrypt(landlordReference.landlord_email_encrypted) : null,
        landlordPhone: landlordReference.landlord_phone_encrypted ? decrypt(landlordReference.landlord_phone_encrypted) : null,
        propertyAddress: landlordReference.property_address_encrypted ? decrypt(landlordReference.property_address_encrypted) : null,
        propertyCity: landlordReference.property_city_encrypted ? decrypt(landlordReference.property_city_encrypted) : null,
        propertyPostcode: landlordReference.property_postcode_encrypted ? decrypt(landlordReference.property_postcode_encrypted) : null,
        tenancyStartDate: landlordReference.tenancy_start_date,
        tenancyEndDate: landlordReference.tenancy_end_date,
        tenancyLengthMonths: landlordReference.tenancy_length_months,
        monthlyRent: landlordReference.monthly_rent_encrypted ? parseFloat(decrypt(landlordReference.monthly_rent_encrypted) || '0') : null,
        monthlyRentConfirm: landlordReference.monthly_rent_confirm,
        rentPaidOnTime: landlordReference.rent_paid_on_time,
        wouldRentAgain: landlordReference.would_rent_again,
        propertyCondition: landlordReference.property_condition,
        additionalComments: landlordReference.additional_comments_encrypted ? decrypt(landlordReference.additional_comments_encrypted) : null,
        submittedAt: landlordReference.submitted_at,
        signaturePath: landlordReference.signature_path,
        // Additional reference questions
        rentPaidOnTimeDetails: landlordReference.rent_paid_on_time_details,
        propertyConditionDetails: landlordReference.property_condition_details,
        neighbourComplaints: landlordReference.neighbour_complaints,
        neighbourComplaintsDetails: landlordReference.neighbour_complaints_details,
        breachOfTenancy: landlordReference.breach_of_tenancy,
        breachOfTenancyDetails: landlordReference.breach_of_tenancy_details,
        wouldRentAgainDetails: landlordReference.would_rent_again_details,
        tenancyStillInProgress: landlordReference.tenancy_still_in_progress,
        // Good tenant and address correction fields
        goodTenant: landlordReference.good_tenant,
        addressCorrect: landlordReference.address_correct,
        correctedAddressLine1: landlordReference.corrected_address_line1_encrypted ? decrypt(landlordReference.corrected_address_line1_encrypted) : null,
        correctedAddressLine2: landlordReference.corrected_address_line2_encrypted ? decrypt(landlordReference.corrected_address_line2_encrypted) : null,
        correctedCity: landlordReference.corrected_city_encrypted ? decrypt(landlordReference.corrected_city_encrypted) : null,
        correctedPostcode: landlordReference.corrected_postcode_encrypted ? decrypt(landlordReference.corrected_postcode_encrypted) : null,
        signatureName: landlordReference.signature_name_encrypted ? decrypt(landlordReference.signature_name_encrypted) : null,
        signature: landlordReference.signature_encrypted ? decrypt(landlordReference.signature_encrypted) : null,
        signatureDate: landlordReference.date
      };
    }

    // Decrypt agent reference fields if exists
    let decryptedAgentReference = null;
    if (agentReference) {
      decryptedAgentReference = {
        id: agentReference.id,
        agentName: agentReference.agent_name_encrypted ? decrypt(agentReference.agent_name_encrypted) : null,
        agencyName: agentReference.agency_name_encrypted ? decrypt(agentReference.agency_name_encrypted) : null,
        agentEmail: agentReference.agent_email_encrypted ? decrypt(agentReference.agent_email_encrypted) : null,
        agentPhone: agentReference.agent_phone_encrypted ? decrypt(agentReference.agent_phone_encrypted) : null,
        propertyAddress: agentReference.property_address_encrypted ? decrypt(agentReference.property_address_encrypted) : null,
        tenancyStartDate: agentReference.tenancy_start_date,
        tenancyEndDate: agentReference.tenancy_end_date,
        monthlyRent: agentReference.monthly_rent_encrypted ? parseFloat(decrypt(agentReference.monthly_rent_encrypted) || '0') : null,
        rentPaidOnTime: agentReference.rent_paid_on_time,
        wouldRentAgain: agentReference.would_rent_again,
        additionalComments: agentReference.additional_comments,
        submittedAt: agentReference.submitted_at,
        signaturePath: agentReference.signature_path,
        // Additional reference questions
        rentPaidOnTimeDetails: agentReference.rent_paid_on_time_details,
        neighbourComplaints: agentReference.neighbour_complaints,
        neighbourComplaintsDetails: agentReference.neighbour_complaints_details,
        breachOfTenancy: agentReference.breach_of_tenancy,
        breachOfTenancyDetails: agentReference.breach_of_tenancy_details,
        wouldRentAgainDetails: agentReference.would_rent_again_details,
        tenancyStillInProgress: agentReference.tenancy_still_in_progress,
        // Property city and postcode
        propertyCity: agentReference.property_city_encrypted ? decrypt(agentReference.property_city_encrypted) : null,
        propertyPostcode: agentReference.property_postcode_encrypted ? decrypt(agentReference.property_postcode_encrypted) : null,
        // Good tenant and address correction fields
        goodTenant: agentReference.good_tenant,
        addressCorrect: agentReference.address_correct,
        correctedAddressLine1: agentReference.corrected_address_line1_encrypted ? decrypt(agentReference.corrected_address_line1_encrypted) : null,
        correctedAddressLine2: agentReference.corrected_address_line2_encrypted ? decrypt(agentReference.corrected_address_line2_encrypted) : null,
        correctedCity: agentReference.corrected_city_encrypted ? decrypt(agentReference.corrected_city_encrypted) : null,
        correctedPostcode: agentReference.corrected_postcode_encrypted ? decrypt(agentReference.corrected_postcode_encrypted) : null,
        signatureName: agentReference.signature_name_encrypted ? decrypt(agentReference.signature_name_encrypted) : null,
        signature: agentReference.signature_encrypted ? decrypt(agentReference.signature_encrypted) : null,
        signatureDate: agentReference.date
      };
    }

    // Get rent amount - for guarantors, get parent tenant's rent_share if needed
    let rentForDisplay = reference.rent_share || reference.monthly_rent;
    if (reference.is_guarantor && !reference.rent_share && reference.guarantor_for_reference_id) {
      const { data: parentRef } = await supabaseAdmin
        .from('tenant_references')
        .select('rent_share')
        .eq('id', reference.guarantor_for_reference_id)
        .single();
      if (parentRef?.rent_share) {
        rentForDisplay = parentRef.rent_share;
      }
    }

    // Get previous addresses from tenant_reference_previous_addresses table
    const { data: previousAddressesData } = await supabaseAdmin
      .from('tenant_reference_previous_addresses')
      .select('*')
      .eq('tenant_reference_id', referenceId)
      .order('address_order', { ascending: true });

    const previousAddresses = (previousAddressesData || []).map((addr: any) => ({
      line1: decrypt(addr.address_line1_encrypted),
      line2: decrypt(addr.address_line2_encrypted),
      city: decrypt(addr.city_encrypted),
      postcode: decrypt(addr.postcode_encrypted),
      country: decrypt(addr.country_encrypted),
      movedIn: addr.moved_in,
      addressOrder: addr.address_order
    }));

    // Get guarantor financial data if this is a guarantor
    let guarantorFinancialData = null;
    if (reference.is_guarantor) {
      const { data: guarantorData } = await supabaseAdmin
        .from('guarantor_references')
        .select('*')
        .eq('reference_id', referenceId)
        .single();

      if (guarantorData) {
        guarantorFinancialData = {
          homeOwnershipStatus: guarantorData.home_ownership_status,
          propertyValue: guarantorData.property_value_encrypted
            ? parseFloat(decrypt(guarantorData.property_value_encrypted) || '0') : null,
          monthlyMortgageRent: guarantorData.monthly_mortgage_rent_encrypted
            ? parseFloat(decrypt(guarantorData.monthly_mortgage_rent_encrypted) || '0') : null,
          pensionAmount: guarantorData.pension_amount_encrypted
            ? parseFloat(decrypt(guarantorData.pension_amount_encrypted) || '0') : null,
          pensionFrequency: guarantorData.pension_frequency,
          otherMonthlyCommitments: guarantorData.other_monthly_commitments_encrypted
            ? parseFloat(decrypt(guarantorData.other_monthly_commitments_encrypted) || '0') : null,
          totalMonthlyExpenditure: guarantorData.total_monthly_expenditure_encrypted
            ? parseFloat(decrypt(guarantorData.total_monthly_expenditure_encrypted) || '0') : null,
          understandsObligations: guarantorData.understands_obligations,
          willingToPayRent: guarantorData.willing_to_pay_rent,
          willingToPayDamages: guarantorData.willing_to_pay_damages,
          previouslyActedAsGuarantor: guarantorData.previously_acted_as_guarantor,
          adverseCredit: guarantorData.adverse_credit,
          adverseCreditDetails: guarantorData.adverse_credit_details_encrypted
            ? decrypt(guarantorData.adverse_credit_details_encrypted) : null
        };
      }
    }

    res.json({
      claimedIncome,
      verifiedIncome,
      incomeEvidence,
      residentialEvidence,
      idEvidence,
      employerReference: decryptedEmployerReference,
      accountantReference: decryptedAccountantReference,
      landlordReference: decryptedLandlordReference,
      agentReference: decryptedAgentReference,
      residential: {
        previousAddress: reference.previous_rental_address_line1_encrypted
          ? `${decrypt(reference.previous_rental_address_line1_encrypted)}, ${decrypt(reference.previous_rental_city_encrypted) || ''} ${decrypt(reference.previous_rental_postcode_encrypted) || ''}`.trim()
          : null,
        tenancyStart: reference.previous_tenancy_start_date,
        tenancyEnd: reference.previous_tenancy_end_date,
        confirmedStatus: reference.confirmed_residential_status,
        confirmedAt: reference.confirmed_residential_at,
        confirmedBy: residentialConfirmedByName
      },
      previousAddresses,
      employment: {
        type: employerReference?.employment_status || null,
        employerName: decryptedEmployerReference?.employerName || null,
        jobTitle: decryptedEmployerReference?.jobTitle || null,
        startDate: decryptedEmployerReference?.employmentStartDate || null
      },
      monthlyRent: rentForDisplay,
      isGuarantor: reference.is_guarantor,
      guarantorFinancialData,
      referenceDocuments: referenceDocuments || []
    });
  } catch (error: any) {
    console.error('Error fetching evidence:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// FINALIZATION ENDPOINTS
// ============================================================================

// Finalize verification for a reference
router.post('/person/:referenceId/finalize', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const { finalDecision, justification } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Valid final decisions
    const validDecisions = ['PASS', 'PASS_WITH_CONDITION', 'PASS_WITH_GUARANTOR', 'REFER', 'FAIL'];
    if (!validDecisions.includes(finalDecision)) {
      return res.status(400).json({ error: `Invalid final decision. Must be one of: ${validDecisions.join(', ')}` });
    }

    // Check verification progress
    const progress = await getVerificationProgress(referenceId);

    if (!progress.canFinalize) {
      // Allow REFER decision even when sections have ACTION_REQUIRED
      if (progress.hasActionRequired && finalDecision !== 'REFER') {
        return res.status(400).json({ error: 'Cannot finalize - one or more sections require action' });
      }
      if (progress.totalSections === 0 || progress.completedSections < progress.totalSections) {
        return res.status(400).json({ error: 'Cannot finalize - not all sections have been reviewed' });
      }
    }

    // Get reference details
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select('status, is_guarantor')
      .eq('id', referenceId)
      .single();

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    // Update reference status based on decision
    let newStatus = 'completed';
    let newVerificationState: VerificationState = 'COMPLETED';
    if (finalDecision === 'FAIL') {
      newStatus = 'rejected';
      newVerificationState = 'REJECTED';
    }

    // Build update object
    const updateData: Record<string, any> = {
      status: newStatus,
      verification_state: newVerificationState,
      updated_at: new Date().toISOString()
    };

    // If PASS_WITH_GUARANTOR, set requires_guarantor flag
    if (finalDecision === 'PASS_WITH_GUARANTOR' && !reference.is_guarantor) {
      updateData.requires_guarantor = true;
    }

    // Update reference
    const { error: updateError } = await supabaseAdmin
      .from('tenant_references')
      .update(updateData)
      .eq('id', referenceId);

    if (updateError) {
      console.error(`[Finalize] Failed to update reference status:`, updateError);
      return res.status(500).json({ error: 'Failed to update reference status' });
    }

    // Complete any open work items for this reference
    const { error: workItemError } = await supabaseAdmin
      .from('work_items')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('reference_id', referenceId)
      .in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'RETURNED']);

    if (workItemError) {
      console.error(`[Finalize] Failed to complete work items:`, workItemError);
      // Don't fail the request - reference status is already updated
    }

    // Log audit
    await logAuditAction({
      referenceId,
      action: 'VERIFICATION_FINALIZED',
      description: `Verification finalized with decision: ${finalDecision}`,
      metadata: {
        finalDecision,
        justification,
        newStatus,
        sectionsSummary: progress.sections,
        visible_to_agent: true
      },
      userId: staffUser.id
    });

    // Generate PDF report for passing decisions
    let pdfGenerated = false;
    let pdfUrl: string | null = null;

    if (newStatus === 'completed' && ['PASS', 'PASS_WITH_CONDITION', 'PASS_WITH_GUARANTOR'].includes(finalDecision)) {
      try {
        console.log(`[Finalize] Generating PDF report for reference ${referenceId}...`);
        pdfUrl = await generatePassedPdfService(referenceId);
        pdfGenerated = true;
        console.log(`[Finalize] PDF generated and uploaded: ${pdfUrl}`);

        // Save PDF URL to database
        const { error: pdfUpdateError } = await supabaseAdmin
          .from('tenant_references')
          .update({ passed_certificate_url: pdfUrl })
          .eq('id', referenceId);

        if (pdfUpdateError) {
          console.error('[Finalize] Failed to save PDF URL to database:', pdfUpdateError);
        }
      } catch (pdfError) {
        console.error('[Finalize] PDF generation error:', pdfError);
        // Don't fail the finalization if PDF generation fails
      }
    }

    res.json({
      message: 'Verification finalized successfully',
      finalDecision,
      newStatus,
      referenceId,
      pdfGenerated,
      pdfUrl
    });
  } catch (error: any) {
    console.error('Error finalizing verification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Alias: Finalize verification (alternate route for frontend compatibility)
router.post('/finalize/:referenceId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params;
    const { decision, notes } = req.body;
    const staffUser = req.staffUser;

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Map frontend decision format to backend format
    const finalDecision = decision;
    const justification = notes;

    // Valid final decisions
    const validDecisions = ['PASS', 'PASS_WITH_CONDITION', 'PASS_WITH_GUARANTOR', 'REFER', 'FAIL'];
    if (!validDecisions.includes(finalDecision)) {
      return res.status(400).json({ error: `Invalid final decision. Must be one of: ${validDecisions.join(', ')}` });
    }

    // Check verification progress
    const progress = await getVerificationProgress(referenceId);

    if (!progress.canFinalize) {
      // Allow REFER decision even when sections have ACTION_REQUIRED
      if (progress.hasActionRequired && finalDecision !== 'REFER') {
        return res.status(400).json({ error: 'Cannot finalize - one or more sections require action' });
      }
      if (progress.totalSections === 0 || progress.completedSections < progress.totalSections) {
        return res.status(400).json({ error: 'Cannot finalize - not all sections have been reviewed' });
      }
    }

    // Get reference details
    const { data: reference, error: refError } = await supabaseAdmin
      .from('tenant_references')
      .select('status, is_guarantor')
      .eq('id', referenceId)
      .single();

    if (refError || !reference) {
      return res.status(404).json({ error: 'Reference not found' });
    }

    // Update reference status based on decision
    let newStatus = 'completed';
    let newVerificationState: VerificationState = 'COMPLETED';
    if (finalDecision === 'FAIL') {
      newStatus = 'rejected';
      newVerificationState = 'REJECTED';
    }

    // Build update object
    const updateData: Record<string, any> = {
      status: newStatus,
      verification_state: newVerificationState,
      updated_at: new Date().toISOString()
    };

    // If PASS_WITH_GUARANTOR, set requires_guarantor flag
    if (finalDecision === 'PASS_WITH_GUARANTOR' && !reference.is_guarantor) {
      updateData.requires_guarantor = true;
    }

    // Update reference
    const { error: updateError } = await supabaseAdmin
      .from('tenant_references')
      .update(updateData)
      .eq('id', referenceId);

    if (updateError) {
      console.error(`[Finalize] Failed to update reference status:`, updateError);
      return res.status(500).json({ error: 'Failed to update reference status' });
    }

    // Complete any open work items for this reference
    const { error: workItemError } = await supabaseAdmin
      .from('work_items')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString()
      })
      .eq('reference_id', referenceId)
      .in('status', ['AVAILABLE', 'ASSIGNED', 'IN_PROGRESS', 'RETURNED']);

    if (workItemError) {
      console.error(`[Finalize] Failed to complete work items:`, workItemError);
      // Don't fail the request - reference status is already updated
    }

    // Log audit
    await logAuditAction({
      referenceId,
      action: 'VERIFICATION_FINALIZED',
      description: `Verification finalized with decision: ${finalDecision}`,
      metadata: {
        finalDecision,
        justification,
        newStatus,
        sectionsSummary: progress.sections,
        visible_to_agent: true
      },
      userId: staffUser.id
    });

    // Generate PDF report for passing decisions
    let pdfGenerated = false;
    let pdfUrl: string | null = null;

    if (newStatus === 'completed' && ['PASS', 'PASS_WITH_CONDITION', 'PASS_WITH_GUARANTOR'].includes(finalDecision)) {
      try {
        console.log(`[Finalize] Generating PDF report for reference ${referenceId}...`);
        pdfUrl = await generatePassedPdfService(referenceId);
        pdfGenerated = true;
        console.log(`[Finalize] PDF generated and uploaded: ${pdfUrl}`);

        // Save PDF URL to database
        const { error: pdfUpdateError } = await supabaseAdmin
          .from('tenant_references')
          .update({ passed_certificate_url: pdfUrl })
          .eq('id', referenceId);

        if (pdfUpdateError) {
          console.error('[Finalize] Failed to save PDF URL to database:', pdfUpdateError);
        }
      } catch (pdfError) {
        console.error('[Finalize] PDF generation error:', pdfError);
        // Don't fail the finalization if PDF generation fails
      }
    }

    res.json({
      message: 'Verification finalized successfully',
      finalDecision,
      newStatus,
      referenceId,
      pdfGenerated,
      pdfUrl
    });
  } catch (error: any) {
    console.error('Error finalizing verification:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
