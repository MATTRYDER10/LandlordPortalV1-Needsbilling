/**
 * Landlord Portal pricing configuration.
 *
 * PAYG: per-reference pricing (no subscription)
 * Standard: £11.99/mo (promo until 15 May 2026), then £14.99/mo — up to 10 properties
 * Professional: £24.99/mo — up to 25 properties (no promo)
 */

// Reference pricing
export const PAYG_REF_PRICE = 17.50
export const SUBSCRIBER_REF_PRICE = 13.00

// Subscription tiers
export const STANDARD_PROMO_PRICE = 11.99
export const STANDARD_PRICE = 14.99
export const STANDARD_MAX_PROPERTIES = 10

export const PROFESSIONAL_PRICE = 24.99
export const PROFESSIONAL_MAX_PROPERTIES = 25

// Agreement pricing
export const AGREEMENT_PRICE = 2.49

// Promo period ends 15 May 2026
export const PROMO_CUTOFF = new Date('2026-05-15T00:00:00Z')

export function isPromoPeriod(): boolean {
  return new Date() < PROMO_CUTOFF
}

export function getStandardPrice(): number {
  return isPromoPeriod() ? STANDARD_PROMO_PRICE : STANDARD_PRICE
}

export function getReferencePrice(hasSubscription: boolean): number {
  return hasSubscription ? SUBSCRIBER_REF_PRICE : PAYG_REF_PRICE
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

export function getBulkDiscount(_packSize: number): number {
  return 0
}

export function getBulkPricePerRef(_packSize: number, hasSubscription: boolean): number {
  return getReferencePrice(hasSubscription)
}

export function getBulkPackTotal(packSize: number, hasSubscription: boolean): number {
  return packSize * getReferencePrice(hasSubscription)
}

export function getBulkPacks(hasSubscription: boolean): { size: number; discount: number; pricePerRef: number; total: number; savings: number }[] {
  const price = getReferencePrice(hasSubscription)
  return [3, 5, 10, 15, 20].map(size => ({
    size, discount: 0, pricePerRef: price, total: size * price, savings: 0
  }))
}
