/**
 * RentGoose access control — single source of truth.
 *
 * RentGoose is gated per company by the `companies.rentgoose_enabled` flag,
 * toggled by staff admin. If a company is not enabled, no RentGoose endpoints,
 * schedulers, or background jobs may process their data.
 *
 * Self-healing: legacy companies (RG Property, Pearl Lettings, PropertyGoose
 * Lettings) auto-enable themselves on first access — they had RentGoose
 * before the toggle existed and shouldn't lose it post-migration.
 */

import { supabase } from '../config/supabase'
import { decrypt } from './encryption'

// Legacy companies that should always have RentGoose enabled. Substring match.
const LEGACY_AUTOENABLE_NAMES = ['rg property', 'pearl letting', 'propertygoose letting', 'propertygoose lettings']

// Cache to avoid hammering the DB on every check (5 min TTL).
// Also stores in-flight Promises so concurrent first-load requests
// wait on the same DB call instead of each triggering their own.
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { allowed: boolean; ts: number }>()
const pendingChecks = new Map<string, Promise<boolean>>()

export function invalidateRentGooseAccessCache(companyId?: string): void {
  if (companyId) { cache.delete(companyId); pendingChecks.delete(companyId) }
  else { cache.clear(); pendingChecks.clear() }
}

function matchesLegacyName(decryptedName: string | null | undefined): boolean {
  if (!decryptedName) return false
  const lower = decryptedName.toLowerCase()
  return LEGACY_AUTOENABLE_NAMES.some(s => lower.includes(s))
}

/**
 * Returns true if the given company is allowed to use RentGoose.
 * Self-heals legacy whitelisted companies on first access.
 */
export async function isRentGooseEnabled(companyId: string): Promise<boolean> {
  // 1. Return immediately from result cache
  const cached = cache.get(companyId)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.allowed

  // 2. If another request is already checking this company, wait on the
  //    same Promise instead of firing a parallel DB query (thundering-herd
  //    protection). This fixes the first-load race where 5+ concurrent
  //    requests on page mount each independently query the DB before the
  //    cache is populated.
  const pending = pendingChecks.get(companyId)
  if (pending) return pending

  const check = (async () => {
    const { data } = await supabase
      .from('companies')
      .select('rentgoose_enabled, name_encrypted')
      .eq('id', companyId)
      .maybeSingle()

    if (!data) {
      cache.set(companyId, { allowed: false, ts: Date.now() })
      return false
    }

    let allowed = data.rentgoose_enabled === true

    // Self-heal: legacy companies auto-enable on first access
    if (!allowed && data.name_encrypted) {
      const name = decrypt(data.name_encrypted)
      if (matchesLegacyName(name)) {
        await supabase.from('companies').update({ rentgoose_enabled: true }).eq('id', companyId)
        console.log(`[RentGoose] Auto-enabled for legacy company ${companyId} (${name})`)
        allowed = true
      }
    }

    cache.set(companyId, { allowed, ts: Date.now() })
    return allowed
  })()

  pendingChecks.set(companyId, check)
  try {
    return await check
  } finally {
    pendingChecks.delete(companyId)
  }
}

/**
 * Returns the list of company IDs that have RentGoose enabled.
 * Used by background schedulers to filter their work.
 * Also self-heals legacy companies the first time they're scanned.
 */
export async function getRentGooseEnabledCompanyIds(): Promise<string[]> {
  // First fetch already-enabled
  const { data: enabled } = await supabase
    .from('companies')
    .select('id, name_encrypted')
    .eq('rentgoose_enabled', true)

  const ids = new Set<string>((enabled || []).map(c => c.id))

  // Then check legacy companies that might not be enabled yet
  const { data: notEnabled } = await supabase
    .from('companies')
    .select('id, name_encrypted')
    .or('rentgoose_enabled.is.null,rentgoose_enabled.eq.false')

  const toAutoEnable: string[] = []
  for (const c of (notEnabled || [])) {
    if (!c.name_encrypted) continue
    const name = decrypt(c.name_encrypted)
    if (matchesLegacyName(name)) {
      toAutoEnable.push(c.id)
      ids.add(c.id)
    }
  }

  if (toAutoEnable.length > 0) {
    await supabase.from('companies').update({ rentgoose_enabled: true }).in('id', toAutoEnable)
    console.log(`[RentGoose] Auto-enabled ${toAutoEnable.length} legacy companies`)
  }

  for (const id of ids) cache.set(id, { allowed: true, ts: Date.now() })
  return Array.from(ids)
}
