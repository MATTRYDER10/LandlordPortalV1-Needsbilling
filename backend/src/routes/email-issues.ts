import { Router, Response } from 'express';
import { authenticateStaff as staffAuth, StaffAuthRequest } from '../middleware/staffAuth';
import { supabase } from '../config/supabase';
import { decrypt } from '../services/encryption';

const router = Router();

export type ContactType = 'tenant' | 'guarantor' | 'employer' | 'landlord' | 'accountant' | 'agent'

export interface EmailIssueItem {
  id: string
  referenceId: string
  personName: string
  personRole: 'TENANT' | 'GUARANTOR'
  contactType: ContactType
  email: string
  issueType: 'bounced' | 'complained'
  errorMessage?: string
  propertyAddress: string
  companyName: string
  createdAt: string
}

// Get all email delivery issues
router.get('/queue', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Get all email delivery issues (bounced or complained) that haven't been resolved
    const { data: issues, error } = await supabase
      .from('email_delivery_logs')
      .select(`
        id,
        reference_id,
        reference_type,
        email,
        status,
        error_message,
        created_at,
        reference:tenant_references!email_delivery_logs_reference_id_fkey (
          id,
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted,
          is_guarantor,
          status,
          company:companies!tenant_references_company_id_fkey (
            id,
            name_encrypted
          )
        )
      `)
      .in('status', ['bounced', 'complained'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Filter out issues where reference is completed/rejected
    const excludedStatuses = ['completed', 'rejected', 'cancelled'];
    const filteredIssues = (issues || []).filter((issue: any) => {
      if (!issue.reference) return false;
      return !excludedStatuses.includes(issue.reference.status);
    });

    // Transform to EmailIssueItem format
    const items: EmailIssueItem[] = filteredIssues.map((issue: any) => {
      const ref = issue.reference;
      const firstName = decrypt(ref.tenant_first_name_encrypted) || '';
      const lastName = decrypt(ref.tenant_last_name_encrypted) || '';
      const personName = `${firstName} ${lastName}`.trim();
      const propertyAddress = decrypt(ref.property_address_encrypted) || '';
      const companyName = ref.company?.name_encrypted ? decrypt(ref.company.name_encrypted) || '' : '';

      return {
        id: issue.id,
        referenceId: issue.reference_id,
        personName,
        personRole: ref.is_guarantor ? 'GUARANTOR' : 'TENANT',
        contactType: issue.reference_type || 'tenant',
        email: issue.email || '',
        issueType: issue.status as 'bounced' | 'complained',
        errorMessage: issue.error_message,
        propertyAddress,
        companyName,
        createdAt: issue.created_at
      };
    });

    res.json({
      items,
      total: items.length
    });
  } catch (error: any) {
    console.error('Error fetching email issues queue:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get count of email issues (for stats)
router.get('/count', staffAuth, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser;
    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' });
    }

    // Get count of bounced/complained emails for active references
    const { data: issues, error } = await supabase
      .from('email_delivery_logs')
      .select(`
        id,
        reference:tenant_references!email_delivery_logs_reference_id_fkey (status)
      `)
      .in('status', ['bounced', 'complained']);

    if (error) throw error;

    // Filter out issues where reference is completed/rejected
    const excludedStatuses = ['completed', 'rejected', 'cancelled'];
    const activeIssues = (issues || []).filter((issue: any) => {
      if (!issue.reference) return false;
      return !excludedStatuses.includes(issue.reference.status);
    });

    res.json({ count: activeIssues.length });
  } catch (error: any) {
    console.error('Error fetching email issues count:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
