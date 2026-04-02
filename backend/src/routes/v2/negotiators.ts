import { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../../middleware/auth'
import { supabase } from '../../config/supabase'

const router = Router()

/**
 * GET / — list active negotiators for company
 */
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { data: negotiators, error } = await supabase
      .from('negotiators')
      .select('id, name, email, is_active, created_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ negotiators: negotiators || [] })
  } catch (error: any) {
    console.error('[Negotiators] Error fetching negotiators:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST / — add negotiator (name + email), 409 on duplicate email
 */
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { name, email } = req.body
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' })
    }

    // Check for existing (including soft-deleted) — reactivate if found
    const { data: existing } = await supabase
      .from('negotiators')
      .select('id, is_active')
      .eq('company_id', companyId)
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existing && existing.is_active) {
      return res.status(409).json({ error: 'A negotiator with this email already exists' })
    }

    if (existing && !existing.is_active) {
      // Reactivate
      const { data: reactivated, error } = await supabase
        .from('negotiators')
        .update({ is_active: true, name })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) {
        return res.status(400).json({ error: error.message })
      }
      return res.status(200).json({ negotiator: reactivated })
    }

    const { data: negotiator, error } = await supabase
      .from('negotiators')
      .insert({
        company_id: companyId,
        name,
        email: email.toLowerCase()
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A negotiator with this email already exists' })
      }
      return res.status(400).json({ error: error.message })
    }

    res.status(201).json({ negotiator })
  } catch (error: any) {
    console.error('[Negotiators] Error adding negotiator:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /:id — soft-delete (set is_active = false)
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const { id } = req.params

    const { error } = await supabase
      .from('negotiators')
      .update({ is_active: false })
      .eq('id', id)
      .eq('company_id', companyId)

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error('[Negotiators] Error removing negotiator:', error)
    res.status(500).json({ error: error.message })
  }
})

/**
 * GET /stats?period=daily|weekly|monthly|ytd — performance aggregation
 */
router.get('/stats', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) {
      return res.status(404).json({ error: 'Company not found' })
    }

    const period = (req.query.period as string) || 'weekly'
    const now = new Date()
    let rangeStart: string

    switch (period) {
      case 'daily':
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        break
      case 'weekly':
        const weekAgo = new Date(now)
        weekAgo.setDate(weekAgo.getDate() - 7)
        rangeStart = weekAgo.toISOString()
        break
      case 'monthly':
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        break
      case 'ytd':
        rangeStart = new Date(now.getFullYear(), 0, 1).toISOString()
        break
      default:
        rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString()
    }

    // Get all active negotiators for this company
    const { data: negotiators } = await supabase
      .from('negotiators')
      .select('id, name, email')
      .eq('company_id', companyId)
      .eq('is_active', true)

    if (!negotiators || negotiators.length === 0) {
      return res.json({ stats: [], period })
    }

    // Offers Sent: count from sent_offer_forms
    const { data: sentCounts } = await supabase
      .from('sent_offer_forms')
      .select('negotiator_id')
      .eq('company_id', companyId)
      .gte('created_at', rangeStart)
      .not('negotiator_id', 'is', null)

    // Offers Received: count from tenant_offers
    const { data: receivedCounts } = await supabase
      .from('tenant_offers')
      .select('negotiator_id')
      .eq('company_id', companyId)
      .gte('created_at', rangeStart)
      .not('negotiator_id', 'is', null)

    // Let Agreed: count from tenant_offers where holding_deposit_received_at is set
    const { data: letAgreedCounts } = await supabase
      .from('tenant_offers')
      .select('negotiator_id')
      .eq('company_id', companyId)
      .gte('holding_deposit_received_at', rangeStart)
      .not('negotiator_id', 'is', null)

    // Aggregate counts per negotiator
    const countBy = (rows: any[] | null, field: string) => {
      const map: Record<string, number> = {}
      if (!rows) return map
      for (const row of rows) {
        const key = row[field]
        if (key) map[key] = (map[key] || 0) + 1
      }
      return map
    }

    const sentMap = countBy(sentCounts, 'negotiator_id')
    const receivedMap = countBy(receivedCounts, 'negotiator_id')
    const letAgreedMap = countBy(letAgreedCounts, 'negotiator_id')

    const stats = negotiators.map(n => ({
      id: n.id,
      name: n.name,
      email: n.email,
      offers_sent: sentMap[n.id] || 0,
      offers_received: receivedMap[n.id] || 0,
      let_agreed: letAgreedMap[n.id] || 0
    }))

    // Sort by let_agreed desc, then received desc
    stats.sort((a, b) => b.let_agreed - a.let_agreed || b.offers_received - a.offers_received)

    res.json({ stats, period })
  } catch (error: any) {
    console.error('[Negotiators] Error fetching stats:', error)
    res.status(500).json({ error: error.message })
  }
})

export default router
