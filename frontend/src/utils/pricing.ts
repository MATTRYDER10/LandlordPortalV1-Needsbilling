/**
 * Landlord Portal pricing configuration.
 *
 * Promo period ends 16 May 2026. All prices match Stripe products.
 *
 * PAYG refs: £14/ref (promo) → £17.50/ref
 * Standard subscriber refs: £13/ref (always)
 * Pro subscriber refs: £12.50/ref (always)
 * Standard sub: £11.99/mo (promo) → £14.99/mo
 * Pro sub: £19.99/mo (promo) → £24.99/mo
 * Standalone agreement: £2.49
 */

// ─── Promo Configuration ───
export const PROMO_CUTOFF = new Date('2026-05-16T00:00:00Z')

export function isPromoPeriod(): boolean {
  return new Date() < PROMO_CUTOFF
}

// ─── Reference Pricing ───
// PAYG changes with promo
export const PAYG_REF_PRICE_LAUNCH = 14.00
export const PAYG_REF_PRICE = 17.50
// Subscriber rates are FIXED (not derived from PAYG)
export const STANDARD_REF_PRICE_FIXED = 13.00
export const PROFESSIONAL_REF_PRICE = 12.50

export function getPaygRefPrice(): number {
  return isPromoPeriod() ? PAYG_REF_PRICE_LAUNCH : PAYG_REF_PRICE
}

export function getReferencePrice(hasSubscription: boolean, tier?: SubscriptionTier): number {
  if (!hasSubscription) return getPaygRefPrice()
  if (tier === 'professional') return PROFESSIONAL_REF_PRICE
  return STANDARD_REF_PRICE_FIXED
}

// ─── Subscription Pricing ───
export const STANDARD_PROMO_PRICE = 11.99
export const STANDARD_PRICE = 14.99
export const STANDARD_MAX_PROPERTIES = 10

export const PROFESSIONAL_PROMO_PRICE = 19.99
export const PROFESSIONAL_PRICE = 24.99
export const PROFESSIONAL_MAX_PROPERTIES = Infinity

export function getStandardPrice(): number {
  return isPromoPeriod() ? STANDARD_PROMO_PRICE : STANDARD_PRICE
}

export function getProfessionalPrice(): number {
  return isPromoPeriod() ? PROFESSIONAL_PROMO_PRICE : PROFESSIONAL_PRICE
}

// ─── Agreement Pricing ───
export const AGREEMENT_PRICE = 2.49

// ─── Company Limits ───
export const PAYG_MAX_COMPANIES = 2
export const STANDARD_MAX_COMPANIES = 5
export const PROFESSIONAL_MAX_COMPANIES = 10

export type SubscriptionTier = 'payg' | 'standard' | 'professional'

export function getMaxCompanies(tier: SubscriptionTier): number {
  if (tier === 'professional') return PROFESSIONAL_MAX_COMPANIES
  if (tier === 'standard') return STANDARD_MAX_COMPANIES
  return PAYG_MAX_COMPANIES
}

// ─── Formatting ───
export function formatPrice(amount: number): string {
  return `£${amount.toFixed(2)}`
}

// ─── Legacy Exports ───
export const SUBSCRIBER_REF_PRICE = STANDARD_REF_PRICE_FIXED
export const STANDARD_SUBSCRIPTION_PRICE = STANDARD_PRICE
export const LAUNCH_REF_PRICE = PAYG_REF_PRICE_LAUNCH
export const STANDARD_REF_PRICE = PAYG_REF_PRICE
export const LAUNCH_SUBSCRIPTION_PRICE = STANDARD_PROMO_PRICE
export const LAUNCH_CUTOFF = PROMO_CUTOFF

export function isLaunchPeriod(): boolean {
  return isPromoPeriod()
}

export function getSubscriptionPrice(): number {
  return getStandardPrice()
}

// ─── Bulk Discount ───
export const BULK_DISCOUNT_PER_TIER = 0.50
export const BULK_MIN_PRICE_PAYG = 10.00
export const BULK_MIN_PRICE_SUB = 9.50

function calcBulkDiscount(packSize: number): number {
  if (packSize < 3) return 0
  const tiers = Math.min(Math.floor(packSize / 3), 10)
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
