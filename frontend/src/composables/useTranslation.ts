/**
 * Translation composable - i18n-ready wrapper
 *
 * This provides a simple translation function that can be replaced with
 * a full i18n implementation (vue-i18n) when needed.
 *
 * Currently returns the key as-is, but wrapping all UI strings in t()
 * makes future localization easy.
 */

import { ref, computed } from 'vue'

// Default translations for the Help Centre
// These can be expanded or replaced with a full i18n system
const translations: Record<string, Record<string, string>> = {
  en: {
    // Help Centre
    'help.title': 'Help Centre',
    'help.subtitle': 'Find answers, guides, and support',
    'help.search.placeholder': 'Search help articles...',
    'help.search.noResults': 'No results found',
    'help.search.tryDifferent': 'Try different keywords or browse categories below',
    'help.search.results': 'Search Results',
    'help.search.resultsCount': '{count} results for "{query}"',
    'help.categories.title': 'Browse by Category',
    'help.categories.articles': '{count} articles',
    'help.article.lastUpdated': 'Last updated',
    'help.article.readTime': '{time} read',
    'help.article.relatedArticles': 'Related Articles',
    'help.article.feedback.question': 'Was this article helpful?',
    'help.article.feedback.yes': 'Yes',
    'help.article.feedback.no': 'No',
    'help.article.feedback.thanks': 'Thanks for your feedback!',
    'help.faq.title': 'Frequently Asked Questions',
    'help.faq.subtitle': 'Quick answers to common questions',
    'help.breadcrumb.home': 'Help Centre',
    'help.support.title': 'Still need help?',
    'help.support.description': "Can't find what you're looking for? Our support team is here to help.",
    'help.support.email': 'Email Support',
    'help.callout.tip': 'Tip',
    'help.callout.warning': 'Warning',
    'help.callout.info': 'Info',
    'help.callout.important': 'Important',
    'help.viewAll': 'View All',
    'help.backToCategory': 'Back to {category}',
  }
}

const currentLocale = ref('en')

export function useTranslation() {
  /**
   * Translate a key with optional interpolation
   * @param key - The translation key (e.g., 'help.title')
   * @param params - Optional parameters for interpolation
   * @returns The translated string or the key if not found
   */
  const t = (key: string, params?: Record<string, string | number>): string => {
    const locale = currentLocale.value
    const localeTranslations = translations[locale] ?? translations.en
    let text = localeTranslations?.[key] ?? key

    // Simple interpolation: replace {param} with value
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value))
      })
    }

    return text
  }

  const setLocale = (locale: string) => {
    currentLocale.value = locale
  }

  const locale = computed(() => currentLocale.value)

  return {
    t,
    setLocale,
    locale
  }
}

// Export a simple t function for non-composable usage
export const t = (key: string, params?: Record<string, string | number>): string => {
  const { t: translate } = useTranslation()
  return translate(key, params)
}
