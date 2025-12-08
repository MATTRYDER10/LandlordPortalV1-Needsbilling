import Twilio from 'twilio';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../config/supabase';
import { encrypt } from './encryption';

// Initialize Twilio client
// Supports both Account SID + Auth Token OR API Key authentication
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize client - prefer API Key if provided, otherwise use Auth Token
let twilioClient: Twilio.Twilio | null = null;
if (accountSid && apiKeySid && apiKeySecret) {
  // API Key authentication
  twilioClient = Twilio(apiKeySid, apiKeySecret, { accountSid });
} else if (accountSid && authToken) {
  // Standard Account SID + Auth Token authentication
  twilioClient = Twilio(accountSid, authToken);
}

interface SMSOptions {
  to: string;
  body: string;
  referenceId?: string;
  referenceType?: 'tenant' | 'guarantor' | 'landlord' | 'employer' | 'accountant' | 'agent';
}

interface SMSResult {
  success: boolean;
  messageSid?: string;
  error?: string;
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
 * Capitalize the first letter of each word in a string
 */
function capitalizeWords(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Load and process an SMS template
 */
export function loadSMSTemplate(templateName: string, variables: Record<string, string>): string {
  const templatePath = path.join(__dirname, '../../sms-templates', `${templateName}.txt`);

  let template = fs.readFileSync(templatePath, 'utf-8');

  // Replace all variables in the template
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    template = template.replace(regex, variables[key]);
  });

  return template.trim();
}

/**
 * Log SMS delivery to database
 */
async function logSMSDelivery(data: {
  twilioMessageSid: string;
  referenceId?: string;
  referenceType?: string;
  phoneNumberEncrypted: string;
  messageBody: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  fromNumber?: string;
  numSegments?: number;
}): Promise<void> {
  try {
    await supabase.from('sms_delivery_logs').insert({
      twilio_message_sid: data.twilioMessageSid,
      reference_id: data.referenceId || null,
      reference_type: data.referenceType || null,
      phone_number_encrypted: data.phoneNumberEncrypted,
      message_body: data.messageBody,
      status: data.status,
      error_code: data.errorCode || null,
      error_message: data.errorMessage || null,
      from_number: data.fromNumber || twilioPhoneNumber,
      num_segments: data.numSegments || 1,
    });
  } catch (error) {
    console.error('Failed to log SMS delivery:', error);
  }
}

/**
 * Send an SMS using Twilio
 * Non-blocking: logs and continues on failure
 */
export async function sendSMS(options: SMSOptions): Promise<SMSResult> {
  // Check if Twilio is configured
  if (!twilioClient || !twilioPhoneNumber) {
    console.warn('Twilio not configured - SMS not sent');
    return { success: false, error: 'Twilio not configured' };
  }

  // Validate phone number
  if (!validateE164PhoneNumber(options.to)) {
    console.error(`Invalid phone number format: ${options.to}`);
    return { success: false, error: 'Invalid phone number format' };
  }

  // Skip SMS in development unless explicitly enabled
  if (process.env.NODE_ENV === 'development' && !process.env.ENABLE_SMS_DEV) {
    console.log(`SMS skipped in development - would send to ${options.to}: ${options.body}`);
    return { success: true, messageSid: 'dev_skipped' };
  }

  try {
    const message = await twilioClient.messages.create({
      body: options.body,
      to: options.to,
      from: twilioPhoneNumber,
      statusCallback: process.env.BACKEND_URL
        ? `${process.env.BACKEND_URL}/api/webhooks/twilio`
        : undefined,
    });

    console.log(`SMS sent successfully to ${options.to}, SID: ${message.sid}`);

    // Log to database
    await logSMSDelivery({
      twilioMessageSid: message.sid,
      referenceId: options.referenceId,
      referenceType: options.referenceType,
      phoneNumberEncrypted: encrypt(options.to) || '',
      messageBody: options.body,
      status: 'sent',
      fromNumber: twilioPhoneNumber,
      numSegments: typeof message.numSegments === 'number' ? message.numSegments : 1,
    });

    return { success: true, messageSid: message.sid };
  } catch (error: any) {
    console.error('SMS send error:', error);

    // Log failed attempt
    await logSMSDelivery({
      twilioMessageSid: `failed_${Date.now()}`,
      referenceId: options.referenceId,
      referenceType: options.referenceType,
      phoneNumberEncrypted: encrypt(options.to) || '',
      messageBody: options.body,
      status: 'failed',
      errorCode: error.code?.toString(),
      errorMessage: error.message,
    });

    return { success: false, error: error.message };
  }
}

/**
 * Send tenant reference request SMS
 */
export async function sendTenantReferenceRequestSMS(
  tenantPhone: string,
  tenantName: string,
  referenceLink: string,
  companyName: string,
  propertyAddress: string,
  referenceId?: string
): Promise<SMSResult> {
  const body = loadSMSTemplate('tenant-reference-request', {
    TenantName: capitalizeWords(tenantName),
    CompanyName: companyName,
    PropertyAddress: capitalizeWords(propertyAddress),
    ReferenceLink: referenceLink,
  });

  return sendSMS({
    to: tenantPhone,
    body,
    referenceId,
    referenceType: 'tenant',
  });
}

/**
 * Send guarantor reference request SMS
 */
export async function sendGuarantorReferenceRequestSMS(
  guarantorPhone: string,
  guarantorName: string,
  tenantName: string,
  formLink: string,
  referenceId?: string
): Promise<SMSResult> {
  const body = loadSMSTemplate('guarantor-reference-request', {
    GuarantorName: capitalizeWords(guarantorName),
    TenantName: capitalizeWords(tenantName),
    FormLink: formLink,
  });

  return sendSMS({
    to: guarantorPhone,
    body,
    referenceId,
    referenceType: 'guarantor',
  });
}

/**
 * Send landlord reference request SMS
 */
export async function sendLandlordReferenceRequestSMS(
  landlordPhone: string,
  landlordName: string,
  tenantName: string,
  referenceLink: string,
  referenceId?: string
): Promise<SMSResult> {
  const body = loadSMSTemplate('landlord-reference-request', {
    LandlordName: capitalizeWords(landlordName),
    TenantName: capitalizeWords(tenantName),
    ReferenceLink: referenceLink,
  });

  return sendSMS({
    to: landlordPhone,
    body,
    referenceId,
    referenceType: 'landlord',
  });
}

/**
 * Send employer reference request SMS
 */
export async function sendEmployerReferenceRequestSMS(
  employerPhone: string,
  employerName: string,
  tenantName: string,
  referenceLink: string,
  referenceId?: string
): Promise<SMSResult> {
  const body = loadSMSTemplate('employer-reference-request', {
    EmployerName: capitalizeWords(employerName),
    TenantName: capitalizeWords(tenantName),
    ReferenceLink: referenceLink,
  });

  return sendSMS({
    to: employerPhone,
    body,
    referenceId,
    referenceType: 'employer',
  });
}

/**
 * Send accountant reference request SMS
 */
export async function sendAccountantReferenceRequestSMS(
  accountantPhone: string,
  accountantName: string,
  tenantName: string,
  referenceLink: string,
  referenceId?: string
): Promise<SMSResult> {
  const body = loadSMSTemplate('accountant-reference-request', {
    AccountantName: capitalizeWords(accountantName),
    TenantName: capitalizeWords(tenantName),
    ReferenceLink: referenceLink,
  });

  return sendSMS({
    to: accountantPhone,
    body,
    referenceId,
    referenceType: 'accountant',
  });
}

/**
 * Send agent reference request SMS
 */
export async function sendAgentReferenceRequestSMS(
  agentPhone: string,
  agentName: string,
  tenantName: string,
  referenceLink: string,
  referenceId?: string
): Promise<SMSResult> {
  const body = loadSMSTemplate('agent-reference-request', {
    AgentName: capitalizeWords(agentName),
    TenantName: capitalizeWords(tenantName),
    ReferenceLink: referenceLink,
  });

  return sendSMS({
    to: agentPhone,
    body,
    referenceId,
    referenceType: 'agent',
  });
}

/**
 * Update SMS delivery status from Twilio webhook
 */
export async function updateSMSDeliveryStatus(
  messageSid: string,
  status: string,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase
      .from('sms_delivery_logs')
      .update({
        status,
        error_code: errorCode || null,
        error_message: errorMessage || null,
        status_updated_at: new Date().toISOString(),
      })
      .eq('twilio_message_sid', messageSid);

    console.log(`SMS status updated: ${messageSid} -> ${status}`);
  } catch (error) {
    console.error('Failed to update SMS delivery status:', error);
  }
}
