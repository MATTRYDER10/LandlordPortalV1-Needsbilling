import { Router } from 'express'
import { authenticateToken, AuthRequest, getCompanyIdForRequest } from '../middleware/auth'
import { supabase } from '../config/supabase'

const router = Router()

// GET /api/property-charges/:propertyId — list charges for a property
router.get('/:propertyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { data, error } = await supabase
      .from('property_charges')
      .select('*')
      .eq('property_id', req.params.propertyId)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    console.error('Error fetching property charges:', err)
    res.status(500).json({ error: 'Failed to fetch charges' })
  }
})

// POST /api/property-charges/:propertyId — add a charge
router.post('/:propertyId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { description, amount, charge_type, is_vatable } = req.body

    if (!description?.trim()) return res.status(400).json({ error: 'Description is required' })
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' })

    const { data, error } = await supabase
      .from('property_charges')
      .insert({
        property_id: req.params.propertyId,
        company_id: companyId,
        description: description.trim(),
        amount,
        charge_type: charge_type || 'recurring',
        is_vatable: is_vatable || false
      })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err: any) {
    console.error('Error creating property charge:', err)
    res.status(500).json({ error: 'Failed to create charge' })
  }
})

// PUT /api/property-charges/:propertyId/:id — update a charge
router.put('/:propertyId/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { description, amount, charge_type, is_vatable } = req.body

    const updateData: any = {}
    if (description !== undefined) updateData.description = description.trim()
    if (amount !== undefined) updateData.amount = amount
    if (charge_type !== undefined) updateData.charge_type = charge_type
    if (is_vatable !== undefined) updateData.is_vatable = is_vatable

    const { data, error } = await supabase
      .from('property_charges')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('property_id', req.params.propertyId)
      .eq('company_id', companyId)
      .select()
      .single()

    if (error) throw error
    res.json(data)
  } catch (err: any) {
    console.error('Error updating property charge:', err)
    res.status(500).json({ error: 'Failed to update charge' })
  }
})

// DELETE /api/property-charges/:propertyId/:id — delete a charge
router.delete('/:propertyId/:id', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const companyId = await getCompanyIdForRequest(req)
    if (!companyId) return res.status(400).json({ error: 'Company ID required' })

    const { error } = await supabase
      .from('property_charges')
      .delete()
      .eq('id', req.params.id)
      .eq('property_id', req.params.propertyId)
      .eq('company_id', companyId)

    if (error) throw error
    res.json({ message: 'Charge deleted' })
  } catch (err: any) {
    console.error('Error deleting property charge:', err)
    res.status(500).json({ error: 'Failed to delete charge' })
  }
})

export default router
