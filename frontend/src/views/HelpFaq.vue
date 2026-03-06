<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <!-- Top Bar -->
      <div class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">
        <HelpBreadcrumb :crumbs="[{ label: t('help.faq.title') }]" />
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto px-6 py-8">
          <!-- Header -->
          <div class="text-center mb-8">
            <div class="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
              <HelpCircle class="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {{ t('help.faq.title') }}
            </h1>
            <p class="text-gray-500 dark:text-slate-400">
              {{ t('help.faq.subtitle') }}
            </p>
          </div>

          <!-- Search -->
          <div class="max-w-md mx-auto mb-8">
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search FAQs..."
                class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>

          <!-- Category Tabs -->
          <div class="flex flex-wrap gap-2 mb-6 justify-center">
            <button
              @click="selectedCategory = null"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedCategory === null
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-primary'
              ]"
            >
              All
            </button>
            <button
              v-for="category in categoriesWithFaqs"
              :key="category.id"
              @click="selectedCategory = category.id"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedCategory === category.id
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-primary'
              ]"
            >
              {{ category.title }}
            </button>
          </div>

          <!-- FAQs by Category -->
          <div class="space-y-6">
            <template v-for="category in displayCategories" :key="category.id">
              <div v-if="getFaqsForCategory(category.id).length > 0" class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                <div class="px-5 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-gray-200 dark:border-slate-700">
                  <h2 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <component :is="getCategoryIcon(category.icon)" class="w-4 h-4 text-primary" />
                    {{ category.title }}
                  </h2>
                </div>
                <HelpFaqAccordion
                  :faqs="getFaqsForCategory(category.id)"
                  :highlighted-id="highlightedFaqId"
                />
              </div>
            </template>
          </div>

          <!-- No Results -->
          <div v-if="filteredFaqs.length === 0" class="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
            <Search class="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">No FAQs found</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Try different search terms or browse all categories.</p>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  HelpCircle,
  Search,
  Rocket,
  FileText,
  UserCheck,
  Home,
  CreditCard,
  Shield,
  Settings,
  Scale,
  LayoutDashboard,
  Send,
  ClipboardCheck,
  Users,
  FileSignature
} from 'lucide-vue-next'
import Sidebar from '@/components/Sidebar.vue'
import HelpBreadcrumb from '@/components/help/HelpBreadcrumb.vue'
import HelpFaqAccordion from '@/components/help/HelpFaqAccordion.vue'
import { useTranslation } from '@/composables/useTranslation'
import { useHelpContent } from '@/composables/useHelpContent'

const { t } = useTranslation()
const route = useRoute()
const { categories, faqs, getFaqsByCategory } = useHelpContent()

const searchQuery = ref('')
const selectedCategory = ref<string | null>(null)
const highlightedFaqId = computed(() => route.query.highlight as string | undefined)

// Icon mapping
const iconComponents: Record<string, any> = {
  Rocket,
  FileText,
  UserCheck,
  Home,
  CreditCard,
  Shield,
  Settings,
  Scale,
  LayoutDashboard,
  Send,
  ClipboardCheck,
  Users,
  FileSignature
}

const getCategoryIcon = (iconName: string) => iconComponents[iconName] || HelpCircle

// Categories that have FAQs
const categoriesWithFaqs = computed(() => {
  return categories.value.filter(cat => {
    const catFaqs = getFaqsByCategory(cat.id)
    return catFaqs.length > 0
  })
})

// Filtered FAQs based on search and category
const filteredFaqs = computed(() => {
  let result = faqs.value

  if (selectedCategory.value) {
    result = result.filter(faq => faq.category === selectedCategory.value)
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(faq =>
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query) ||
      faq.tags.some(tag => tag.toLowerCase().includes(query))
    )
  }

  return result
})

// Display categories (either selected or all with FAQs)
const displayCategories = computed(() => {
  if (selectedCategory.value) {
    return categories.value.filter(c => c.id === selectedCategory.value)
  }
  return categoriesWithFaqs.value
})

// Get FAQs for a specific category (filtered)
const getFaqsForCategory = (categoryId: string) => {
  return filteredFaqs.value.filter(faq => faq.category === categoryId)
}
</script>
