/**
 * Help Content Composable
 *
 * Manages loading, searching, and accessing help content
 * including guides, FAQs, and categories.
 */

import { ref, computed } from 'vue'
import Fuse from 'fuse.js'

// Import content
import categoriesData from '@/help-content/categories.json'
import faqsData from '@/help-content/faqs/faqs.json'

// Import guides dynamically
const guideModules = import.meta.glob('@/help-content/guides/*.json', { eager: true })

// Types
export interface Category {
  id: string
  slug: string
  title: string
  description: string
  icon: string
  color: string
  sortOrder: number
}

export interface GuideStep {
  title: string
  content: string
  image: string | null
}

export interface GuideSection {
  type: 'text' | 'steps' | 'callout'
  title?: string
  content?: string
  style?: 'tip' | 'warning' | 'info' | 'important'
  steps?: GuideStep[]
}

export interface Guide {
  id: string
  slug: string
  title: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
  sortOrder: number
  estimatedReadTime: string
  content: {
    intro: string
    sections: GuideSection[]
    relatedArticles: string[]
  }
}

export interface FAQ {
  id: string
  category: string
  question: string
  answer: string
  tags: string[]
  relatedGuide?: string
  sortOrder: number
}

export interface SearchResult {
  id: string
  type: 'guide' | 'faq'
  title: string
  preview: string
  category: string
  slug?: string
  score?: number
}

export interface ArticleFeedback {
  articleId: string
  helpful: boolean
  timestamp: Date
}

// State
const categories = ref<Category[]>([])
const guides = ref<Guide[]>([])
const faqs = ref<FAQ[]>([])
const isLoaded = ref(false)
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const isSearching = ref(false)
const articleFeedback = ref<Map<string, boolean>>(new Map())

// Fuse.js instances
let guideFuse: Fuse<Guide> | null = null
let faqFuse: Fuse<FAQ> | null = null

// Load feedback from localStorage
const loadFeedback = () => {
  try {
    const stored = localStorage.getItem('help-article-feedback')
    if (stored) {
      const parsed = JSON.parse(stored)
      articleFeedback.value = new Map(Object.entries(parsed))
    }
  } catch (e) {
    console.error('Failed to load article feedback:', e)
  }
}

// Save feedback to localStorage
const saveFeedback = () => {
  try {
    const obj = Object.fromEntries(articleFeedback.value)
    localStorage.setItem('help-article-feedback', JSON.stringify(obj))
  } catch (e) {
    console.error('Failed to save article feedback:', e)
  }
}

// Initialize content
const initializeContent = () => {
  if (isLoaded.value) return

  // Load categories
  categories.value = categoriesData.categories.sort((a, b) => a.sortOrder - b.sortOrder)

  // Load guides from dynamically imported modules
  const loadedGuides: Guide[] = []
  for (const path in guideModules) {
    const module = guideModules[path] as { default?: Guide } | Guide
    const guide = ('default' in module ? module.default : module) as Guide | undefined
    if (guide && 'id' in guide && guide.id) {
      loadedGuides.push(guide as Guide)
    }
  }
  guides.value = loadedGuides.sort((a, b) => a.sortOrder - b.sortOrder)

  // Load FAQs
  faqs.value = faqsData.faqs.sort((a, b) => a.sortOrder - b.sortOrder)

  // Initialize Fuse.js for search
  guideFuse = new Fuse(guides.value, {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'content.intro', weight: 1 },
      { name: 'tags', weight: 1.5 },
      { name: 'content.sections.content', weight: 0.5 },
      { name: 'content.sections.steps.title', weight: 0.5 },
      { name: 'content.sections.steps.content', weight: 0.3 }
    ],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true
  })

  faqFuse = new Fuse(faqs.value, {
    keys: [
      { name: 'question', weight: 2 },
      { name: 'answer', weight: 1 },
      { name: 'tags', weight: 1.5 }
    ],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true
  })

  loadFeedback()
  isLoaded.value = true
}

export function useHelpContent() {
  // Initialize on first use
  initializeContent()

  // Search function with debouncing handled by the component
  const search = (query: string): SearchResult[] => {
    if (!query.trim()) {
      return []
    }

    const results: SearchResult[] = []

    // Search guides
    if (guideFuse) {
      const guideResults = guideFuse.search(query)
      guideResults.forEach(result => {
        results.push({
          id: result.item.id,
          type: 'guide',
          title: result.item.title,
          preview: result.item.content.intro.substring(0, 150) + '...',
          category: result.item.category,
          slug: result.item.slug,
          score: result.score
        })
      })
    }

    // Search FAQs
    if (faqFuse) {
      const faqResults = faqFuse.search(query)
      faqResults.forEach(result => {
        results.push({
          id: result.item.id,
          type: 'faq',
          title: result.item.question,
          preview: result.item.answer.substring(0, 150) + '...',
          category: result.item.category,
          score: result.score
        })
      })
    }

    // Sort by score (lower is better in Fuse.js)
    return results.sort((a, b) => (a.score || 0) - (b.score || 0))
  }

  // Get guides by category
  const getGuidesByCategory = (categoryId: string): Guide[] => {
    return guides.value.filter(g => g.category === categoryId)
  }

  // Get FAQs by category
  const getFaqsByCategory = (categoryId: string): FAQ[] => {
    return faqs.value.filter(f => f.category === categoryId)
  }

  // Get guide by slug
  const getGuideBySlug = (slug: string): Guide | undefined => {
    return guides.value.find(g => g.slug === slug)
  }

  // Get guide by ID
  const getGuideById = (id: string): Guide | undefined => {
    return guides.value.find(g => g.id === id)
  }

  // Get category by ID
  const getCategoryById = (id: string): Category | undefined => {
    return categories.value.find(c => c.id === id)
  }

  // Get category by slug
  const getCategoryBySlug = (slug: string): Category | undefined => {
    return categories.value.find(c => c.slug === slug)
  }

  // Get article count per category
  const getArticleCount = (categoryId: string): number => {
    const guideCount = guides.value.filter(g => g.category === categoryId).length
    const faqCount = faqs.value.filter(f => f.category === categoryId).length
    return guideCount + faqCount
  }

  // Get related articles
  const getRelatedArticles = (articleIds: string[]): Guide[] => {
    return guides.value.filter(g => articleIds.includes(g.id) || articleIds.includes(g.slug))
  }

  // Submit feedback
  const submitFeedback = (articleId: string, helpful: boolean) => {
    articleFeedback.value.set(articleId, helpful)
    saveFeedback()
  }

  // Get feedback for article
  const getFeedback = (articleId: string): boolean | undefined => {
    return articleFeedback.value.get(articleId)
  }

  // Check if feedback was given
  const hasFeedback = (articleId: string): boolean => {
    return articleFeedback.value.has(articleId)
  }

  return {
    // State
    categories: computed(() => categories.value),
    guides: computed(() => guides.value),
    faqs: computed(() => faqs.value),
    isLoaded: computed(() => isLoaded.value),

    // Search
    search,
    searchQuery,
    searchResults,
    isSearching,

    // Getters
    getGuidesByCategory,
    getFaqsByCategory,
    getGuideBySlug,
    getGuideById,
    getCategoryById,
    getCategoryBySlug,
    getArticleCount,
    getRelatedArticles,

    // Feedback
    submitFeedback,
    getFeedback,
    hasFeedback
  }
}
