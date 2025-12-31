import { supabase as supabaseAdmin } from '../config/supabase'

// Notification types
export type NotificationType =
  | 'COMPLIANCE_EXPIRING_30'
  | 'COMPLIANCE_EXPIRING_14'
  | 'COMPLIANCE_EXPIRED'
  | 'PROPERTY_CREATED'
  | 'LANDLORD_LINKED'
  | 'DOCUMENT_UPLOADED'

export type NotificationSeverity = 'INFO' | 'WARNING' | 'URGENT'

export type ResourceType = 'property' | 'compliance_record' | 'landlord' | 'document'

interface CreateNotificationParams {
  companyId: string
  notificationType: NotificationType
  resourceType: ResourceType
  resourceId: string
  title: string
  message: string
  severity?: NotificationSeverity
  metadata?: Record<string, any>
  expiresAt?: Date
}

interface Notification {
  id: string
  company_id: string
  notification_type: NotificationType
  resource_type: ResourceType
  resource_id: string
  title: string
  message: string
  severity: NotificationSeverity
  email_sent: boolean
  email_sent_at: string | null
  in_app_created: boolean
  read_by: string[]
  dismissed_by: string[]
  actioned_at: string | null
  metadata: Record<string, any>
  created_at: string
  expires_at: string | null
}

/**
 * Create a new notification
 */
export async function createNotification(params: CreateNotificationParams): Promise<Notification | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_queue')
      .insert({
        company_id: params.companyId,
        notification_type: params.notificationType,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        title: params.title,
        message: params.message,
        severity: params.severity || 'INFO',
        metadata: params.metadata || {},
        expires_at: params.expiresAt?.toISOString() || null,
        in_app_created: true,
        email_sent: false,
        read_by: [],
        dismissed_by: []
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      return null
    }

    return data as Notification
  } catch (err) {
    console.error('Exception creating notification:', err)
    return null
  }
}

/**
 * Get unread notifications for a company/user
 */
export async function getNotifications(
  companyId: string,
  userId: string,
  options: {
    limit?: number
    includeRead?: boolean
    includeDismissed?: boolean
  } = {}
): Promise<Notification[]> {
  const { limit = 50, includeRead = false, includeDismissed = false } = options

  try {
    let query = supabaseAdmin
      .from('notification_queue')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(limit)

    // Filter out dismissed notifications unless requested
    if (!includeDismissed) {
      query = query.not('dismissed_by', 'cs', `{${userId}}`)
    }

    // Filter out expired notifications
    query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

    const { data, error } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      return []
    }

    return (data || []) as Notification[]
  } catch (err) {
    console.error('Exception fetching notifications:', err)
    return []
  }
}

/**
 * Get unread notification count for badge
 */
export async function getUnreadCount(companyId: string, userId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('notification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('read_by', 'cs', `{${userId}}`)
      .not('dismissed_by', 'cs', `{${userId}}`)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)

    if (error) {
      console.error('Error fetching unread count:', error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error('Exception fetching unread count:', err)
    return 0
  }
}

/**
 * Mark a notification as read by a user
 */
export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  try {
    // First get current read_by array
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('notification_queue')
      .select('read_by')
      .eq('id', notificationId)
      .single()

    if (fetchError || !current) {
      console.error('Error fetching notification for read:', fetchError)
      return false
    }

    const readBy = current.read_by || []
    if (readBy.includes(userId)) {
      return true // Already marked as read
    }

    const { error } = await supabaseAdmin
      .from('notification_queue')
      .update({ read_by: [...readBy, userId] })
      .eq('id', notificationId)

    if (error) {
      console.error('Error marking notification as read:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception marking notification as read:', err)
    return false
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(companyId: string, userId: string): Promise<boolean> {
  try {
    // Get all unread notifications
    const { data: notifications, error: fetchError } = await supabaseAdmin
      .from('notification_queue')
      .select('id, read_by')
      .eq('company_id', companyId)
      .not('read_by', 'cs', `{${userId}}`)
      .not('dismissed_by', 'cs', `{${userId}}`)

    if (fetchError) {
      console.error('Error fetching notifications for mark all read:', fetchError)
      return false
    }

    // Update each notification
    for (const notification of notifications || []) {
      const readBy = notification.read_by || []
      await supabaseAdmin
        .from('notification_queue')
        .update({ read_by: [...readBy, userId] })
        .eq('id', notification.id)
    }

    return true
  } catch (err) {
    console.error('Exception marking all notifications as read:', err)
    return false
  }
}

/**
 * Dismiss a notification for a user
 */
export async function dismissNotification(notificationId: string, userId: string): Promise<boolean> {
  try {
    // First get current dismissed_by array
    const { data: current, error: fetchError } = await supabaseAdmin
      .from('notification_queue')
      .select('dismissed_by')
      .eq('id', notificationId)
      .single()

    if (fetchError || !current) {
      console.error('Error fetching notification for dismiss:', fetchError)
      return false
    }

    const dismissedBy = current.dismissed_by || []
    if (dismissedBy.includes(userId)) {
      return true // Already dismissed
    }

    const { error } = await supabaseAdmin
      .from('notification_queue')
      .update({ dismissed_by: [...dismissedBy, userId] })
      .eq('id', notificationId)

    if (error) {
      console.error('Error dismissing notification:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception dismissing notification:', err)
    return false
  }
}

/**
 * Mark notification as email sent
 */
export async function markEmailSent(notificationId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('notification_queue')
      .update({
        email_sent: true,
        email_sent_at: new Date().toISOString()
      })
      .eq('id', notificationId)

    if (error) {
      console.error('Error marking email sent:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception marking email sent:', err)
    return false
  }
}

/**
 * Check if a similar notification already exists (to prevent duplicates)
 */
export async function notificationExists(
  companyId: string,
  notificationType: NotificationType,
  resourceId: string,
  withinHours: number = 24
): Promise<boolean> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setHours(cutoffDate.getHours() - withinHours)

    const { count, error } = await supabaseAdmin
      .from('notification_queue')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('notification_type', notificationType)
      .eq('resource_id', resourceId)
      .gte('created_at', cutoffDate.toISOString())

    if (error) {
      console.error('Error checking notification exists:', error)
      return false
    }

    return (count || 0) > 0
  } catch (err) {
    console.error('Exception checking notification exists:', err)
    return false
  }
}

/**
 * Delete old/expired notifications (cleanup job)
 */
export async function cleanupExpiredNotifications(olderThanDays: number = 90): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays)

    const { data, error } = await supabaseAdmin
      .from('notification_queue')
      .delete()
      .or(`expires_at.lt.${new Date().toISOString()},created_at.lt.${cutoffDate.toISOString()}`)
      .select('id')

    if (error) {
      console.error('Error cleaning up notifications:', error)
      return 0
    }

    return data?.length || 0
  } catch (err) {
    console.error('Exception cleaning up notifications:', err)
    return 0
  }
}
