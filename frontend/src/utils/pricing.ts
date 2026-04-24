/**
 * Landlord Portal pricing configuration.
 *
 * Pay-as-you-go: per-reference pricing
 * Full Self-Management: monthly subscription unlocking tenancies tab + ref discount
 * Bulk packs: 5% off per reference in pack, capped at 35%
 */

// Launch pricing (before cutoff date)
export const LAUNCH_REF_PRICE = 14.00
export const STANDARD_REF_PRICE = 17.50
export const SUBSCRIBER_REF_PRICE = 13.00

export const LAUNCH_SUBSCRIPTION_PRICE = 11.99
export const STANDARD_SUBSCRIPTION_PRICE = 14.99

// Agreement pricing
export const AGREEMENT_PRICE = 2.49

// Bulk discount: 5% per reference, max 35%
export const BULK_DISCOUNT_PER_REF = 0.05
export const BULK_DISCOUNT_MAX = 0.35

// Launch period ends 30 April 2026
export const LAUNCH_CUTOFF = new Date('2026-05-01T00:00:00Z')

export function isLaunchPeriod(): boolean {
  return new Date() < LAUNCH_CUTOFF
}

export function getReferencePrice(hasSubscription: boolean): number {
  if (hasSubscription) return SUBSCRIBER_REF_PRICE
  return isLaunchPeriod() ? LAUNCH_REF_PRICE : STANDARD_REF_PRICE
}

export function getSubscriptionPrice(): number {
  return isLaunchPeriod() ? LAUNCH_SUBSCRIPTION_PRICE : STANDARD_SUBSCRIPTION_PRICE
}

/**
 * Calculate bulk discount for a pack of N references.
 * 5% off per reference in the pack, capped at 35%.
 * Pack of 1 = no discount (that's a single purchase, not bulk).
 */
export function getBulkDiscount(packSize: number): number {
  if (packSize <= 1) return 0
  return Math.min(packSize * BULK_DISCOUNT_PER_REF, BULK_DISCOUNT_MAX)
}

/**
 * Get the price per reference for a given bulk pack size.
 */
export function getBulkPricePerRef(packSize: number, hasSubscription: boolean): number {
  const basePrice = getReferencePrice(hasSubscription)
  const discount = getBulkDiscount(packSize)
  return Math.round((basePrice * (1 - discount)) * 100) / 100
}

/**
 * Get the total cost for a bulk pack.
 */
export function getBulkPackTotal(packSize: number, hasSubscription: boolean): number {
  return Math.round(packSize * getBulkPricePerRef(packSize, hasSubscription) * 100) / 100
}

/**
 * Predefined bulk pack options for the billing UI.
 */
export function getBulkPacks(hasSubscription: boolean): { size: number; discount: number; pricePerRef: number; total: number; savings: number }[] {
  const basePrice = getReferencePrice(hasSubscription)
  return [3, 5, 10, 15, 20].map(size => {
    const discount = getBulkDiscount(size)
    const pricePerRef = getBulkPricePerRef(size, hasSubscription)
    const total = getBulkPackTotal(size, hasSubscription)
    const savings = Math.round((basePrice * size - total) * 100) / 100
    return { size, discount, pricePerRef, total, savings }
  })
}

export function formatPrice(amount: number): string {
  return `£${amount.toFixed(2)}`
}
