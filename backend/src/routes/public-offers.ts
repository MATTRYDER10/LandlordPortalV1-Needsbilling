/**
 * Public Offer Form Routes
 *
 * No authentication required. The company is identified by its
 * offer_link_token (a UUID column on the companies table). Agents
 * paste the link into their CRM email templates; tenants click it
 * after a viewing and submit an offer without logging in.
 */

import { Router, Request, Response } from 'express'
import { supabase } from '../config/supabase'
import { encrypt, decrypt } from '../services/encryption'

const router = Router()

// ============================================================================
// GET /api/public/offer/:token — validate token, return company branding
// ============================================================================

router.get('/offer/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    const { data: company, error } = await supabase
      .from('companies')
      .select('id, name_encrypted, logo_url, primary_color, button_color')
      .eq('offer_link_token', token)
      .maybeSingle()

    if (error || !company) {
      return res.status(404).json({ error: 'Invalid or expired offer link' })
    }

    res.json({
      company_id: company.id,
      company_name: company.name_encrypted ? decrypt(company.name_encrypted) : 'Agency',
      company_logo: company.logo_url || null,
      primary_color: company.primary_color || '#f97316',
      button_color: company.button_color || '#f97316',
    })
  } catch (err: any) {
    console.error('[PublicOffer] Error validating token:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============================================================================
// POST /api/public/offer/:token — submit an offer
// ============================================================================

router.post('/offer/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params

    // Validate token → get company
    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .select('id')
      .eq('offer_link_token', token)
      .maybeSingle()

    if (companyErr || !company) {
      return res.status(404).json({ error: 'Invalid or expired offer link' })
    }

    const companyId = company.id

    const {
      tenant_first_name,
      tenant_last_name,
      tenant_email,
      tenant_phone,
      property_address,
      property_postcode,
      property_city,
      offered_rent_amount,
      proposed_move_in_date,
      proposed_tenancy_length_months,
      special_conditions,
      tenants, // additional tenants array [{ first_name, last_name, email, phone }]
    } = req.body

    // Validation
    if (!tenant_first_name || !tenant_last_name || !tenant_email) {
      return res.status(400).json({ error: 'Tenant name and email are required' })
    }
    if (!property_address || !property_postcode) {
      return res.status(400).json({ error: 'Property address and postcode are required' })
    }
    if (!offered_rent_amount || offered_rent_amount <= 0) {
      return res.status(400).json({ error: 'Proposed rent amount is required' })
    }

    // Property matching — search by postcode + fuzzy address match
    let linkedPropertyId: string | null = null
    const normPostcode = (property_postcode || '').toLowerCase().replace(/\s/g, '')
    const normAddr = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const targetAddr = normAddr(property_address)

    if (normPostcode) {
      const { data: properties } = await supabase
        .from('properties')
        .select('id, postcode, address_line1_encrypted')
        .eq('company_id', companyId)
        .is('deleted_at', null)

      // Filter by postcode client-side (encrypted field means we can't filter in DB)
      const postcodeMatches = (properties || []).filter(p =>
        (p.postcode || '').toLowerCase().replace(/\s/g, '') === normPostcode
      )

      if (postcodeMatches.length > 0 && targetAddr) {
        // Try exact address match
        let match = postcodeMatches.find(p => {
          const decrypted = p.address_line1_encrypted ? decrypt(p.address_line1_encrypted) : ''
          return normAddr(decrypted || '') === targetAddr
        })

        // Try partial match
        if (!match) {
          match = postcodeMatches.find(p => {
            const decrypted = normAddr(p.address_line1_encrypted ? (decrypt(p.address_line1_encrypted) || '') : '')
            return decrypted && (decrypted.includes(targetAddr) || targetAddr.includes(decrypted))
          })
        }

        // Try house number match
        if (!match) {
          const extractNum = (s: string) => { const m = s.match(/^(\d+)/); return m ? m[1] : null }
          const targetNum = extractNum(property_address)
          if (targetNum) {
            match = postcodeMatches.find(p => {
              const decrypted = p.address_line1_encrypted ? (decrypt(p.address_line1_encrypted) || '') : ''
              return extractNum(decrypted) === targetNum
            })
          }
        }

        // If exactly 1 property at that postcode, auto-match
        if (!match && postcodeMatches.length === 1) {
          match = postcodeMatches[0]
        }

        if (match) {
          linkedPropertyId = match.id
        }
      }
    }

    // Calculate deposit (5 weeks pro-rata)
    const rentAmount = parseFloat(offered_rent_amount)
    const depositAmount = Math.floor((rentAmount * 12 / 52) * 5)

    // Create the offer
    const { data: offer, error: offerErr } = await supabase
      .from('tenant_offers')
      .insert({
        company_id: companyId,
        property_address_encrypted: encrypt(property_address),
        property_city_encrypted: property_city ? encrypt(property_city) : null,
        property_postcode_encrypted: encrypt(property_postcode),
        offered_rent_amount: rentAmount,
        proposed_move_in_date: proposed_move_in_date || null,
        proposed_tenancy_length_months: proposed_tenancy_length_months || 12,
        deposit_amount: depositAmount,
        special_conditions_encrypted: special_conditions ? encrypt(special_conditions) : null,
        linked_property_id: linkedPropertyId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (offerErr || !offer) {
      console.error('[PublicOffer] Failed to create offer:', offerErr)
      return res.status(500).json({ error: 'Failed to submit offer' })
    }

    // Create lead tenant
    const allTenants = [
      { first_name: tenant_first_name, last_name: tenant_last_name, email: tenant_email, phone: tenant_phone, order: 1 },
      ...((tenants || []).map((t: any, i: number) => ({
        first_name: t.first_name || '',
        last_name: t.last_name || '',
        email: t.email || '',
        phone: t.phone || '',
        order: i + 2,
      }))),
    ]

    for (const t of allTenants) {
      const fullName = `${t.first_name} ${t.last_name}`.trim()
      await supabase
        .from('tenant_offer_tenants')
        .insert({
          tenant_offer_id: offer.id,
          tenant_order: t.order,
          name_encrypted: encrypt(fullName),
          email_encrypted: t.email ? encrypt(t.email) : null,
          phone_encrypted: t.phone ? encrypt(t.phone) : null,
        })
    }

    console.log(`[PublicOffer] Offer ${offer.id} created for company ${companyId}, property matched: ${!!linkedPropertyId}`)

    res.status(201).json({
      success: true,
      offer_id: offer.id,
      property_matched: !!linkedPropertyId,
    })
  } catch (err: any) {
    console.error('[PublicOffer] Error creating offer:', err)
    res.status(500).json({ error: 'Failed to submit offer' })
  }
})

export default router
