/**
 * Landlord Portal pricing configuration.
 *
 * PAYG: per-reference pricing, £2.49/agreement, up to 2 companies
 * Standard: £11.99/mo (promo until 15 May 2026), then £14.99/mo — up to 10 properties, 5 companies
 * Professional: £12.50/let — unlimited properties, 10 companies
 */

// Reference pricing
export const PAYG_REF_PRICE = 17.50
export const SUBSCRIBER_REF_PRICE = 13.00

// Subscription tiers
export const STANDARD_PROMO_PRICE = 11.99
export const STANDARD_PRICE = 14.99
export const STANDARD_MAX_PROPERTIES = 10

export const PROFESSIONAL_PRICE = 24.99
export const PROFESSIONAL_REF_PRICE = 12.50
export const PROFESSIONAL_MAX_PROPERTIES = Infinity // unlimited

// Agreement pricing
export const AGREEMENT_PRICE = 2.49

// Company limits per tier
export const PAYG_MAX_COMPANIES = 2
export const STANDARD_MAX_COMPANIES = 5
export const PROFESSIONAL_MAX_COMPANIES = 10

export type SubscriptionTier = 'payg' | 'standard' | 'professional'

export function getMaxCompanies(tier: SubscriptionTier): number {
  if (tier === 'professional') return PROFESSIONAL_MAX_COMPANIES
  if (tier === 'standard') return STANDARD_MAX_COMPANIES
  return PAYG_MAX_COMPANIES
}

// Promo period ends 15 May 2026
export const PROMO_CUTOFF = new Date('2026-05-15T00:00:00Z')

export function isPromoPeriod(): boolean {
  return new Date() < PROMO_CUTOFF
}

export function getStandardPrice(): number {
  return isPromoPeriod() ? STANDARD_PROMO_PRICE : STANDARD_PRICE
}

export function getReferencePrice(hasSubscription: boolean, tier?: SubscriptionTier): number {
  if (!hasSubscription) return PAYG_REF_PRICE
  if (tier === 'professional') return PROFESSIONAL_REF_PRICE
  return SUBSCRIBER_REF_PRICE
}

export function formatPrice(amount: number): string {
  return `£${amount.toFixed(2)}`
}

// ─── Legacy exports (used by Settings, Paywalls — will be updated) ───
export const STANDARD_SUBSCRIPTION_PRICE = STANDARD_PRICE
export const LAUNCH_REF_PRICE = PAYG_REF_PRICE
export const STANDARD_REF_PRICE = PAYG_REF_PRICE
export const LAUNCH_SUBSCRIPTION_PRICE = STANDARD_PROMO_PRICE
export const LAUNCH_CUTOFF = PROMO_CUTOFF

export function isLaunchPeriod(): boolean {
  return isPromoPeriod()
}

export function getSubscriptionPrice(): number {
  return getStandardPrice()
}

// Bulk discount: 50p off per pack tier
// PAYG min £10/ref, subscriber min £9.50/ref
export const BULK_DISCOUNT_PER_TIER = 0.50
export const BULK_MIN_PRICE_PAYG = 10.00
export const BULK_MIN_PRICE_SUB = 9.50

// Calculate discount based on pack size — 50p for every 3 refs, capped by min price
function calcBulkDiscount(packSize: number): number {
  if (packSize < 3) return 0
  // Every ~3 refs adds another 50p discount tier
  const tiers = Math.min(Math.floor(packSize / 3), 10) // cap at 10 tiers (£5 max discount)
  return tiers * BULK_DISCOUNT_PER_TIER
}

export function getBulkPricePerRef(packSize: number, hasSubscription: boolean): number {
  const basePrice = getReferencePrice(hasSubscription)
  const minPrice = hasSubscription ? BULK_MIN_PRICE_SUB : BULK_MIN_PRICE_PAYG
  const discount = calcBulkDiscount(packSize)
  return Math.max(minPrice, Math.round((basePrice - discount) * 100) / 100)
}

export function getBulkDiscount(packSize: number): number {
  return calcBulkDiscount(packSize)
}

export function getBulkPackTotal(packSize: number, hasSubscription: boolean): number {
  return Math.round(packSize * getBulkPricePerRef(packSize, hasSubscription) * 100) / 100
}

export function getBulkPacks(hasSubscription: boolean): { size: number; discount: number; pricePerRef: number; total: number; savings: number }[] {
  const basePrice = getReferencePrice(hasSubscription)
  return [3, 5, 10, 15, 20].map(size => {
    const pricePerRef = getBulkPricePerRef(size, hasSubscription)
    const total = getBulkPackTotal(size, hasSubscription)
    const savings = Math.round((basePrice * size - total) * 100) / 100
    const discount = getBulkDiscount(size)
    return { size, discount, pricePerRef, total, savings }
  })
}
