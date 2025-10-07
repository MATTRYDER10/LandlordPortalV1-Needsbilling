import { Router } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

const router = Router()

// Debug endpoint to check user's company associations
router.get('/user-companies', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get ALL company_users entries for this user (including duplicates)
    const { data: allCompanyUsers, error } = await supabase
      .from('company_users')
      .select('id, company_id, role, created_at, companies(id, name)')
      .eq('user_id', userId)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    // Get count of references for each company
    const companiesWithRefCounts = await Promise.all((allCompanyUsers || []).map(async (cu: any) => {
      const { count } = await supabase
        .from('tenant_references')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', cu.company_id)

      return {
        ...cu,
        reference_count: count || 0
      }
    }))

    res.json({
      user_id: userId,
      total_entries: allCompanyUsers?.length || 0,
      entries: companiesWithRefCounts
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

// Debug endpoint to clean up duplicate entries (keeps the one with references)
router.post('/cleanup-duplicates', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id

    // Get ALL company_users entries for this user
    const { data: allCompanyUsers } = await supabase
      .from('company_users')
      .select('id, company_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (!allCompanyUsers || allCompanyUsers.length <= 1) {
      return res.json({ message: 'No duplicates found' })
    }

    // Group by company_id
    const groups: { [key: string]: any[] } = {}
    for (const entry of allCompanyUsers) {
      if (!groups[entry.company_id]) {
        groups[entry.company_id] = []
      }
      groups[entry.company_id].push(entry)
    }

    const deletedIds = []

    // For each company, keep only the oldest entry, delete the rest
    for (const companyId in groups) {
      const entries = groups[companyId]
      if (entries.length > 1) {
        // Keep the first (oldest), delete the rest
        for (let i = 1; i < entries.length; i++) {
          await supabase
            .from('company_users')
            .delete()
            .eq('id', entries[i].id)

          deletedIds.push(entries[i].id)
        }
      }
    }

    res.json({
      message: 'Cleanup complete',
      deleted_count: deletedIds.length,
      deleted_ids: deletedIds
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router
