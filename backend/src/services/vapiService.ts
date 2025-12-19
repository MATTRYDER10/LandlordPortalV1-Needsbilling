/**
 * VAPI Voice Call Service
 * Handles outbound voice calls via VAPI AI for chase reminders
 */

import { supabase } from '../config/supabase';
import { encrypt } from './encryption';

// VAPI Configuration from environment
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_PHONE_NUMBER_ID = process.env.VAPI_PHONE_NUMBER_ID;
const VAPI_API_URL = 'https://api.vapi.ai/call';

// Assistant IDs per dependency type
const VAPI_ASSISTANTS: Record<string, string | undefined> = {
  'TENANT_FORM': process.env.VAPI_ASSISTANT_TENANT,
  'GUARANTOR_FORM': process.env.VAPI_ASSISTANT_GUARANTOR,
  'EMPLOYER_REF': process.env.VAPI_ASSISTANT_EMPLOYER,
  'RESIDENTIAL_REF': process.env.VAPI_ASSISTANT_LANDLORD,
  'ACCOUNTANT_REF': process.env.VAPI_ASSISTANT_ACCOUNTANT
};

/**
 * Get the assistant ID for a specific dependency type
 */
function getAssistantId(dependencyType: string): string | undefined {
  return VAPI_ASSISTANTS[dependencyType];
}

export interface CallOptions {
  to: string; // E.164 phone number
  contactName: string;
  tenantName: string;
  dependencyType: string;
  referenceId?: string;
  dependencyId?: string;
  propertyAddress?: string;
  companyName?: string;
}

export interface CallResult {
  success: boolean;
  callId?: string;
  error?: string;
}

export interface CallStatusUpdate {
  endedReason?: string;
  duration?: number;
  transcript?: string;
  summary?: string;
  startedAt?: string;
  endedAt?: string;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Validate phone number is in E.164 format
 * E.164 format: + followed by 1-15 digits
 */
export function validateE164PhoneNumber(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone);
}

/**
 * Check if VAPI is properly configured
 * @param dependencyType - Optional dependency type to check specific assistant
 */
export function isVapiConfigured(dependencyType?: string): { configured: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!VAPI_API_KEY) missing.push('VAPI_API_KEY');
  if (!VAPI_PHONE_NUMBER_ID) missing.push('VAPI_PHONE_NUMBER_ID');

  // Check for at least one assistant configured, or specific one if type provided
  if (dependencyType) {
    const assistantId = getAssistantId(dependencyType);
    if (!assistantId) missing.push(`VAPI_ASSISTANT for ${dependencyType}`);
  } else {
    // Check if any assistant is configured
    const hasAnyAssistant = Object.values(VAPI_ASSISTANTS).some(id => !!id);
    if (!hasAnyAssistant) missing.push('VAPI_ASSISTANT (at least one)');
  }

  return {
    configured: missing.length === 0,
    missing
  };
}

/**
 * Check if current time is within call hours
 * Stricter than email/SMS: 9 AM - 7 PM GMT, weekdays only
 */
export function isWithinCallHours(): boolean {
  const now = new Date();
  const gmtHour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday

  // Skip weekends
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Only call 9 AM - 7 PM GMT (09:00 - 19:00)
  return gmtHour >= 9 && gmtHour < 19;
}

/**
 * Get human-readable dependency type for call script
 */
function getDependencyTypeLabel(dependencyType: string): string {
  const labels: Record<string, string> = {
    'TENANT_FORM': 'tenant reference application',
    'EMPLOYER_REF': 'employment reference',
    'RESIDENTIAL_REF': 'landlord reference',
    'ACCOUNTANT_REF': 'accountant reference',
    'GUARANTOR_FORM': 'guarantor reference'
  };
  return labels[dependencyType] || 'reference form';
}

/**
 * Log call delivery to database
 */
async function logCallDelivery(data: {
  vapiCallId: string;
  referenceId?: string;
  dependencyId?: string;
  referenceType?: string;
  phoneNumberEncrypted: string;
  assistantId?: string;
  phoneNumberId?: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await supabase.from('call_delivery_logs').insert({
      vapi_call_id: data.vapiCallId,
      reference_id: data.referenceId || null,
      dependency_id: data.dependencyId || null,
      reference_type: data.referenceType || null,
      phone_number_encrypted: data.phoneNumberEncrypted,
      assistant_id: data.assistantId || null,
      phone_number_id: data.phoneNumberId || VAPI_PHONE_NUMBER_ID,
      status: data.status,
      error_code: data.errorCode || null,
      error_message: data.errorMessage || null,
    });
  } catch (error) {
    console.error('Failed to log call delivery:', error);
  }
}

/**
 * Log call event to reference_audit_log for Activity Log UI
 */
async function logCallToAuditLog(
  referenceId: string,
  referenceType?: string,
  status: 'sent' | 'failed' = 'sent',
  errorMessage?: string
): Promise<void> {
  try {
    const typeLabel = referenceType
      ? referenceType.charAt(0).toUpperCase() + referenceType.slice(1)
      : 'Reference';

    const action = status === 'sent' ? 'CALL_INITIATED' : 'CALL_FAILED';
    const description =
      status === 'sent'
        ? `Voice call initiated to ${typeLabel.toLowerCase()}`
        : `Voice call failed: ${errorMessage || 'Unknown error'}`;

    await supabase.from('reference_audit_log').insert({
      reference_id: referenceId,
      action,
      description,
      metadata: { reference_type: referenceType, status, error_message: errorMessage },
      created_by: null, // System action
    });
  } catch (error) {
    console.error('Failed to log call to audit log:', error);
  }
}

/**
 * Initiate an outbound call via VAPI
 */
export async function initiateCall(options: CallOptions): Promise<CallResult> {
  // Get the assistant ID for this dependency type
  const assistantId = getAssistantId(options.dependencyType);

  // Check if VAPI is configured for this dependency type
  const config = isVapiConfigured(options.dependencyType);
  if (!config.configured) {
    console.warn(`VAPI not configured - missing: ${config.missing.join(', ')}`);
    return { success: false, error: `VAPI not configured: missing ${config.missing.join(', ')}` };
  }

  // Validate phone number
  if (!validateE164PhoneNumber(options.to)) {
    console.error(`Invalid phone number format: ${options.to}`);
    return { success: false, error: 'Invalid phone number format' };
  }

  // Skip calls in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_CALLS_DEV) {
    console.log(`[VAPI] Call skipped in development - would call ${options.to}`);
    console.log(`[VAPI] Contact: ${options.contactName}, Tenant: ${options.tenantName}, Type: ${options.dependencyType}`);
    return { success: true, callId: 'dev_skipped' };
  }

  try {
    // Prepare VAPI API request with dependency-specific assistant
    const payload = {
      assistantId: assistantId,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: {
        number: options.to,
        name: options.contactName
      },
      // Pass context variables to the assistant using LiquidJS syntax
      assistantOverrides: {
        variableValues: {
          contactName: options.contactName,
          tenantName: options.tenantName,
          dependencyType: getDependencyTypeLabel(options.dependencyType),
          propertyAddress: options.propertyAddress || 'Not provided',
          companyName: options.companyName || 'PropertyGoose'
        }
      }
    };

    console.log(`[VAPI] Initiating call to ${options.to} for ${options.dependencyType} using assistant ${assistantId}`);

    const response = await fetch(VAPI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { message?: string; error?: string };
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}`;
      console.error(`[VAPI] API error: ${errorMessage}`);

      // Log failed attempt
      await logCallDelivery({
        vapiCallId: `failed_${Date.now()}`,
        referenceId: options.referenceId,
        dependencyId: options.dependencyId,
        referenceType: getDependencyReferenceType(options.dependencyType),
        phoneNumberEncrypted: encrypt(options.to) || '',
        status: 'failed',
        errorCode: response.status.toString(),
        errorMessage
      });

      if (options.referenceId) {
        await logCallToAuditLog(
          options.referenceId,
          getDependencyReferenceType(options.dependencyType),
          'failed',
          errorMessage
        );
      }

      return { success: false, error: errorMessage };
    }

    const data = await response.json() as { id: string };
    const callId = data.id;

    console.log(`[VAPI] Call initiated successfully, callId: ${callId}`);

    // Log successful initiation
    await logCallDelivery({
      vapiCallId: callId,
      referenceId: options.referenceId,
      dependencyId: options.dependencyId,
      referenceType: getDependencyReferenceType(options.dependencyType),
      phoneNumberEncrypted: encrypt(options.to) || '',
      status: 'initiated'
    });

    if (options.referenceId) {
      await logCallToAuditLog(
        options.referenceId,
        getDependencyReferenceType(options.dependencyType),
        'sent'
      );
    }

    return { success: true, callId };
  } catch (error: any) {
    console.error('[VAPI] Call initiation error:', error);

    // Log failed attempt
    await logCallDelivery({
      vapiCallId: `failed_${Date.now()}`,
      referenceId: options.referenceId,
      dependencyId: options.dependencyId,
      referenceType: getDependencyReferenceType(options.dependencyType),
      phoneNumberEncrypted: encrypt(options.to) || '',
      status: 'failed',
      errorMessage: error.message
    });

    if (options.referenceId) {
      await logCallToAuditLog(
        options.referenceId,
        getDependencyReferenceType(options.dependencyType),
        'failed',
        error.message
      );
    }

    return { success: false, error: error.message };
  }
}

/**
 * Map dependency type to reference type for logging
 */
function getDependencyReferenceType(dependencyType: string): string {
  const mapping: Record<string, string> = {
    'TENANT_FORM': 'tenant',
    'EMPLOYER_REF': 'employer',
    'RESIDENTIAL_REF': 'landlord',
    'ACCOUNTANT_REF': 'accountant',
    'GUARANTOR_FORM': 'guarantor'
  };
  return mapping[dependencyType] || 'unknown';
}

/**
 * Update call status from VAPI webhook
 */
export async function updateCallStatus(
  vapiCallId: string,
  status: string,
  metadata?: CallStatusUpdate
): Promise<void> {
  try {
    const updateData: Record<string, any> = {
      status,
      status_updated_at: new Date().toISOString()
    };

    if (metadata?.endedReason) {
      updateData.ended_reason = metadata.endedReason;
    }
    if (metadata?.duration !== undefined) {
      updateData.call_duration_seconds = metadata.duration;
    }
    if (metadata?.transcript) {
      updateData.transcript = metadata.transcript;
    }
    if (metadata?.summary) {
      updateData.summary = metadata.summary;
    }
    if (metadata?.startedAt) {
      updateData.started_at = metadata.startedAt;
    }
    if (metadata?.endedAt) {
      updateData.ended_at = metadata.endedAt;
    }
    if (metadata?.errorCode) {
      updateData.error_code = metadata.errorCode;
    }
    if (metadata?.errorMessage) {
      updateData.error_message = metadata.errorMessage;
    }

    await supabase
      .from('call_delivery_logs')
      .update(updateData)
      .eq('vapi_call_id', vapiCallId);

    console.log(`[VAPI] Call status updated: ${vapiCallId} -> ${status}`);
  } catch (error) {
    console.error('[VAPI] Failed to update call status:', error);
  }
}

/**
 * Get call logs with optional filtering
 */
export async function getCallLogs(options?: {
  referenceId?: string;
  dependencyId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ calls: any[]; total: number }> {
  try {
    let query = supabase
      .from('call_delivery_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (options?.referenceId) {
      query = query.eq('reference_id', options.referenceId);
    }
    if (options?.dependencyId) {
      query = query.eq('dependency_id', options.dependencyId);
    }
    if (options?.status) {
      query = query.eq('status', options.status);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('[VAPI] Failed to get call logs:', error);
      return { calls: [], total: 0 };
    }

    return { calls: data || [], total: count || 0 };
  } catch (error) {
    console.error('[VAPI] Failed to get call logs:', error);
    return { calls: [], total: 0 };
  }
}

/**
 * Get a single call log by VAPI call ID
 */
export async function getCallById(vapiCallId: string): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('call_delivery_logs')
      .select('*')
      .eq('vapi_call_id', vapiCallId)
      .single();

    if (error) {
      console.error('[VAPI] Failed to get call:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[VAPI] Failed to get call:', error);
    return null;
  }
}
