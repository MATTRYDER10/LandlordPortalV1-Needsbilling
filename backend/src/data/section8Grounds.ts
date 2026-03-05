/**
 * Section 8 Grounds Database
 * Housing Act 1988, Schedule 2, as amended
 * Valid until 30 April 2026 (pre-Renters Rights Act)
 */

export interface S8Ground {
  id: string
  number: string
  type: 'mandatory' | 'discretionary'
  noticePeriodDays: number
  noticePeriodLabel: string
  title: string
  statutoryWording: string
  staffGuidance: string
}

export const S8_GROUNDS: S8Ground[] = [
  // ── MANDATORY ──────────────────────────────────────────────────
  {
    id: 'ground-1',
    number: 'Ground 1',
    type: 'mandatory',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Former owner-occupier or required as only/principal home',
    statutoryWording: `Not later than the beginning of the tenancy the landlord gave notice in writing to the tenant that possession might be recovered on this ground or the court is of the opinion that it is just and equitable to dispense with the requirement of notice and (in either case)—
(a) at some time before the beginning of the tenancy, the landlord who is seeking possession or, in the case of joint landlords seeking possession, at least one of them occupied the dwelling-house as his only or principal home; or
(b) the landlord who is seeking possession or, in the case of joint landlords seeking possession, at least one of them requires the dwelling-house as his or his spouse's only or principal home and neither the landlord (or, in the case of joint landlords, any one of them) nor any other person who, as landlord, derived title under the landlord who gave the notice mentioned above acquired the reversion on the tenancy for money or money's worth.`,
    staffGuidance: 'Landlord previously lived in the property as their main home, or now needs it back as their only/principal home. A Ground 1 notice MUST have been served at the start of the tenancy — check the original AST.',
  },
  {
    id: 'ground-2',
    number: 'Ground 2',
    type: 'mandatory',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Mortgage lender requires possession',
    statutoryWording: `The dwelling-house is subject to a mortgage granted before the beginning of the tenancy and—
(a) the mortgagee is entitled to exercise a power of sale conferred on him by the mortgage or by section 101 of the Law of Property Act 1925; and
(b) the mortgagee requires possession of the dwelling-house for the purpose of disposing of it with vacant possession in exercise of that power; and
(c) either notice was given as mentioned in Ground 1 above or the court is satisfied that it is just and equitable to dispense with the requirement of notice;`,
    staffGuidance: 'The mortgage lender (not the landlord) needs possession to sell. Typically initiated by the lender directly — rare in private lettings.',
  },
  {
    id: 'ground-3',
    number: 'Ground 3',
    type: 'mandatory',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Out-of-season holiday let',
    statutoryWording: `The tenancy is a fixed term tenancy for a term not exceeding 8 months and—
(a) not later than the beginning of the tenancy the landlord gave notice in writing to the tenant that possession might be recovered on this ground; and
(b) at some time within the period of 12 months ending with the beginning of the tenancy, the dwelling-house was occupied under a right to occupy it for a holiday.`,
    staffGuidance: 'Property was used as a holiday let within 12 months before this tenancy. Tenancy must be 8 months or less. Ground 3 notice must have been given at the start.',
  },
  {
    id: 'ground-4',
    number: 'Ground 4',
    type: 'mandatory',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Former student accommodation',
    statutoryWording: `The tenancy is a fixed term tenancy for a term not exceeding 12 months and—
(a) not later than the beginning of the tenancy the landlord gave notice in writing to the tenant that possession might be recovered on this ground; and
(b) at some time within the period of 12 months ending with the beginning of the tenancy, the dwelling-house was let on a tenancy falling within paragraph 8 of Schedule 1 to this Act.`,
    staffGuidance: 'Property was student accommodation within the previous 12 months. Tenancy must be 12 months or less. Ground 4 notice must have been given at the start.',
  },
  {
    id: 'ground-5',
    number: 'Ground 5',
    type: 'mandatory',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Minister of religion',
    statutoryWording: `The dwelling-house is held for the purpose of being available for occupation by a minister of religion as a residence from which to perform the duties of his office and—
(a) not later than the beginning of the tenancy the landlord gave notice in writing to the tenant that possession might be recovered on this ground; and
(b) the court is satisfied that the dwelling-house is required for occupation by a minister of religion as such a residence.`,
    staffGuidance: 'Property is needed for a minister of religion. Ground 5 notice must have been given at the start of the tenancy.',
  },
  {
    id: 'ground-6',
    number: 'Ground 6',
    type: 'mandatory',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Demolition, reconstruction or substantial works',
    statutoryWording: `The landlord who is seeking possession or, if that landlord is a registered social landlord or charitable housing trust, a superior landlord intends to demolish or reconstruct the whole or a substantial part of the dwelling-house or to carry out substantial works on the dwelling-house or any part thereof or any building of which it forms part and the following conditions are fulfilled—
(a) the intended work cannot reasonably be carried out without the tenant giving up possession of the dwelling-house because—
(i) the tenant is not willing to agree to such a variation of the terms of the tenancy as would give such access and other facilities as would permit the intended work to be carried out, or
(ii) the nature of the intended work is such that no such variation is practicable, or
(iii) the tenant is not willing to accept an assured tenancy of such part only of the dwelling-house (in this sub-paragraph referred to as "the reduced part") as would leave in the possession of his landlord so much of the dwelling-house as would be reasonable to enable the intended work to be carried out and, where appropriate, as would give such access and other facilities over the reduced part as would permit the intended work to be carried out, or
(iv) the nature of the intended work is such that such a tenancy is not practicable; and
(b) either the landlord seeking possession acquired his interest in the dwelling-house before the grant of the tenancy or that interest was in existence at the time of that grant and neither that landlord (or, in the case of joint landlords, any of them) nor any other person who, as landlord, derived title under the landlord who granted the tenancy acquired the reversion on the tenancy for money or money's worth.`,
    staffGuidance: 'Landlord intends to demolish or substantially reconstruct/renovate and cannot do so with the tenant in occupation.',
  },
  {
    id: 'ground-7',
    number: 'Ground 7',
    type: 'mandatory',
    noticePeriodDays: 56,
    noticePeriodLabel: '2 months',
    title: 'Death of periodic tenant — devolved tenancy',
    statutoryWording: `The tenancy is a periodic tenancy (including a statutory periodic tenancy) which has devolved under the will or intestacy of the former tenant and the proceedings for the recovery of possession are begun not later than twelve months after the death of the former tenant or, if the court so directs, after the date on which, in the opinion of the court, the landlord or, in the case of joint landlords, any one of them became aware of the former tenant's death.
For the purposes of this ground, the acceptance by the landlord of rent from a new tenant after the death of the former tenant shall not be regarded as creating a new tenancy, unless the landlord agrees in writing to a change (as compared with the tenancy before the death) in the amount of the rent, the period of the tenancy, the premises which are let or any other term of the tenancy.`,
    staffGuidance: 'Tenant has died and the tenancy passed by will or intestacy. Proceedings must start within 12 months of death. Requires 2 months\' notice.',
  },
  {
    id: 'ground-7a',
    number: 'Ground 7A',
    type: 'mandatory',
    noticePeriodDays: 28,
    noticePeriodLabel: '1 month (minimum — verify for specific offence)',
    title: 'Conviction for serious offence',
    statutoryWording: `Each of the following conditions is met—
(a) the tenant or a person residing in or visiting the dwelling-house has been convicted of a serious offence, and
(b) the serious offence—
(i) was committed (wholly or partly) in, or in the locality of, the dwelling-house,
(ii) was committed elsewhere against a person with a right (of whatever description) to reside in, or occupy housing accommodation in the locality of, the dwelling-house, or
(iii) was committed elsewhere against the landlord of the dwelling-house, or a person employed (whether or not by the landlord) in connection with the exercise of the landlord's housing management functions, and was committed in connection with or as a result of those functions.
"Serious offence" means an offence falling within Part 1 of Schedule 2A to this Act.`,
    staffGuidance: 'Tenant or visitor has been convicted of a serious offence listed in Schedule 2A (violence, drug supply, sexual offences, weapons). Notice period varies by offence — 28 days used as minimum. Verify with a solicitor before serving.',
  },
  {
    id: 'ground-8',
    number: 'Ground 8',
    type: 'mandatory',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Serious rent arrears — mandatory',
    statutoryWording: `Both at the date of the service of the notice under section 8 of this Act relating to the proceedings for possession and at the date of the hearing—
(a) if rent is payable weekly or fortnightly, at least eight weeks' rent is unpaid;
(b) if rent is payable monthly, at least two months' rent is unpaid;
(c) if rent is payable quarterly, at least one quarter's rent is more than three months in arrears; and
(d) if rent is payable yearly, at least three months' rent is more than three months in arrears;
and for the purpose of this ground "rent" means rent lawfully due from the tenant.`,
    staffGuidance: 'At least 2 months\' rent unpaid (monthly tenancy) or 8 weeks (weekly) — must be true BOTH at notice date AND at hearing. If the tenant pays down below threshold before the hearing, Ground 8 fails. Always serve with Grounds 10 and 11 as a fallback.',
  },

  // ── DISCRETIONARY ──────────────────────────────────────────────
  {
    id: 'ground-9',
    number: 'Ground 9',
    type: 'discretionary',
    noticePeriodDays: 56,
    noticePeriodLabel: '2 months',
    title: 'Suitable alternative accommodation available',
    statutoryWording: `Suitable alternative accommodation is available for the tenant or will be available for him when the order for possession takes effect.`,
    staffGuidance: 'Landlord can offer the tenant suitable alternative accommodation. Rarely used by private landlords. Requires 2 months\' notice.',
  },
  {
    id: 'ground-10',
    number: 'Ground 10',
    type: 'discretionary',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Some rent in arrears',
    statutoryWording: `Some rent lawfully due from the tenant—
(a) is unpaid on the date on which the proceedings for possession are begun; and
(b) except where subsection (1)(b) of section 8 of this Act applies, was in arrears at the date of the service of the notice under that section relating to those proceedings.`,
    staffGuidance: 'Some rent unpaid at notice date AND at date proceedings begin. Discretionary — court may grant possession. Serve alongside Ground 8 as a fallback in case arrears drop below the G8 threshold before the hearing.',
  },
  {
    id: 'ground-11',
    number: 'Ground 11',
    type: 'discretionary',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Persistent delay in paying rent',
    statutoryWording: `Whether or not any rent is in arrears on the date on which proceedings for possession are begun, the tenant has persistently delayed paying rent which has become lawfully due.`,
    staffGuidance: 'Pattern of consistently late or partial payments, even if currently up to date. Discretionary. Useful alongside G8 and G10 to demonstrate habitual non-compliance.',
  },
  {
    id: 'ground-12',
    number: 'Ground 12',
    type: 'discretionary',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Breach of tenancy obligation (non-rent)',
    statutoryWording: `Any obligation of the tenancy (other than one related to the payment of rent) has been broken or not performed.`,
    staffGuidance: 'Breach of any tenancy term other than rent — e.g. subletting without consent, keeping unauthorised pets, running a business from the property.',
  },
  {
    id: 'ground-13',
    number: 'Ground 13',
    type: 'discretionary',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Deterioration of the dwelling',
    statutoryWording: `The condition of the dwelling-house or any of the common parts has deteriorated owing to acts of waste by, or the neglect or default of, the tenant or any other person residing in the dwelling-house and, in the case of an act of waste by, or the neglect or default of, a person lodging with the tenant or a sub-tenant of his, the tenant has not taken such steps as he ought reasonably to have taken for the removal of the lodger or sub-tenant.`,
    staffGuidance: 'Property condition has deteriorated due to tenant\'s waste, neglect or default. Includes damage by lodgers/sub-tenants where tenant failed to act.',
  },
  {
    id: 'ground-14',
    number: 'Ground 14',
    type: 'discretionary',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Nuisance, annoyance or illegal/immoral use',
    statutoryWording: `The tenant or a person residing in or visiting the dwelling-house—
(a) has been guilty of conduct causing or likely to cause a nuisance or annoyance to a person residing, visiting or otherwise engaging in a lawful activity in the locality, or
(b) has been convicted of—
(i) using the dwelling-house or allowing it to be used for immoral or illegal purposes, or
(ii) an indictable offence committed in, or in the locality of, the dwelling-house.`,
    staffGuidance: 'Anti-social behaviour, nuisance or annoyance to neighbours, or conviction for illegal/immoral use. Very commonly used ground.',
  },
  {
    id: 'ground-14a',
    number: 'Ground 14A',
    type: 'discretionary',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Domestic violence — partner has left',
    statutoryWording: `The dwelling-house was occupied (whether alone or with others) by a married couple, a couple who are civil partners of each other, a couple living together as husband and wife or a couple living together as if they were civil partners and—
(a) one or both of the partners is a tenant of the dwelling-house,
(b) the landlord who is seeking possession is a registered social landlord or charitable housing trust,
(c) one partner has left the dwelling-house because of violence or threats of violence by the other towards—
(i) that partner, or
(ii) a member of the family of that partner who was residing with that partner immediately before the partner left, and
(d) the court is satisfied that the partner who has left is unlikely to return.`,
    staffGuidance: 'Only available to registered social landlords and charitable housing trusts — NOT applicable to private landlords. Included for completeness.',
  },
  {
    id: 'ground-15',
    number: 'Ground 15',
    type: 'discretionary',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'Deterioration of furniture',
    statutoryWording: `The condition of any furniture provided for use under the tenancy has, in the opinion of the court, deteriorated owing to ill-treatment by the tenant or any other person residing in the dwelling-house and, in the case of ill-treatment by a person lodging with the tenant or by a sub-tenant of his, the tenant has not taken such steps as he ought reasonably to have taken for the removal of the lodger or sub-tenant.`,
    staffGuidance: 'Landlord-provided furniture damaged or deteriorated by ill-treatment from the tenant or someone they allowed to reside.',
  },
  {
    id: 'ground-16',
    number: 'Ground 16',
    type: 'discretionary',
    noticePeriodDays: 56,
    noticePeriodLabel: '2 months',
    title: 'Employment-linked tenancy — employment ended',
    statutoryWording: `The dwelling-house was let to the tenant in consequence of his employment by the landlord seeking possession or a previous landlord under the tenancy and the tenant has ceased to be in that employment.`,
    staffGuidance: 'Tenancy was granted as part of the tenant\'s employment and that employment has now ended. 2 months\' notice required.',
  },
  {
    id: 'ground-17',
    number: 'Ground 17',
    type: 'discretionary',
    noticePeriodDays: 14,
    noticePeriodLabel: '2 weeks',
    title: 'False statement to obtain tenancy',
    statutoryWording: `The tenant is the person, or one of the persons, to whom the tenancy was granted and the landlord was induced to grant the tenancy by a false statement made knowingly or recklessly by—
(a) the tenant, or
(b) a person acting at the tenant's instigation.`,
    staffGuidance: 'Tenant (or someone acting for them) made a false statement to obtain the tenancy — e.g. false income, fabricated references, misrepresentation of previous tenancy history.',
  },
]

/**
 * Calculate earliest court date based on LONGEST notice period
 */
export function calculateEarliestCourtDate(
  groundIds: string[],
  serviceDate: Date
): {
  date: Date
  longestGround: S8Ground
  periodDays: number
  explanation: string
} {
  const selected = S8_GROUNDS.filter(g => groundIds.includes(g.id))
  if (selected.length === 0) throw new Error('No grounds selected')

  const longestGround = selected.reduce((prev, curr) =>
    curr.noticePeriodDays > prev.noticePeriodDays ? curr : prev
  )

  const date = new Date(serviceDate)
  date.setDate(date.getDate() + longestGround.noticePeriodDays)

  const explanation =
    `Earliest court date calculated using the ${longestGround.noticePeriodLabel} notice period ` +
    `required for ${longestGround.number} — the longest of your selected grounds. ` +
    `This ensures all grounds remain valid at the hearing date (s.8(4A) Housing Act 1988).`

  return { date, longestGround, periodDays: longestGround.noticePeriodDays, explanation }
}

export function formatDateUK(date: Date): string {
  const day = date.getDate()
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' :
    day % 10 === 2 && day !== 12 ? 'nd' :
    day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return `${day}${suffix} ${date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
}

/**
 * Check if Ground 8 threshold is met based on rent frequency
 */
export function checkGround8Threshold(
  rentFrequency: 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly',
  rentAmount: number,
  totalArrears: number
): { met: boolean; threshold: number; explanation: string } {
  let threshold: number
  let thresholdDesc: string

  switch (rentFrequency) {
    case 'weekly':
    case 'fortnightly':
      threshold = rentAmount * 8
      thresholdDesc = `8 weeks' rent (£${threshold.toFixed(2)})`
      break
    case 'monthly':
      threshold = rentAmount * 2
      thresholdDesc = `2 months' rent (£${threshold.toFixed(2)})`
      break
    case 'quarterly':
      threshold = rentAmount
      thresholdDesc = `1 quarter's rent more than 3 months in arrears (£${threshold.toFixed(2)})`
      break
    case 'yearly':
      threshold = (rentAmount / 12) * 3
      thresholdDesc = `3 months' rent more than 3 months in arrears (£${threshold.toFixed(2)})`
      break
    default:
      threshold = rentAmount * 2
      thresholdDesc = `2 months' rent (£${threshold.toFixed(2)})`
  }

  const met = totalArrears >= threshold
  const explanation = `Ground 8 requires at least ${thresholdDesc} unpaid. Current arrears: £${totalArrears.toFixed(2)}. ${met ? '✓ Threshold met' : '✗ Threshold NOT met'}`

  return { met, threshold, explanation }
}

/**
 * Get grounds by ID
 */
export function getGroundById(id: string): S8Ground | undefined {
  return S8_GROUNDS.find(g => g.id === id)
}

/**
 * Get mandatory grounds
 */
export function getMandatoryGrounds(): S8Ground[] {
  return S8_GROUNDS.filter(g => g.type === 'mandatory')
}

/**
 * Get discretionary grounds
 */
export function getDiscretionaryGrounds(): S8Ground[] {
  return S8_GROUNDS.filter(g => g.type === 'discretionary')
}
