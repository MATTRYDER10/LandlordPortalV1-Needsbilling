/**
 * RentGoose access control — must mirror frontend whitelist in Sidebar.vue
 *
 * RentGoose is gated by company name substring match. If a company is not on
 * this list, no RentGoose endpoints, schedulers, or background jobs may
 * process their data — otherwise their tenants would receive arrears emails
 * for a system the agent never opted into.
 */

import { supabase } from '../config/supabase'
import { decrypt } from './encryption'

const RENTGOOSE_ALLOWED_NAME_SUBSTRINGS = ['rg property', 'propertygoose', 'pearl lettings']

// Cache to avoid hammering the DB on every check (5 min TTL)
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { allowed: boolean; ts: number }>()

/**
 * Returns true if the given company is allowed to use RentGoose.
 */
export async function isRentGooseEnabled(companyId: string): Promise<boolean> {
  const cached = cache.get(companyId)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.allowed

  const { data } = await supabase
    .from('companies')
    .select('name_encrypted')
    .eq('id', companyId)
    .maybeSingle()

  const name = data?.name_encrypted ? (decrypt(data.name_encrypted) || '').toLowerCase() : ''
  const allowed = RENTGOOSE_ALLOWED_NAME_SUBSTRINGS.some(s => name.includes(s))

  cache.set(companyId, { allowed, ts: Date.now() })
  return allowed
}

/**
 * Returns the list of company IDs that have RentGoose enabled.
 * Used by background schedulers to filter their work.
 */
export async function getRentGooseEnabledCompanyIds(): Promise<string[]> {
  const { data } = await supabase
    .from('companies')
    .select('id, name_encrypted')

  const enabled: string[] = []
  for (const c of (data || [])) {
    const name = c.name_encrypted ? (decrypt(c.name_encrypted) || '').toLowerCase() : ''
    if (RENTGOOSE_ALLOWED_NAME_SUBSTRINGS.some(s => name.includes(s))) {
      enabled.push(c.id)
      cache.set(c.id, { allowed: true, ts: Date.now() })
    } else {
      cache.set(c.id, { allowed: false, ts: Date.now() })
    }
  }

  return enabled
}
