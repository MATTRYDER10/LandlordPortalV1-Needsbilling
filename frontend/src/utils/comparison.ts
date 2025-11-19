export type ComparisonStatus = 'match' | 'mismatch' | 'minor' | 'n/a'

export interface ComparisonRow {
    field: string
    label: string
    tenantValue: any
    referenceValue: any
    isNotApplicable?: boolean
    customComparison?: (tenant: any, reference: any) => ComparisonStatus
}

const isoDateString = (input: string): string => {
    if (!input) return ''
    const [datePart] = input.split('T')
    return datePart || ''
}

export const formatComparisonValue = (value: any): string => {
    if (value === null || value === undefined) return ''
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toString() : ''
    }
    if (value instanceof Date) {
        return isoDateString(value.toISOString())
    }
    if (typeof value === 'string') {
        return value
    }
    return String(value)
}

const normalizeString = (value: any): string => {
    if (value === null || value === undefined) return ''
    return String(value).toLowerCase().trim().replace(/\s+/g, ' ')
}

const calculateSimilarity = (str1: string, str2: string): number => {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) return 1

    const editDistance = levenshtein(longer, shorter)
    return (longer.length - editDistance) / longer.length
}

const levenshtein = (str1: string, str2: string): number => {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i]
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0]![j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i]![j] = matrix[i - 1]![j - 1]!
            } else {
                matrix[i]![j] = Math.min(
                    matrix[i - 1]![j - 1]! + 1,
                    matrix[i]![j - 1]! + 1,
                    matrix[i - 1]![j]! + 1
                )
            }
        }
    }

    return matrix[str2.length]![str1.length]!
}

export const computeComparisonStatus = (row: ComparisonRow): ComparisonStatus => {
    if (row.customComparison) {
        return row.customComparison(row.tenantValue, row.referenceValue)
    }

    if (
        row.isNotApplicable ||
        row.tenantValue === null || row.tenantValue === undefined || row.tenantValue === '' ||
        row.referenceValue === null || row.referenceValue === undefined || row.referenceValue === ''
    ) {
        return 'n/a'
    }

    if (row.tenantValue instanceof Date || row.referenceValue instanceof Date) {
        const tenantDate = isoDateString(new Date(row.tenantValue).toISOString())
        const referenceDate = isoDateString(new Date(row.referenceValue).toISOString())
        return tenantDate === referenceDate ? 'match' : 'mismatch'
    }

    if (typeof row.tenantValue === 'boolean' && typeof row.referenceValue === 'boolean') {
        return row.tenantValue === row.referenceValue ? 'match' : 'mismatch'
    }

    if (typeof row.tenantValue === 'number' && typeof row.referenceValue === 'number') {
        const diff = Math.abs(row.tenantValue - row.referenceValue)
        if (diff < 0.01) return 'match'
        if (Math.min(row.tenantValue, row.referenceValue) === 0) {
            return diff === 0 ? 'match' : 'mismatch'
        }
        if (diff <= Math.min(row.tenantValue, row.referenceValue) * 0.05) return 'minor'
        return 'mismatch'
    }

    const tenantNormalized = normalizeString(row.tenantValue)
    const referenceNormalized = normalizeString(row.referenceValue)

    if (!tenantNormalized && !referenceNormalized) return 'n/a'
    if (tenantNormalized === referenceNormalized) return 'match'
    if (tenantNormalized.includes(referenceNormalized) || referenceNormalized.includes(tenantNormalized)) return 'minor'
    if (calculateSimilarity(tenantNormalized, referenceNormalized) > 0.8) return 'minor'
    return 'mismatch'
}

export const isMismatchStatus = (status: ComparisonStatus) => status === 'mismatch' || status === 'minor'

