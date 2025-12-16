import { supabase } from '../config/supabase'

const LOCK_TIMEOUT_MINUTES = 30

interface LockResult {
  success: boolean
  lock?: {
    id: string
    workItemId: string
    lockedBy: string
    lockedByName: string
    lockedAt: string
    expiresAt: string
  }
  error?: string
  existingLock?: {
    lockedBy: string
    lockedByName: string
    lockedAt: string
    expiresAt: string
  }
}

interface LockStatus {
  isLocked: boolean
  lock?: {
    id: string
    lockedBy: string
    lockedByName: string
    lockedAt: string
    expiresAt: string
    isExpired: boolean
  }
}

/**
 * Acquire a lock on a work item
 * Only succeeds if no active (non-expired) lock exists
 */
export async function acquireLock(workItemId: string, staffId: string): Promise<LockResult> {
  try {
    // First, clean up any expired locks for this work item
    await cleanupExpiredLockForItem(workItemId)

    // Check if there's an existing lock
    const { data: existingLock, error: checkError } = await supabase
      .from('work_item_locks')
      .select(`
        id,
        locked_by,
        locked_at,
        expires_at,
        staff_users!work_item_locks_locked_by_fkey (
          full_name
        )
      `)
      .eq('work_item_id', workItemId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine
      throw checkError
    }

    if (existingLock) {
      // Check if it's our own lock
      if (existingLock.locked_by === staffId) {
        // Extend our own lock
        return await extendLock(workItemId, staffId)
      }

      // Someone else has the lock
      const staffUsers = existingLock.staff_users as Array<{ full_name: string }> | null
      const staffUser = staffUsers?.[0]
      return {
        success: false,
        error: 'Work item is locked by another user',
        existingLock: {
          lockedBy: existingLock.locked_by,
          lockedByName: staffUser?.full_name || 'Unknown',
          lockedAt: existingLock.locked_at,
          expiresAt: existingLock.expires_at
        }
      }
    }

    // No existing lock, create a new one
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MINUTES * 60 * 1000).toISOString()

    const { data: newLock, error: insertError } = await supabase
      .from('work_item_locks')
      .insert({
        work_item_id: workItemId,
        locked_by: staffId,
        expires_at: expiresAt
      })
      .select(`
        id,
        work_item_id,
        locked_by,
        locked_at,
        expires_at,
        staff_users!work_item_locks_locked_by_fkey (
          full_name
        )
      `)
      .single()

    if (insertError) {
      // Could be a race condition - another lock was created
      if (insertError.code === '23505') { // Unique violation
        return {
          success: false,
          error: 'Work item was locked by another user'
        }
      }
      throw insertError
    }

    const staffUsers = newLock.staff_users as Array<{ full_name: string }> | null
    const staffUser = staffUsers?.[0]

    return {
      success: true,
      lock: {
        id: newLock.id,
        workItemId: newLock.work_item_id,
        lockedBy: newLock.locked_by,
        lockedByName: staffUser?.full_name || 'Unknown',
        lockedAt: newLock.locked_at,
        expiresAt: newLock.expires_at
      }
    }
  } catch (error) {
    console.error('Failed to acquire lock:', error)
    return {
      success: false,
      error: 'Failed to acquire lock'
    }
  }
}

/**
 * Release a lock on a work item
 * Only the lock owner can release it
 */
export async function releaseLock(workItemId: string, staffId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('work_item_locks')
      .delete()
      .eq('work_item_id', workItemId)
      .eq('locked_by', staffId)

    if (error) {
      console.error('Failed to release lock:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to release lock:', error)
    return false
  }
}

/**
 * Extend a lock (heartbeat)
 * Resets the expiration time to 30 minutes from now
 */
export async function extendLock(workItemId: string, staffId: string): Promise<LockResult> {
  try {
    const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MINUTES * 60 * 1000).toISOString()

    const { data: updatedLock, error } = await supabase
      .from('work_item_locks')
      .update({
        expires_at: expiresAt,
        last_heartbeat_at: new Date().toISOString()
      })
      .eq('work_item_id', workItemId)
      .eq('locked_by', staffId)
      .select(`
        id,
        work_item_id,
        locked_by,
        locked_at,
        expires_at,
        staff_users!work_item_locks_locked_by_fkey (
          full_name
        )
      `)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'No lock found or lock owned by another user'
        }
      }
      throw error
    }

    const staffUsers = updatedLock.staff_users as Array<{ full_name: string }> | null
    const staffUser = staffUsers?.[0]

    return {
      success: true,
      lock: {
        id: updatedLock.id,
        workItemId: updatedLock.work_item_id,
        lockedBy: updatedLock.locked_by,
        lockedByName: staffUser?.full_name || 'Unknown',
        lockedAt: updatedLock.locked_at,
        expiresAt: updatedLock.expires_at
      }
    }
  } catch (error) {
    console.error('Failed to extend lock:', error)
    return {
      success: false,
      error: 'Failed to extend lock'
    }
  }
}

/**
 * Check the lock status for a work item
 */
export async function checkLockStatus(workItemId: string): Promise<LockStatus> {
  try {
    // Clean up expired lock first
    await cleanupExpiredLockForItem(workItemId)

    const { data: lock, error } = await supabase
      .from('work_item_locks')
      .select(`
        id,
        locked_by,
        locked_at,
        expires_at,
        staff_users!work_item_locks_locked_by_fkey (
          full_name
        )
      `)
      .eq('work_item_id', workItemId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { isLocked: false }
      }
      throw error
    }

    const staffUsers = lock.staff_users as Array<{ full_name: string }> | null
    const staffUser = staffUsers?.[0]
    const isExpired = new Date(lock.expires_at) < new Date()

    return {
      isLocked: !isExpired,
      lock: {
        id: lock.id,
        lockedBy: lock.locked_by,
        lockedByName: staffUser?.full_name || 'Unknown',
        lockedAt: lock.locked_at,
        expiresAt: lock.expires_at,
        isExpired
      }
    }
  } catch (error) {
    console.error('Failed to check lock status:', error)
    return { isLocked: false }
  }
}

/**
 * Get all locks held by a staff member
 */
export async function getStaffLocks(staffId: string): Promise<Array<{
  id: string
  workItemId: string
  lockedAt: string
  expiresAt: string
}>> {
  try {
    const { data: locks, error } = await supabase
      .from('work_item_locks')
      .select('id, work_item_id, locked_at, expires_at')
      .eq('locked_by', staffId)
      .gt('expires_at', new Date().toISOString())

    if (error) throw error

    return (locks || []).map(lock => ({
      id: lock.id,
      workItemId: lock.work_item_id,
      lockedAt: lock.locked_at,
      expiresAt: lock.expires_at
    }))
  } catch (error) {
    console.error('Failed to get staff locks:', error)
    return []
  }
}

/**
 * Clean up a specific expired lock
 */
async function cleanupExpiredLockForItem(workItemId: string): Promise<void> {
  try {
    await supabase
      .from('work_item_locks')
      .delete()
      .eq('work_item_id', workItemId)
      .lt('expires_at', new Date().toISOString())
  } catch (error) {
    console.error('Failed to cleanup expired lock:', error)
  }
}

/**
 * Clean up all expired locks (for scheduled job)
 */
export async function cleanupAllExpiredLocks(): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('work_item_locks')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id')

    if (error) throw error

    const count = data?.length || 0
    if (count > 0) {
      console.log(`Cleaned up ${count} expired locks`)
    }
    return count
  } catch (error) {
    console.error('Failed to cleanup expired locks:', error)
    return 0
  }
}

/**
 * Force release a lock (admin function)
 * Should only be used by admins to unlock stuck items
 */
export async function forceReleaseLock(workItemId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('work_item_locks')
      .delete()
      .eq('work_item_id', workItemId)

    if (error) {
      console.error('Failed to force release lock:', error)
      return false
    }

    return true
  } catch (error) {
    console.error('Failed to force release lock:', error)
    return false
  }
}
