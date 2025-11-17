export type DateInput = string | number | Date | null | undefined

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
}

const DEFAULT_DATETIME_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
}

function normalizeDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatWithTimezone(
  input: DateInput,
  options: Intl.DateTimeFormatOptions,
  fallback: string
): string {
  const date = normalizeDate(input)
  if (!date) return fallback

  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    ...options
  }).format(date)
}

export function formatDate(
  input: DateInput,
  options?: Intl.DateTimeFormatOptions,
  fallback = 'N/A'
): string {
  return formatWithTimezone(input, options ?? DEFAULT_DATE_OPTIONS, fallback)
}

export function formatDateTime(
  input: DateInput,
  options?: Intl.DateTimeFormatOptions,
  fallback = 'N/A'
): string {
  return formatWithTimezone(input, options ?? DEFAULT_DATETIME_OPTIONS, fallback)
}

