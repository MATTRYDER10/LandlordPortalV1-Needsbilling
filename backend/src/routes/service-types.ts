import { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

const router = Router()

const DEFAULT_SERVICE_TYPES = [
  { name: 'Managed', sort_order: 0 },
  { name: 'Rent Collect', sort_order: 1 },
  { name: 'Let Only', sort_order: 2 }
]

async function ensureDefaults(companyId: string) {
  const { data: existing } = await supabase
    .from('landlord_service_types')
    .select('id')
    .eq('company_id', companyId)
    .limit(1)

  if (existing && existing.length > 0) return

  const inserts = DEFAULT_SERVICE_TYPES.map(t => ({
    company_id: companyId,
    name: t.name,
    is_default: true,
    sort_order: t.sort_order
  }))

  await supabase.from('landlord_service_types').insert(inserts)
}

// GET /api/service-types — list all service types (seeds defaults if none exist)
router.get('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    await ensureDefaults(companyId)

    const { data, error } = await supabase
      .from('landlord_service_types')
      .select('*')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    console.error('Error fetching service types:', err)
    res.status(500).json({ error: 'Failed to fetch service types' })
  }
})

// POST /api/service-types — create a new custom service type
router.post('/', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { name, default_fee_percent, default_letting_fee_amount, default_letting_fee_type } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' })

    // Get max sort_order
    const { data: existing } = await supabase
      .from('landlord_service_types')
      .select('sort_order')
      .eq('company_id', companyId)
      .order('sort_order', { ascending: false })
      .limit(1)

    const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0

    const { data, error } = await supabase
      .from('landlord_service_types')
      .insert({
        company_id: companyId,
        name: name.trim(),
        is_default: false,
        default_fee_percent: default_fee_percent || null,
        default_letting_fee_amount: default_letting_fee_amount || null,
        default_letting_fee_type: default_letting_fee_type || null,
        sort_order: nextOrder
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err: any) {
    console.error('Error creating service type:', err)
    res.status(500).json({ error: 'Failed to create service type' })
  }
})

// PUT /api/service-types/:id — update a service type
router.put('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { name, default_fee_percent, default_letting_fee_amount, default_letting_fee_type } = req.body

    const updateData: any = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name.trim()
    if (default_fee_percent !== undefined) updateData.default_fee_percent = default_fee_percent || null
    if (default_letting_fee_amount !== undefined) updateData.default_letting_fee_amount = default_letting_fee_amount
    if (default_letting_fee_type !== undefined) updateData.default_letting_fee_type = default_letting_fee_type

    const { data, error } = await supabase
      .from('landlord_service_types')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    console.error('Error updating service type:', err)
    res.status(500).json({ error: 'Failed to update service type' })
  }
})

// DELETE /api/service-types/:id — delete a custom service type (not defaults)
router.delete('/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    // Check if it's a default type
    const { data: existing } = await supabase
      .from('landlord_service_types')
      .select('is_default')
      .eq('id', req.params.id)
      .eq('company_id', companyId)
      .single()

    if (!existing) return res.status(404).json({ error: 'Service type not found' })
    if (existing.is_default) return res.status(400).json({ error: 'Cannot delete default service types' })

    // Check if any properties use this service type
    const { data: usedBy } = await supabase
      .from('properties')
      .select('id')
      .eq('service_type_id', req.params.id)
      .limit(1)

    if (usedBy && usedBy.length > 0) {
      return res.status(400).json({ error: 'Cannot delete — service type is assigned to properties' })
    }

    const { error } = await supabase
      .from('landlord_service_types')
      .delete()
      .eq('id', req.params.id)
      .eq('company_id', companyId)

    if (error) throw error
    res.json({ message: 'Service type deleted' })
  } catch (err: any) {
    console.error('Error deleting service type:', err)
    res.status(500).json({ error: 'Failed to delete service type' })
  }
})

export default router
