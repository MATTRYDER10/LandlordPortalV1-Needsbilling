/**
 * RentGoose access control — single source of truth.
 *
 * RentGoose is gated per company by the `companies.rentgoose_enabled` flag,
 * toggled by staff admin. If a company is not enabled, no RentGoose endpoints,
 * schedulers, or background jobs may process their data.
 */

import { supabase } from '../config/supabase'

// Cache to avoid hammering the DB on every check (5 min TTL)
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { allowed: boolean; ts: number }>()

export function invalidateRentGooseAccessCache(companyId?: string): void {
  if (companyId) cache.delete(companyId)
  else cache.clear()
}

/**
 * Returns true if the given company is allowed to use RentGoose.
 */
export async function isRentGooseEnabled(companyId: string): Promise<boolean> {
  const cached = cache.get(companyId)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.allowed

  const { data } = await supabase
    .from('companies')
    .select('rentgoose_enabled')
    .eq('id', companyId)
    .maybeSingle()

  const allowed = data?.rentgoose_enabled === true
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
    .select('id')
    .eq('rentgoose_enabled', true)

  const ids = (data || []).map(c => c.id)
  for (const id of ids) cache.set(id, { allowed: true, ts: Date.now() })
  return ids
}
