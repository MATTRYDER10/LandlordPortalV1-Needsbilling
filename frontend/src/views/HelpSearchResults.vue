<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <!-- Top Bar -->
      <div class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">
        <HelpBreadcrumb :crumbs="[{ label: t('help.search.results') }]" />
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto px-6 py-8">
          <!-- Search Input -->
          <div class="mb-8">
            <HelpSearch />
          </div>

          <!-- Results Header -->
          <div class="mb-6">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ t('help.search.resultsCount', { count: results.length, query: searchQuery }) }}
            </h1>
          </div>

          <!-- Results -->
          <div v-if="results.length > 0" class="space-y-4">
            <div
              v-for="result in results"
              :key="result.id"
              @click="navigateToResult(result)"
              class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 hover:border-primary dark:hover:border-primary cursor-pointer transition-all group"
            >
              <div class="flex items-start gap-4">
                <div :class="[
                  'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                  result.type === 'faq'
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : 'bg-green-100 dark:bg-green-900/30'
                ]">
                  <HelpCircle v-if="result.type === 'faq'" class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  <BookOpen v-else class="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <span :class="[
                      'text-xs font-medium px-2 py-0.5 rounded-full',
                      result.type === 'faq'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    ]">
                      {{ result.type === 'faq' ? 'FAQ' : 'Guide' }}
                    </span>
                    <span class="text-xs text-gray-500 dark:text-slate-400">
                      {{ getCategoryName(result.category) }}
                    </span>
                  </div>
                  <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                    {{ result.title }}
                  </h3>
                  <p class="text-sm text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {{ result.preview }}
                  </p>
                </div>
                <ChevronRight class="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 mt-2" />
              </div>
            </div>
          </div>

          <!-- No Results -->
          <div v-else class="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
            <Search class="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">{{ t('help.search.noResults') }}</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">{{ t('help.search.tryDifferent') }}</p>
            <router-link
              to="/help-centre"
              class="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80 font-medium"
            >
              Browse all categories
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Search, HelpCircle, BookOpen, ChevronRight } from 'lucide-vue-next'
import Sidebar from '@/components/Sidebar.vue'
import HelpBreadcrumb from '@/components/help/HelpBreadcrumb.vue'
import HelpSearch from '@/components/help/HelpSearch.vue'
import { useTranslation } from '@/composables/useTranslation'
import { useHelpContent, type SearchResult } from '@/composables/useHelpContent'

const { t } = useTranslation()
const route = useRoute()
const router = useRouter()
const { search, getCategoryById } = useHelpContent()

const searchQuery = ref('')
const results = ref<SearchResult[]>([])

// Get search query from URL
onMounted(() => {
  const q = route.query.q as string
  if (q) {
    searchQuery.value = q
    results.value = search(q)
  }
})

// Watch for URL changes
watch(() => route.query.q, (newQ) => {
  if (newQ && typeof newQ === 'string') {
    searchQuery.value = newQ
    results.value = search(newQ)
  }
})

// Get category name
const getCategoryName = (categoryId: string): string => {
  const category = getCategoryById(categoryId)
  return category?.title || categoryId
}

// Navigate to result
const navigateToResult = (result: SearchResult) => {
  if (result.type === 'guide' && result.slug) {
    router.push(`/help-centre/article/${result.slug}`)
  } else if (result.type === 'faq') {
    router.push(`/help-centre/faq?highlight=${result.id}`)
  }
}
</script>
