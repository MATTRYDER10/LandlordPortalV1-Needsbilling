// Centralized brand colors - update here to change everywhere
export const BRAND_COLORS = {
  primary: '#fe7a0f',
  dark: '#03162b',
  secondary: '#F8F5F0',
  background: '#FDFDFD'
} as const

// Default branding colors (used when company has no custom branding)
export const DEFAULT_BRANDING = {
  primaryColor: BRAND_COLORS.primary,
  buttonColor: BRAND_COLORS.primary
}
