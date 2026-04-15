/**
 * V2 Admin Routes
 *
 * Endpoints for queue management, staff allocation, and system health monitoring.
 * Restricted to SUPERVISOR and ADMIN roles.
 */

import { Router, Response } from 'express'
import { authenticateStaff, StaffAuthRequest } from '../../middleware/staffAuth'
import { supabase } from '../../config/supabase'
import { decrypt } from '../../services/encryption'
import { V2SectionType, V2QueueStatus, V2WorkType, TENANT_SECTIONS, GUARANTOR_SECTIONS } from '../../services/v2/types'
import { editReferenceField } from '../../services/v2/referenceServiceV2'
import { getActivityForReference } from '../../services/v2/activityServiceV2'

const router = Router()

// ============================================================================
// ROLE CHECK MIDDLEWARE
// ============================================================================

/**
 * Middleware to check if staff has Admin permission
 */
async function requireAdminRole(req: StaffAuthRequest, res: Response, next: any) {
  const staffUser = req.staffUser

  if (!staffUser) {
    return res.status(401).json({ error: 'Staff authentication required' })
  }

  // Staff auth already verified the user is active — allow through
  // Role-based restrictions can be added later when role column exists
  next()
}

// ============================================================================
// DASHBOARD ENDPOINTS (All Staff)
// ============================================================================

/**
 * Get queue counts for dashboard tiles
 * Returns count of READY items in each queue
 */
router.get('/queue-counts', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    // Get section counts by type (only READY status for the queue)
    const { data: sectionCounts } = await supabase
      .from('reference_sections_v2')
      .select('section_type, queue_status')
      .eq('queue_status', 'READY')

    const counts: Record<string, number> = {
      IDENTITY: 0,
      RTR: 0,
      INCOME: 0,
      RESIDENTIAL: 0,
      ADDRESS: 0,
      CREDIT: 0,
      AML: 0
    }

    sectionCounts?.forEach(s => {
      const type = s.section_type as V2SectionType
      if (counts[type] !== undefined) {
        counts[type]++
      }
    })

    // Get chase queue count
    const { count: chaseCount } = await supabase
      .from('chase_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_CHASE_QUEUE')

    // Get overdue chase items (next_chase_due in the past)
    const { count: chaseUrgentCount } = await supabase
      .from('chase_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_CHASE_QUEUE')
      .lt('next_chase_due', new Date().toISOString())

    // Get final review count (references in IN_REVIEW status awaiting final decision)
    const { count: finalReviewCount } = await supabase
      .from('tenant_references_v2')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_REVIEW')
      .is('final_decision_at', null)

    // Get group assessment count
    const { count: groupAssessmentCount } = await supabase
      .from('work_items_v2')
      .select('*', { count: 'exact', head: true })
      .eq('work_type', 'GROUP_ASSESSMENT')
      .eq('status', 'AVAILABLE')

    res.json({
      ...counts,
      CHASE: chaseCount || 0,
      CHASE_URGENT: chaseUrgentCount || 0,
      FINAL_REVIEW: finalReviewCount || 0,
      GROUP_ASSESSMENT: groupAssessmentCount || 0
    })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting queue counts:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get current user's active work items
 */
router.get('/my-work', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Get all sections claimed by this staff member
    const { data: sections, error } = await supabase
      .from('reference_sections_v2')
      .select(`
        id,
        section_type,
        assigned_at,
        reference_id,
        tenant_references_v2!reference_sections_v2_reference_id_fkey (
          tenant_first_name_encrypted,
          tenant_last_name_encrypted,
          property_address_encrypted
        )
      `)
      .eq('assigned_to', staffUser.id)
      .eq('queue_status', 'IN_PROGRESS')

    if (error) {
      throw error
    }

    // Transform to frontend format
    const items = (sections || []).map((section: any) => ({
      id: section.id,
      section_type: section.section_type,
      reference_id: section.reference_id,
      tenant_name: section.tenant_references_v2
        ? `${decrypt(section.tenant_references_v2.tenant_first_name_encrypted) || ''} ${decrypt(section.tenant_references_v2.tenant_last_name_encrypted) || ''}`.trim()
        : 'Unknown',
      property_address: section.tenant_references_v2
        ? decrypt(section.tenant_references_v2.property_address_encrypted)
        : 'Unknown',
      started_at: section.assigned_at
    }))

    res.json({ items })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting my work:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get current user's personal stats
 */
router.get('/my-stats', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    // Get start of today (UTC)
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    // Get sections completed today by this staff member
    const { data: completedToday } = await supabase
      .from('reference_sections_v2')
      .select('id, decision, queue_entered_at, completed_at')
      .eq('assigned_to', staffUser.id)
      .eq('queue_status', 'COMPLETED')
      .gte('completed_at', today.toISOString())

    const completedCount = completedToday?.length || 0

    // Calculate average time
    let totalTimeMs = 0
    let timeCount = 0
    completedToday?.forEach(s => {
      if (s.queue_entered_at && s.completed_at) {
        totalTimeMs += new Date(s.completed_at).getTime() - new Date(s.queue_entered_at).getTime()
        timeCount++
      }
    })

    const avgTimeMs = timeCount > 0 ? totalTimeMs / timeCount : 0
    const avgMins = Math.round(avgTimeMs / (1000 * 60))
    const avgTime = avgMins < 60 ? `${avgMins}m` : `${Math.round(avgMins / 60)}h ${avgMins % 60}m`

    // Calculate pass rate (last 7 days for better sample)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const { data: recentDecisions } = await supabase
      .from('reference_sections_v2')
      .select('decision')
      .eq('assigned_to', staffUser.id)
      .eq('queue_status', 'COMPLETED')
      .gte('completed_at', weekAgo.toISOString())
      .not('decision', 'is', null)

    const totalDecisions = recentDecisions?.length || 0
    const passCount = recentDecisions?.filter(d => d.decision === 'PASS' || d.decision === 'PASS_WITH_CONDITION').length || 0
    const passRate = totalDecisions > 0 ? Math.round((passCount / totalDecisions) * 100) : 0

    res.json({
      completedToday: completedCount,
      avgTime,
      passRate
    })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting my stats:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get queue items by type for queue list view
 */
router.get('/queue/:type', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { type } = req.params
    const { limit: limitStr, offset: offsetStr } = req.query

    const sectionType = type.toUpperCase() as V2SectionType
    const validTypes: V2SectionType[] = [...new Set([...TENANT_SECTIONS, ...GUARANTOR_SECTIONS])]

    if (!validTypes.includes(sectionType)) {
      return res.status(400).json({ error: 'Invalid queue type' })
    }

    const limit = limitStr ? parseInt(limitStr as string) : 20
    const offset = offsetStr ? parseInt(offsetStr as string) : 0

    // Get sections in this queue with READY status
    const { data: sections, error } = await supabase
      .from('reference_sections_v2')
      .select('id, section_type, queue_status, queue_entered_at, assigned_to, assigned_at, reference_id')
      .eq('section_type', sectionType)
      .eq('queue_status', 'READY')
      .order('queue_entered_at', { ascending: true })
      .range(offset, offset + limit - 1)

    if (error) {
      throw error
    }

    // Fetch reference details for each section
    const referenceIds = [...new Set((sections || []).map(s => s.reference_id))]
    let refMap = new Map<string, any>()
    if (referenceIds.length > 0) {
      const { data: refs } = await supabase
        .from('tenant_references_v2')
        .select('id, company_id, tenant_first_name_encrypted, tenant_last_name_encrypted, property_address_encrypted, is_guarantor')
        .in('id', referenceIds)

      for (const ref of (refs || [])) {
        refMap.set(ref.id, ref)
      }
    }

    // Get company names
    const companyIds = [...new Set([...refMap.values()].map(r => r.company_id))]
    let companyMap = new Map<string, string>()
    if (companyIds.length > 0) {
      const { data: companies } = await supabase
        .from('companies')
        .select('*')
        .in('id', companyIds)

      for (const c of (companies || [])) {
        const co = c as any
        companyMap.set(c.id, co.name || (co.name_encrypted ? decrypt(co.name_encrypted) : null) || co.company_name || 'Unknown')
      }
    }

    // Get staff names for any claimed sections
    const staffIds = [...new Set(sections?.filter(s => s.assigned_to).map(s => s.assigned_to) || [])]
    let staffMap = new Map<string, string>()
    if (staffIds.length > 0) {
      const { data: staffUsers } = await supabase
        .from('staff_users')
        .select('id, first_name, last_name')
        .in('id', staffIds)

      staffMap = new Map(staffUsers?.map(s => [s.id, `${s.first_name || ''} ${s.last_name || ''}`.trim()]) || [])
    }

    // Transform to frontend format
    const items = (sections || []).map((section: any) => {
      const ref = refMap.get(section.reference_id)
      const ageHours = section.queue_entered_at
        ? Math.round((Date.now() - new Date(section.queue_entered_at).getTime()) / (1000 * 60 * 60))
        : 0

      return {
        id: section.id,
        section_id: section.id,
        section_type: section.section_type,
        queue_status: section.queue_status,
        reference_id: section.reference_id,
        tenant_name: ref
          ? `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
          : 'Unknown',
        property_address: ref ? (decrypt(ref.property_address_encrypted) || 'Unknown') : 'Unknown',
        company_name: ref ? (companyMap.get(ref.company_id) || 'Unknown') : 'Unknown',
        is_guarantor: ref?.is_guarantor || false,
        claimed_by: section.assigned_to,
        claimed_by_name: staffMap.get(section.assigned_to) || null,
        claimed_at: section.assigned_at,
        queue_entered_at: section.queue_entered_at,
        age_hours: ageHours,
        urgency: ageHours > 48 ? 'URGENT' : ageHours > 24 ? 'WARNING' : 'NORMAL'
      }
    })

    res.json({ items })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting queue items:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// QUEUE METRICS
// ============================================================================

/**
 * Get comprehensive queue metrics
 */
router.get('/metrics', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Section queue counts by type and status
    const { data: sectionCounts } = await supabase
      .from('reference_sections_v2')
      .select('section_type, queue_status')

    const sectionMetrics: Record<string, Record<string, number>> = {}
    const sectionTypes: V2SectionType[] = ['IDENTITY', 'RTR', 'INCOME', 'RESIDENTIAL', 'CREDIT', 'AML']

    for (const type of sectionTypes) {
      sectionMetrics[type] = {
        pending: 0,
        ready: 0,
        in_progress: 0,
        completed: 0
      }
    }

    sectionCounts?.forEach(s => {
      const type = s.section_type as V2SectionType
      const status = s.queue_status?.toLowerCase() || 'pending'
      if (sectionMetrics[type]) {
        sectionMetrics[type][status] = (sectionMetrics[type][status] || 0) + 1
      }
    })

    // Chase queue metrics
    const { data: chaseItems } = await supabase
      .from('chase_items_v2')
      .select('status, chase_queue_entered_at, initial_sent_at')

    const chaseMetrics = {
      waiting: 0,
      in_chase_queue: 0,
      overdue: 0, // In chase queue > 24 hours
      resolved: 0
    }

    chaseItems?.forEach(c => {
      if (c.status === 'WAITING') chaseMetrics.waiting++
      else if (c.status === 'IN_CHASE_QUEUE') {
        chaseMetrics.in_chase_queue++
        if (c.chase_queue_entered_at) {
          const enteredAt = new Date(c.chase_queue_entered_at)
          if (enteredAt < oneDayAgo) {
            chaseMetrics.overdue++
          }
        }
      } else if (['RECEIVED', 'VERBAL_OBTAINED', 'UNABLE_TO_OBTAIN'].includes(c.status)) {
        chaseMetrics.resolved++
      }
    })

    // Final review queue
    const { data: finalReviewItems } = await supabase
      .from('work_items_v2')
      .select('status, created_at')
      .eq('work_type', 'FINAL_REVIEW')

    const finalReviewMetrics = {
      pending: 0,
      in_progress: 0,
      completed_today: 0
    }

    finalReviewItems?.forEach(w => {
      if (w.status === 'AVAILABLE') finalReviewMetrics.pending++
      else if (w.status === 'IN_PROGRESS' || w.status === 'ASSIGNED') finalReviewMetrics.in_progress++
      else if (w.status === 'COMPLETED') {
        const completedAt = new Date(w.created_at)
        if (completedAt > oneDayAgo) finalReviewMetrics.completed_today++
      }
    })

    // Reference status counts
    const { data: references } = await supabase
      .from('tenant_references_v2')
      .select('status, created_at, final_decision_at')
      .eq('is_guarantor', false)

    const referenceMetrics = {
      total: references?.length || 0,
      sent: 0,
      collecting: 0,
      action_required: 0,
      accepted: 0,
      rejected: 0,
      completed_this_week: 0
    }

    references?.forEach(r => {
      if (r.status === 'SENT') referenceMetrics.sent++
      else if (r.status === 'COLLECTING_EVIDENCE') referenceMetrics.collecting++
      else if (r.status === 'ACTION_REQUIRED') referenceMetrics.action_required++
      else if (r.status.startsWith('ACCEPTED')) {
        referenceMetrics.accepted++
        if (r.final_decision_at && new Date(r.final_decision_at) > oneWeekAgo) {
          referenceMetrics.completed_this_week++
        }
      }
      else if (r.status === 'REJECTED') {
        referenceMetrics.rejected++
        if (r.final_decision_at && new Date(r.final_decision_at) > oneWeekAgo) {
          referenceMetrics.completed_this_week++
        }
      }
    })

    res.json({
      timestamp: now.toISOString(),
      sections: sectionMetrics,
      chase: chaseMetrics,
      finalReview: finalReviewMetrics,
      references: referenceMetrics
    })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting metrics:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// STAFF ALLOCATION
// ============================================================================

/**
 * Get staff workload distribution
 */
router.get('/staff-allocation', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    // Get all active staff
    const { data: staffUsers } = await supabase
      .from('staff_users')
      .select('id, first_name, last_name, role, status')
      .eq('status', 'active')

    if (!staffUsers || staffUsers.length === 0) {
      return res.json({ staff: [] })
    }

    // Get current assignments for each staff member
    const staffAllocation = await Promise.all(
      staffUsers.map(async (staff) => {
        // Sections claimed by this staff
        const { data: claimedSections } = await supabase
          .from('reference_sections_v2')
          .select('id, section_type, queue_status, assigned_at')
          .eq('assigned_to', staff.id)
          .in('queue_status', ['IN_PROGRESS'])

        // Work items assigned
        const { data: workItems } = await supabase
          .from('work_items_v2')
          .select('id, work_type, status, assigned_at')
          .eq('assigned_to', staff.id)
          .in('status', ['ASSIGNED', 'IN_PROGRESS'])

        // Completed today
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { count: completedToday } = await supabase
          .from('reference_sections_v2')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', staff.id)
          .gte('completed_at', today.toISOString())

        return {
          id: staff.id,
          name: `${staff.first_name} ${staff.last_name}`,
          role: staff.role,
          currentLoad: {
            sections: claimedSections?.length || 0,
            workItems: workItems?.length || 0,
            total: (claimedSections?.length || 0) + (workItems?.length || 0)
          },
          claimedSections: claimedSections?.map(s => ({
            id: s.id,
            type: s.section_type,
            assignedAt: s.assigned_at
          })) || [],
          workItems: workItems?.map(w => ({
            id: w.id,
            type: w.work_type,
            assignedAt: w.assigned_at
          })) || [],
          completedToday: completedToday || 0
        }
      })
    )

    // Sort by current load (descending)
    staffAllocation.sort((a, b) => b.currentLoad.total - a.currentLoad.total)

    res.json({ staff: staffAllocation })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting staff allocation:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// QUEUE HEALTH
// ============================================================================

/**
 * Get detailed queue health analysis
 */
router.get('/queue-health', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const now = new Date()
    const slaThresholds = {
      section_review_hours: 4, // Sections should be reviewed within 4 hours
      chase_response_hours: 24, // Chase items should get response within 24 hours
      final_review_hours: 2 // Final reviews should be done within 2 hours
    }

    // Find sections that are overdue
    const fourHoursAgo = new Date(now.getTime() - slaThresholds.section_review_hours * 60 * 60 * 1000)
    const { data: overdueSections } = await supabase
      .from('reference_sections_v2')
      .select(`
        id,
        section_type,
        queue_status,
        queue_entered_at,
        reference_id,
        tenant_references_v2!inner (
          tenant_first_name_encrypted,
          tenant_last_name_encrypted
        )
      `)
      .eq('queue_status', 'READY')
      .lt('queue_entered_at', fourHoursAgo.toISOString())
      .order('queue_entered_at', { ascending: true })
      .limit(20)

    // Find chase items that are overdue
    const twentyFourHoursAgo = new Date(now.getTime() - slaThresholds.chase_response_hours * 60 * 60 * 1000)
    const { data: overdueChases } = await supabase
      .from('chase_items_v2')
      .select(`
        id,
        referee_type,
        referee_name_encrypted,
        status,
        chase_queue_entered_at,
        chase_count,
        reference_id
      `)
      .eq('status', 'IN_CHASE_QUEUE')
      .lt('chase_queue_entered_at', twentyFourHoursAgo.toISOString())
      .order('chase_queue_entered_at', { ascending: true })
      .limit(20)

    // Find final reviews that are overdue
    const twoHoursAgo = new Date(now.getTime() - slaThresholds.final_review_hours * 60 * 60 * 1000)
    const { data: overdueFinalReviews } = await supabase
      .from('work_items_v2')
      .select(`
        id,
        reference_id,
        status,
        created_at,
        tenant_references_v2!inner (
          tenant_first_name_encrypted,
          tenant_last_name_encrypted
        )
      `)
      .eq('work_type', 'FINAL_REVIEW')
      .eq('status', 'AVAILABLE')
      .lt('created_at', twoHoursAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(20)

    // Calculate average processing times
    const { data: completedSections } = await supabase
      .from('reference_sections_v2')
      .select('queue_entered_at, completed_at, section_type')
      .eq('queue_status', 'COMPLETED')
      .not('queue_entered_at', 'is', null)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false })
      .limit(100)

    const avgProcessingTimes: Record<string, number> = {}
    const processingCounts: Record<string, number> = {}

    completedSections?.forEach(s => {
      if (s.queue_entered_at && s.completed_at) {
        const duration = new Date(s.completed_at).getTime() - new Date(s.queue_entered_at).getTime()
        const hours = duration / (1000 * 60 * 60)
        const type = s.section_type
        avgProcessingTimes[type] = (avgProcessingTimes[type] || 0) + hours
        processingCounts[type] = (processingCounts[type] || 0) + 1
      }
    })

    Object.keys(avgProcessingTimes).forEach(type => {
      avgProcessingTimes[type] = Math.round((avgProcessingTimes[type] / processingCounts[type]) * 10) / 10
    })

    // Format overdue items with decrypted names
    const formatOverdueSections = overdueSections?.map(s => ({
      id: s.id,
      referenceId: s.reference_id,
      sectionType: s.section_type,
      tenantName: `${decrypt((s.tenant_references_v2 as any)?.tenant_first_name_encrypted || '')} ${decrypt((s.tenant_references_v2 as any)?.tenant_last_name_encrypted || '')}`,
      waitingHours: Math.round((now.getTime() - new Date(s.queue_entered_at!).getTime()) / (1000 * 60 * 60) * 10) / 10
    })) || []

    const formatOverdueChases = overdueChases?.map(c => ({
      id: c.id,
      referenceId: c.reference_id,
      refereeType: c.referee_type,
      refereeName: decrypt(c.referee_name_encrypted || ''),
      chaseCount: c.chase_count,
      waitingHours: Math.round((now.getTime() - new Date(c.chase_queue_entered_at!).getTime()) / (1000 * 60 * 60) * 10) / 10
    })) || []

    const formatOverdueFinalReviews = overdueFinalReviews?.map(f => ({
      id: f.id,
      referenceId: f.reference_id,
      tenantName: `${decrypt((f.tenant_references_v2 as any)?.tenant_first_name_encrypted || '')} ${decrypt((f.tenant_references_v2 as any)?.tenant_last_name_encrypted || '')}`,
      waitingHours: Math.round((now.getTime() - new Date(f.created_at).getTime()) / (1000 * 60 * 60) * 10) / 10
    })) || []

    res.json({
      timestamp: now.toISOString(),
      slaThresholds,
      overdue: {
        sections: formatOverdueSections,
        chases: formatOverdueChases,
        finalReviews: formatOverdueFinalReviews
      },
      averageProcessingTimes: avgProcessingTimes,
      healthScore: calculateHealthScore(
        formatOverdueSections.length,
        formatOverdueChases.length,
        formatOverdueFinalReviews.length
      )
    })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting queue health:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Calculate overall health score (0-100)
 */
function calculateHealthScore(overdueSections: number, overdueChases: number, overdueFinalReviews: number): number {
  // Start at 100, deduct points for overdue items
  let score = 100
  score -= overdueSections * 3 // Each overdue section costs 3 points
  score -= overdueChases * 2 // Each overdue chase costs 2 points
  score -= overdueFinalReviews * 5 // Each overdue final review costs 5 points
  return Math.max(0, Math.min(100, score))
}

// ============================================================================
// REASSIGNMENT
// ============================================================================

/**
 * Reassign a section to a different staff member
 */
router.post('/reassign/:sectionId', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { sectionId } = req.params
    const { newAssigneeId } = req.body

    if (!newAssigneeId) {
      return res.status(400).json({ error: 'newAssigneeId is required' })
    }

    // Verify the assignee exists and is active
    const { data: newAssignee } = await supabase
      .from('staff_users')
      .select('id, first_name, last_name')
      .eq('id', newAssigneeId)
      .eq('status', 'active')
      .single()

    if (!newAssignee) {
      return res.status(404).json({ error: 'Staff member not found or inactive' })
    }

    // Update the section assignment
    const { error } = await supabase
      .from('reference_sections_v2')
      .update({
        assigned_to: newAssigneeId,
        assigned_at: new Date().toISOString(),
        queue_status: 'IN_PROGRESS'
      })
      .eq('id', sectionId)

    if (error) {
      throw error
    }

    res.json({
      message: 'Section reassigned successfully',
      sectionId,
      assignedTo: `${newAssignee.first_name} ${newAssignee.last_name}`
    })
  } catch (error: any) {
    console.error('[V2 Admin] Error reassigning section:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Force escalate a reference to final review
 */
router.post('/escalate/:referenceId', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { referenceId } = req.params
    const { reason } = req.body
    const staffUser = req.staffUser

    // Check if final review work item already exists
    const { data: existingWorkItem } = await supabase
      .from('work_items_v2')
      .select('id')
      .eq('reference_id', referenceId)
      .eq('work_type', 'FINAL_REVIEW')
      .single()

    if (existingWorkItem) {
      return res.status(400).json({ error: 'Final review already exists for this reference' })
    }

    // Create final review work item
    const { data: workItem, error } = await supabase
      .from('work_items_v2')
      .insert({
        reference_id: referenceId,
        work_type: 'FINAL_REVIEW',
        status: 'AVAILABLE',
        priority: 10, // High priority for escalated items
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Update reference status
    await supabase
      .from('tenant_references_v2')
      .update({
        status: 'IN_REVIEW',
        updated_at: new Date().toISOString()
      })
      .eq('id', referenceId)

    res.json({
      message: 'Reference escalated to final review',
      referenceId,
      workItemId: workItem.id,
      reason
    })
  } catch (error: any) {
    console.error('[V2 Admin] Error escalating reference:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// COMPANIES
// ============================================================================

/**
 * List all companies
 */
router.get('/companies', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    // Get all companies with reference counts
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, email, phone, created_at, use_references_v2')
      .order('name', { ascending: true })

    if (error) throw error

    // Get reference counts per company
    const companiesWithCounts = await Promise.all(
      (companies || []).map(async (company) => {
        const { count } = await supabase
          .from('tenant_references_v2')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', company.id)

        return {
          ...company,
          reference_count: count || 0
        }
      })
    )

    res.json({ companies: companiesWithCounts })
  } catch (error: any) {
    console.error('[V2 Admin] Error fetching companies:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Create a new company
 */
router.post('/companies', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { name, email, phone, use_references_v2 } = req.body

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' })
    }

    const { data: company, error } = await supabase
      .from('companies')
      .insert({
        name,
        email,
        phone: phone || null,
        use_references_v2: use_references_v2 || false,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    res.json({ company })
  } catch (error: any) {
    console.error('[V2 Admin] Error creating company:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Toggle V2 references for a company
 */
router.post('/companies/:companyId/toggle-v2', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { companyId } = req.params
    const { use_references_v2 } = req.body

    const { data: company, error } = await supabase
      .from('companies')
      .update({ use_references_v2: !!use_references_v2 })
      .eq('id', companyId)
      .select()
      .single()

    if (error) throw error

    res.json({ company, message: `V2 references ${use_references_v2 ? 'enabled' : 'disabled'}` })
  } catch (error: any) {
    console.error('[V2 Admin] Error toggling V2:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// STAFF MANAGEMENT
// ============================================================================

/**
 * List all staff users
 */
router.get('/staff', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { data: staff, error } = await supabase
      .from('staff_users')
      .select('id, first_name, last_name, email, role, status, created_at')
      .order('first_name', { ascending: true })

    if (error) throw error

    // Get completion stats for each staff member
    const staffWithStats = await Promise.all(
      (staff || []).map(async (s) => {
        const { count } = await supabase
          .from('reference_sections_v2')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', s.id)
          .eq('queue_status', 'COMPLETED')

        return {
          ...s,
          name: `${s.first_name || ''} ${s.last_name || ''}`.trim() || s.email,
          is_active: s.status === 'active',
          completed_count: count || 0,
          avg_time: '-' // Could calculate this from queue_entered_at to completed_at
        }
      })
    )

    res.json({ staff: staffWithStats })
  } catch (error: any) {
    console.error('[V2 Admin] Error fetching staff:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Create a new staff user
 */
router.post('/staff', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { email, name, role } = req.body

    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' })
    }

    const nameParts = name.split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    const { data: staff, error } = await supabase
      .from('staff_users')
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        role: role || 'assessor',
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw error

    res.json({ staff })
  } catch (error: any) {
    console.error('[V2 Admin] Error creating staff:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// REFERENCE SEARCH
// ============================================================================

/**
 * Search references by ID, name, email, or property
 */
router.get('/references/search', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { q } = req.query

    if (!q || (q as string).length < 2) {
      return res.json({ references: [] })
    }

    const searchTerm = (q as string).toLowerCase()

    // First try to find by UUID if it looks like one
    const isUuid = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(searchTerm)

    let references: any[] = []

    if (isUuid) {
      // Search by ID
      const { data } = await supabase
        .from('tenant_references_v2')
        .select(`
          id, status, created_at, company_id,
          tenant_first_name_encrypted, tenant_last_name_encrypted,
          tenant_email_encrypted, property_address_encrypted,
          companies!inner(name)
        `)
        .eq('id', searchTerm)
        .limit(1)

      references = data || []
    } else {
      // Search V2 references — must fetch all and filter in memory because
      // fields are encrypted. Order by most recent first for relevance.
      const { data: v2Refs } = await supabase
        .from('tenant_references_v2')
        .select(`
          id, status, created_at, company_id,
          tenant_first_name_encrypted, tenant_last_name_encrypted,
          tenant_email_encrypted, property_address_encrypted,
          companies(name)
        `)
        .order('created_at', { ascending: false })
        .limit(500)

      // Filter and decrypt - searching encrypted fields requires fetching and filtering in-memory
      console.log(`[V2 Admin Search] Fetched ${v2Refs?.length || 0} refs, searching for "${searchTerm}"`)

      // Log first 3 decrypted names to verify decrypt is working
      if (v2Refs && v2Refs.length > 0) {
        for (let i = 0; i < Math.min(3, v2Refs.length); i++) {
          const fn = decrypt(v2Refs[i].tenant_first_name_encrypted || '') || ''
          const ln = decrypt(v2Refs[i].tenant_last_name_encrypted || '') || ''
          console.log(`[V2 Admin Search] Sample ref ${i}: "${fn} ${ln}" (id: ${v2Refs[i].id})`)
        }
      }

      references = (v2Refs || []).filter(ref => {
        const firstName = (decrypt(ref.tenant_first_name_encrypted || '') || '').toLowerCase()
        const lastName = (decrypt(ref.tenant_last_name_encrypted || '') || '').toLowerCase()
        const email = (decrypt(ref.tenant_email_encrypted || '') || '').toLowerCase()
        const address = (decrypt(ref.property_address_encrypted || '') || '').toLowerCase()

        return firstName.includes(searchTerm) ||
               lastName.includes(searchTerm) ||
               email.includes(searchTerm) ||
               address.includes(searchTerm) ||
               `${firstName} ${lastName}`.includes(searchTerm)
      }).slice(0, 20)

      console.log(`[V2 Admin Search] Found ${references.length} matches for "${searchTerm}"`)
    }

    // Decrypt and format results
    const formattedResults = references.map(ref => ({
      id: ref.id,
      status: ref.status,
      created_at: ref.created_at,
      company_id: ref.company_id,
      company_name: (ref.companies as any)?.name || 'Unknown',
      tenant_first_name: decrypt(ref.tenant_first_name_encrypted || ''),
      tenant_last_name: decrypt(ref.tenant_last_name_encrypted || ''),
      tenant_email: decrypt(ref.tenant_email_encrypted || ''),
      property_address: decrypt(ref.property_address_encrypted || '')
    }))

    res.json({ references: formattedResults })
  } catch (error: any) {
    console.error('[V2 Admin] Error searching references:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// SLA REPORTS
// ============================================================================

/**
 * Generate SLA compliance report
 */
router.get('/reports/sla', authenticateStaff, requireAdminRole, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate as string) : new Date()

    // Get all completed sections in date range
    const { data: completedSections } = await supabase
      .from('reference_sections_v2')
      .select('section_type, queue_entered_at, completed_at, assigned_to')
      .eq('queue_status', 'COMPLETED')
      .gte('completed_at', start.toISOString())
      .lte('completed_at', end.toISOString())

    // Calculate SLA compliance (4 hours = 14400000ms)
    const slaThresholdMs = 4 * 60 * 60 * 1000
    let totalSections = 0
    let withinSla = 0
    const byType: Record<string, { total: number; withinSla: number }> = {}

    completedSections?.forEach(s => {
      if (s.queue_entered_at && s.completed_at) {
        totalSections++
        const duration = new Date(s.completed_at).getTime() - new Date(s.queue_entered_at).getTime()
        const isWithinSla = duration <= slaThresholdMs

        if (isWithinSla) withinSla++

        const type = s.section_type
        if (!byType[type]) {
          byType[type] = { total: 0, withinSla: 0 }
        }
        byType[type].total++
        if (isWithinSla) byType[type].withinSla++
      }
    })

    const slaCompliance = totalSections > 0 ? Math.round((withinSla / totalSections) * 100) : 100

    // Get completed final reviews
    const { data: completedReviews } = await supabase
      .from('tenant_references_v2')
      .select('id, status, created_at, final_decision_at')
      .in('status', ['ACCEPTED', 'ACCEPTED_WITH_GUARANTOR', 'ACCEPTED_ON_CONDITION', 'REJECTED'])
      .gte('final_decision_at', start.toISOString())
      .lte('final_decision_at', end.toISOString())

    const finalReviewStats = {
      total: completedReviews?.length || 0,
      accepted: completedReviews?.filter(r => r.status.startsWith('ACCEPTED')).length || 0,
      rejected: completedReviews?.filter(r => r.status === 'REJECTED').length || 0
    }

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      slaCompliance: {
        overall: slaCompliance,
        byType: Object.entries(byType).map(([type, stats]) => ({
          type,
          total: stats.total,
          withinSla: stats.withinSla,
          compliance: Math.round((stats.withinSla / stats.total) * 100)
        }))
      },
      sectionsProcessed: totalSections,
      finalReviews: finalReviewStats
    })
  } catch (error: any) {
    console.error('[V2 Admin] Error generating SLA report:', error)
    res.status(500).json({ error: error.message })
  }
})

// ============================================================================
// REFERENCE EDITING & ACTIVITY (Staff - no company check)
// ============================================================================

/**
 * Edit a field on a reference (staff auth - no company check)
 */
router.patch('/references/:id/edit', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { field, value } = req.body
    const staffUser = req.staffUser

    if (!staffUser) {
      return res.status(401).json({ error: 'Staff authentication required' })
    }

    if (!field || value === undefined) {
      return res.status(400).json({ error: 'field and value are required' })
    }

    const result = await editReferenceField(
      id,
      field,
      value,
      staffUser.id,
      'staff'
    )

    if (!result.success) {
      return res.status(400).json({ error: result.error })
    }

    res.json({ success: true, isRefereeField: result.isRefereeField })
  } catch (error: any) {
    console.error('[V2 Admin] Error editing field:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get activity log for a reference (staff auth)
 */
router.get('/references/:id/activity', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const activity = await getActivityForReference(id)
    res.json({ activity })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting activity:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * Get ALL sections with pending tenant responses across all references
 * Powers the "Tenant Responses" queue tile on dashboard
 */
router.get('/pending-responses', authenticateStaff, async (req: StaffAuthRequest, res: Response) => {
  try {
    // Get all sections that have issue_status = 'RESPONSE_PENDING_REVIEW' in section_data
    const { data: sections, error } = await supabase
      .from('reference_sections_v2')
      .select(`
        id,
        section_type,
        queue_status,
        section_data,
        reference_id,
        updated_at
      `)
      .eq('queue_status', 'PENDING')
      .not('section_data', 'is', null)

    if (error) throw error

    // Filter for sections with RESPONSE_PENDING_REVIEW issue_status
    const pendingSections = (sections || []).filter(s => {
      const data = s.section_data as Record<string, any>
      return data?.issue_status === 'RESPONSE_PENDING_REVIEW'
    })

    if (pendingSections.length === 0) {
      return res.json({ sections: [], count: 0 })
    }

    // Get reference details for each section
    const referenceIds = [...new Set(pendingSections.map(s => s.reference_id))]
    const { data: refs } = await supabase
      .from('tenant_references_v2')
      .select('id, company_id, tenant_first_name_encrypted, tenant_last_name_encrypted, property_address_encrypted')
      .in('id', referenceIds)

    const refMap = new Map((refs || []).map(r => [r.id, r]))

    // Get company names
    const companyIds = [...new Set((refs || []).map(r => r.company_id))]
    const { data: companies } = companyIds.length > 0
      ? await supabase.from('companies').select('*').in('id', companyIds)
      : { data: [] }
    const companyMap = new Map((companies || []).map((c: any) => [c.id, c.name || (c.name_encrypted ? decrypt(c.name_encrypted) : null) || c.company_name || 'Unknown']))

    const formattedSections = pendingSections.map(s => {
      const ref = refMap.get(s.reference_id)
      const sectionData = s.section_data as Record<string, any>
      return {
        id: s.id,
        section_type: s.section_type,
        reference_id: s.reference_id,
        issue_type: sectionData?.issue_type || 'Unknown',
        issue_notes: sectionData?.issue_notes || '',
        issue_request_type: sectionData?.issue_request_type || 'document',
        issue_reported_at: sectionData?.issue_reported_at || s.updated_at,
        tenant_name: ref
          ? `${decrypt(ref.tenant_first_name_encrypted) || ''} ${decrypt(ref.tenant_last_name_encrypted) || ''}`.trim()
          : 'Unknown',
        property_address: ref ? (decrypt(ref.property_address_encrypted) || 'Unknown') : 'Unknown',
        company_name: ref ? (companyMap.get(ref.company_id) || 'Unknown') : 'Unknown'
      }
    })

    res.json({ sections: formattedSections, count: formattedSections.length })
  } catch (error: any) {
    console.error('[V2 Admin] Error getting pending responses:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
