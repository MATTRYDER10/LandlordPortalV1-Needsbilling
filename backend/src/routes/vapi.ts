/**
 * VAPI Voice Call Routes
 * Staff-only routes for testing and managing VAPI voice calls
 */

import { Router, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { supabase } from '../config/supabase';
import {
  initiateCall,
  isVapiConfigured,
  isWithinCallHours,
  getCallLogs,
  getCallById,
  validateE164PhoneNumber
} from '../services/vapiService';

/**
 * Normalize a phone number to E.164 format
 * Handles UK numbers starting with 0 or 44
 */
function normalizePhoneNumber(phone: string | null): string | null {
  if (!phone) return null;

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Fix double country code (e.g., +44447356030292 -> +447356030292)
  // This happens when 447356030292 was stored and +44 was added, making +44447356030292
  if (cleaned.startsWith('+4444') && cleaned.length >= 14) {
    cleaned = '+44' + cleaned.substring(5);
  }

  // Fix +440 pattern (e.g., +4407356030292 -> +447356030292)
  // This happens when someone stored 07xxx with +44 prefix
  if (cleaned.startsWith('+440') && cleaned.length === 14) {
    cleaned = '+44' + cleaned.substring(4);
  }

  // If already in E.164 format, return as is
  if (cleaned.startsWith('+') && cleaned.length >= 10) {
    return cleaned;
  }

  // UK number starting with 0 (e.g., 07356030292)
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '+44' + cleaned.substring(1);
  }

  // UK number starting with 44 but missing + (e.g., 447356030292)
  if (cleaned.startsWith('44') && cleaned.length === 12) {
    return '+' + cleaned;
  }

  // Return original if we can't normalize
  return phone;
}
import { decrypt } from '../services/encryption';

const router = Router();

// ============================================================================
// CONFIGURATION STATUS
// ============================================================================

/**
 * GET /api/vapi/status
 * Check VAPI configuration status
 */
router.get('/status', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const config = isVapiConfigured();
    const withinCallHours = isWithinCallHours();

    // Get current time info for display
    const now = new Date();
    const gmtHour = now.getUTCHours();
    const dayOfWeek = now.getUTCDay();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    res.json({
      configured: config.configured,
      missing: config.missing,
      withinCallHours,
      currentTime: {
        utc: now.toISOString(),
        gmtHour,
        dayOfWeek: dayNames[dayOfWeek],
        isWeekend: dayOfWeek === 0 || dayOfWeek === 6
      },
      callHours: {
        start: 9,
        end: 19,
        timezone: 'GMT',
        weekdaysOnly: true
      }
    });
  } catch (error: any) {
    console.error('Error checking VAPI status:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// TEST CALLS
// ============================================================================

/**
 * POST /api/vapi/test-call
 * Make a test call with arbitrary data
 */
router.post('/test-call', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const {
      phoneNumber: rawPhoneNumber,
      contactName,
      tenantName,
      dependencyType,
      propertyAddress,
      companyName
    } = req.body;

    // Validation
    if (!rawPhoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Normalize the phone number
    const phoneNumber = normalizePhoneNumber(rawPhoneNumber);

    console.log('[VAPI Test Call] Phone number:', {
      raw: rawPhoneNumber,
      normalized: phoneNumber,
      rawLength: rawPhoneNumber?.length,
      normalizedLength: phoneNumber?.length,
      isValid: phoneNumber ? validateE164PhoneNumber(phoneNumber) : false
    });

    if (!phoneNumber || !validateE164PhoneNumber(phoneNumber)) {
      return res.status(400).json({
        error: 'Phone number must be in E.164 format (e.g., +447123456789)',
        received: rawPhoneNumber,
        normalized: phoneNumber
      });
    }
    if (!contactName) {
      return res.status(400).json({ error: 'Contact name is required' });
    }

    // Check configuration
    const config = isVapiConfigured();
    if (!config.configured) {
      return res.status(400).json({
        error: 'VAPI not configured',
        missing: config.missing
      });
    }

    // Initiate test call
    const result = await initiateCall({
      to: phoneNumber,
      contactName,
      tenantName: tenantName || 'Test Tenant',
      dependencyType: dependencyType || 'TENANT_FORM',
      propertyAddress: propertyAddress || undefined,
      companyName: companyName || undefined
    });

    if (result.success) {
      res.json({
        success: true,
        callId: result.callId,
        message: result.callId === 'dev_skipped'
          ? 'Call skipped in development mode'
          : 'Call initiated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error initiating test call:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/vapi/call-dependency/:dependencyId
 * Initiate a call for a real dependency
 */
router.post('/call-dependency/:dependencyId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { dependencyId } = req.params;

    // Check configuration
    const config = isVapiConfigured();
    if (!config.configured) {
      return res.status(400).json({
        error: 'VAPI not configured',
        missing: config.missing
      });
    }

    // Get dependency details
    const { data: dependency, error: depError } = await supabase
      .from('chase_dependencies')
      .select(`
        *,
        tenant_references (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          company_id
        )
      `)
      .eq('id', dependencyId)
      .single();

    if (depError || !dependency) {
      return res.status(404).json({ error: 'Dependency not found' });
    }

    // Get phone number
    const phoneEncrypted = dependency.contact_phone_encrypted;
    if (!phoneEncrypted) {
      return res.status(400).json({ error: 'Dependency has no phone number' });
    }

    const phoneNumber = decrypt(phoneEncrypted);
    if (!phoneNumber || !validateE164PhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number for this dependency' });
    }

    // Get contact and tenant names
    const contactName = dependency.contact_name_encrypted
      ? decrypt(dependency.contact_name_encrypted)
      : 'Unknown';
    const tenantFirstName = dependency.tenant_references?.tenant_first_name_encrypted
      ? decrypt(dependency.tenant_references.tenant_first_name_encrypted)
      : '';
    const tenantLastName = dependency.tenant_references?.tenant_last_name_encrypted
      ? decrypt(dependency.tenant_references.tenant_last_name_encrypted)
      : '';
    const tenantName = `${tenantFirstName} ${tenantLastName}`.trim() || 'Unknown';

    // Initiate call
    const result = await initiateCall({
      to: phoneNumber,
      contactName: contactName || 'Unknown',
      tenantName: tenantName || 'Unknown',
      dependencyType: dependency.dependency_type,
      referenceId: dependency.reference_id,
      dependencyId: dependency.id
    });

    if (result.success) {
      res.json({
        success: true,
        callId: result.callId,
        message: result.callId === 'dev_skipped'
          ? 'Call skipped in development mode'
          : 'Call initiated successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error: any) {
    console.error('Error calling dependency:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// CALL LOGS
// ============================================================================

/**
 * GET /api/vapi/calls
 * Get call logs with optional filtering
 */
router.get('/calls', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const {
      referenceId,
      dependencyId,
      status,
      limit = '50',
      offset = '0'
    } = req.query;

    const result = await getCallLogs({
      referenceId: referenceId as string,
      dependencyId: dependencyId as string,
      status: status as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });

    res.json({
      calls: result.calls,
      total: result.total,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error: any) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vapi/calls/:callId/fetch
 * Fetch call details directly from VAPI API and update local record
 * NOTE: This route must be defined BEFORE /calls/:callId to avoid route conflicts
 */
router.get('/calls/:callId/fetch', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { callId } = req.params;
    const VAPI_API_KEY = process.env.VAPI_API_KEY;

    if (!VAPI_API_KEY) {
      return res.status(400).json({ error: 'VAPI API key not configured' });
    }

    // Fetch call details from VAPI
    const response = await fetch(`https://api.vapi.ai/call/${callId}`, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: 'Failed to fetch from VAPI',
        details: errorData
      });
    }

    const vapiCall = await response.json() as any;

    // Update local database with the fetched data
    const updateData: Record<string, any> = {
      status: vapiCall.status || 'unknown',
      status_updated_at: new Date().toISOString()
    };

    if (vapiCall.endedReason) updateData.ended_reason = vapiCall.endedReason;
    if (vapiCall.startedAt) updateData.started_at = vapiCall.startedAt;
    if (vapiCall.endedAt) updateData.ended_at = vapiCall.endedAt;
    if (vapiCall.transcript) updateData.transcript = vapiCall.transcript;
    if (vapiCall.summary) updateData.summary = vapiCall.summary;
    if (vapiCall.analysis?.summary) updateData.summary = vapiCall.analysis.summary;

    // Calculate duration if we have start and end times
    if (vapiCall.startedAt && vapiCall.endedAt) {
      const duration = Math.round(
        (new Date(vapiCall.endedAt).getTime() - new Date(vapiCall.startedAt).getTime()) / 1000
      );
      updateData.call_duration_seconds = duration;
    }

    // Try to update local record (may not exist if call was made before logging was set up)
    await supabase
      .from('call_delivery_logs')
      .update(updateData)
      .eq('vapi_call_id', callId);

    res.json({
      call: {
        vapi_call_id: callId,
        status: vapiCall.status,
        ended_reason: vapiCall.endedReason,
        started_at: vapiCall.startedAt,
        ended_at: vapiCall.endedAt,
        call_duration_seconds: updateData.call_duration_seconds,
        transcript: vapiCall.transcript,
        summary: vapiCall.summary || vapiCall.analysis?.summary,
        raw: vapiCall
      }
    });
  } catch (error: any) {
    console.error('Error fetching call from VAPI:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vapi/calls/:callId
 * Get a single call by VAPI call ID from local database
 */
router.get('/calls/:callId', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { callId } = req.params;

    const call = await getCallById(callId);

    if (!call) {
      return res.status(404).json({ error: 'Call not found' });
    }

    res.json({ call });
  } catch (error: any) {
    console.error('Error fetching call:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// DEPENDENCY LOOKUP
// ============================================================================

/**
 * GET /api/vapi/references
 * Get all references for VAPI testing - pulls from tenant_references directly
 */
router.get('/references', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { search, limit = '50' } = req.query;

    const { data: references, error } = await supabase
      .from('tenant_references')
      .select(`
        id,
        status,
        created_at,
        tenant_first_name_encrypted,
        tenant_last_name_encrypted,
        tenant_email_encrypted,
        tenant_phone_encrypted,
        property_address_encrypted,
        property_city_encrypted,
        property_postcode_encrypted,
        employer_ref_name_encrypted,
        employer_ref_email_encrypted,
        employer_ref_phone_encrypted,
        previous_landlord_name_encrypted,
        previous_landlord_email_encrypted,
        previous_landlord_phone_encrypted,
        company:companies!tenant_references_company_id_fkey (
          name_encrypted
        )
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) {
      console.error('Error fetching references:', error);
      return res.status(500).json({ error: error.message });
    }

    // Decrypt and format references
    const decryptedReferences = (references || []).map((ref: any) => {
      const tenantFirstName = ref.tenant_first_name_encrypted
        ? decrypt(ref.tenant_first_name_encrypted)
        : '';
      const tenantLastName = ref.tenant_last_name_encrypted
        ? decrypt(ref.tenant_last_name_encrypted)
        : '';
      const tenantName = `${tenantFirstName} ${tenantLastName}`.trim() || 'Unknown';
      const tenantEmail = ref.tenant_email_encrypted ? decrypt(ref.tenant_email_encrypted) : null;
      const tenantPhoneRaw = ref.tenant_phone_encrypted ? decrypt(ref.tenant_phone_encrypted) : null;
      const tenantPhone = normalizePhoneNumber(tenantPhoneRaw);

      // Property info
      const propertyAddress = ref.property_address_encrypted ? decrypt(ref.property_address_encrypted) : null;
      const propertyCity = ref.property_city_encrypted ? decrypt(ref.property_city_encrypted) : null;
      const propertyPostcode = ref.property_postcode_encrypted ? decrypt(ref.property_postcode_encrypted) : null;
      const fullPropertyAddress = [propertyAddress, propertyCity, propertyPostcode].filter(Boolean).join(', ');

      // Company info (letting agent)
      const companyName = ref.company?.name_encrypted ? decrypt(ref.company.name_encrypted) : null;

      // Employer info
      const employerName = ref.employer_ref_name_encrypted ? decrypt(ref.employer_ref_name_encrypted) : null;
      const employerEmail = ref.employer_ref_email_encrypted ? decrypt(ref.employer_ref_email_encrypted) : null;
      const employerPhoneRaw = ref.employer_ref_phone_encrypted ? decrypt(ref.employer_ref_phone_encrypted) : null;
      const employerPhone = normalizePhoneNumber(employerPhoneRaw);

      // Landlord info
      const landlordName = ref.previous_landlord_name_encrypted ? decrypt(ref.previous_landlord_name_encrypted) : null;
      const landlordEmail = ref.previous_landlord_email_encrypted ? decrypt(ref.previous_landlord_email_encrypted) : null;
      const landlordPhoneRaw = ref.previous_landlord_phone_encrypted ? decrypt(ref.previous_landlord_phone_encrypted) : null;
      const landlordPhone = normalizePhoneNumber(landlordPhoneRaw);

      // Filter by search if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        const matches = (
          tenantName.toLowerCase().includes(searchLower) ||
          (tenantEmail?.toLowerCase() || '').includes(searchLower) ||
          (employerName?.toLowerCase() || '').includes(searchLower) ||
          (landlordName?.toLowerCase() || '').includes(searchLower) ||
          (fullPropertyAddress?.toLowerCase() || '').includes(searchLower) ||
          (companyName?.toLowerCase() || '').includes(searchLower) ||
          ref.id.toLowerCase().includes(searchLower)
        );
        if (!matches) return null;
      }

      // Build contacts array for this reference
      const contacts = [];

      if (tenantPhone) {
        contacts.push({
          type: 'TENANT_FORM',
          name: tenantName,
          phone: tenantPhone,
          email: tenantEmail,
          hasValidPhone: validateE164PhoneNumber(tenantPhone)
        });
      }

      if (employerPhone) {
        contacts.push({
          type: 'EMPLOYER_REF',
          name: employerName || 'Employer',
          phone: employerPhone,
          email: employerEmail,
          hasValidPhone: validateE164PhoneNumber(employerPhone)
        });
      }

      if (landlordPhone) {
        contacts.push({
          type: 'RESIDENTIAL_REF',
          name: landlordName || 'Landlord',
          phone: landlordPhone,
          email: landlordEmail,
          hasValidPhone: validateE164PhoneNumber(landlordPhone)
        });
      }

      return {
        id: ref.id,
        status: ref.status,
        createdAt: ref.created_at,
        tenantName,
        tenantEmail,
        tenantPhone,
        propertyAddress: fullPropertyAddress,
        companyName,
        contacts
      };
    }).filter(Boolean);

    res.json({
      references: decryptedReferences,
      total: decryptedReferences.length
    });
  } catch (error: any) {
    console.error('Error fetching references:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/vapi/dependencies
 * Get dependencies that can be called (have phone numbers)
 */
router.get('/dependencies', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    const { search, limit = '20', showAll = 'true' } = req.query;

    let query = supabase
      .from('chase_dependencies')
      .select(`
        id,
        dependency_type,
        status,
        contact_name_encrypted,
        contact_phone_encrypted,
        contact_email_encrypted,
        email_attempts,
        sms_attempts,
        call_attempts,
        chase_cycle,
        reference_id,
        reference:tenant_references!chase_dependencies_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          tenant_email_encrypted,
          status,
          created_at
        )
      `)
      .not('contact_phone_encrypted', 'is', null)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    // Only filter by status if showAll is false
    if (showAll !== 'true') {
      query = query.in('status', ['PENDING', 'CHASING']);
    }

    const { data: dependencies, error } = await query;

    if (error) {
      console.error('Error fetching dependencies:', error);
      return res.status(500).json({ error: error.message });
    }

    // Decrypt sensitive fields for display
    const decryptedDependencies = (dependencies || []).map((dep: any) => {
      const contactName = dep.contact_name_encrypted
        ? decrypt(dep.contact_name_encrypted)
        : 'Unknown';
      const contactPhone = dep.contact_phone_encrypted
        ? decrypt(dep.contact_phone_encrypted)
        : null;
      const tenantFirstName = dep.reference?.tenant_first_name_encrypted
        ? decrypt(dep.reference.tenant_first_name_encrypted)
        : '';
      const tenantLastName = dep.reference?.tenant_last_name_encrypted
        ? decrypt(dep.reference.tenant_last_name_encrypted)
        : '';
      const tenantName = `${tenantFirstName} ${tenantLastName}`.trim() || 'Unknown';

      // Filter by search if provided
      if (search) {
        const searchLower = (search as string).toLowerCase();
        const matches = (
          (contactName?.toLowerCase() || '').includes(searchLower) ||
          (tenantName?.toLowerCase() || '').includes(searchLower) ||
          (contactPhone || '').includes(searchLower)
        );
        if (!matches) return null;
      }

      const contactEmail = dep.contact_email_encrypted
        ? decrypt(dep.contact_email_encrypted)
        : null;
      const tenantEmail = dep.reference?.tenant_email_encrypted
        ? decrypt(dep.reference.tenant_email_encrypted)
        : null;

      return {
        id: dep.id,
        dependencyType: dep.dependency_type,
        status: dep.status,
        contactName,
        contactPhone,
        contactEmail,
        hasValidPhone: contactPhone ? validateE164PhoneNumber(contactPhone) : false,
        emailAttempts: dep.email_attempts,
        smsAttempts: dep.sms_attempts,
        callAttempts: dep.call_attempts,
        chaseCycle: dep.chase_cycle,
        referenceId: dep.reference_id,
        tenantName,
        tenantEmail,
        referenceStatus: dep.reference?.status,
        referenceCreatedAt: dep.reference?.created_at
      };
    }).filter(Boolean);

    res.json({
      dependencies: decryptedDependencies,
      total: decryptedDependencies.length
    });
  } catch (error: any) {
    console.error('Error fetching dependencies:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
