<template>
  <div class="relative" ref="searchContainer">
    <!-- Search Input -->
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search class="h-5 w-5 text-gray-400 dark:text-slate-500" />
      </div>
      <input
        ref="searchInput"
        v-model="query"
        type="text"
        :placeholder="t('help.search.placeholder')"
        class="block w-full pl-12 pr-12 py-3.5 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-base shadow-sm"
        @focus="showDropdown = true"
        @keydown.enter="handleEnter"
        @keydown.escape="closeDropdown"
        @keydown.down.prevent="navigateResults(1)"
        @keydown.up.prevent="navigateResults(-1)"
      />
      <div v-if="query" class="absolute inset-y-0 right-0 pr-4 flex items-center">
        <button
          @click="clearSearch"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
      <div v-if="isSearching" class="absolute inset-y-0 right-0 pr-4 flex items-center">
        <div class="w-5 h-5 border-2 border-gray-300 dark:border-slate-600 border-t-primary rounded-full animate-spin"></div>
      </div>
    </div>

    <!-- Dropdown Results -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="showDropdown && query.length >= 2"
        class="absolute z-50 w-full mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden"
      >
        <!-- Results List -->
        <div v-if="results.length > 0" class="max-h-96 overflow-y-auto">
          <div
            v-for="(result, index) in results.slice(0, 6)"
            :key="result.id"
            @click="selectResult(result)"
            @mouseenter="highlightedIndex = index"
            :class="[
              'px-4 py-3 cursor-pointer transition-colors border-b border-gray-100 dark:border-slate-800 last:border-b-0',
              highlightedIndex === index
                ? 'bg-gray-50 dark:bg-slate-800'
                : 'hover:bg-gray-50 dark:hover:bg-slate-800'
            ]"
          >
            <div class="flex items-start gap-3">
              <div :class="[
                'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
                result.type === 'faq'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              ]">
                <HelpCircle v-if="result.type === 'faq'" class="w-4 h-4" />
                <BookOpen v-else class="w-4 h-4" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
                    {{ result.type === 'faq' ? 'FAQ' : 'Guide' }}
                  </span>
                </div>
                <h4 class="font-medium text-gray-900 dark:text-white mt-1" v-html="highlightMatches(result.title)"></h4>
                <p class="text-sm text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-1" v-html="highlightMatches(result.preview)"></p>
              </div>
            </div>
          </div>
        </div>

        <!-- No Results -->
        <div v-else-if="!isSearching && query.length >= 2" class="px-4 py-6 text-center">
          <Search class="w-8 h-8 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
          <p class="text-sm text-gray-500 dark:text-slate-400">{{ t('help.search.noResults') }}</p>
          <p class="text-xs text-gray-400 dark:text-slate-500 mt-1">{{ t('help.search.tryDifferent') }}</p>
        </div>

        <!-- View All Results -->
        <div v-if="results.length > 6" class="px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-t border-gray-200 dark:border-slate-700">
          <button
            @click="viewAllResults"
            class="text-sm font-medium text-primary hover:text-primary/80 transition-colors w-full text-center"
          >
            {{ t('help.viewAll') }} ({{ results.length }} {{ t('help.search.results').toLowerCase() }})
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Search, X, HelpCircle, BookOpen } from 'lucide-vue-next'
import { useTranslation } from '@/composables/useTranslation'
import { useHelpContent, type SearchResult } from '@/composables/useHelpContent'

const { t } = useTranslation()
const router = useRouter()
const { search } = useHelpContent()

const emit = defineEmits<{
  (e: 'search', query: string): void
  (e: 'select', result: SearchResult): void
}>()

const query = ref('')
const results = ref<SearchResult[]>([])
const isSearching = ref(false)
const showDropdown = ref(false)
const highlightedIndex = ref(-1)
const searchContainer = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Debounced search
watch(query, (newQuery) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }

  if (newQuery.length < 2) {
    results.value = []
    isSearching.value = false
    return
  }

  isSearching.value = true
  highlightedIndex.value = -1

  debounceTimer = setTimeout(() => {
    results.value = search(newQuery)
    isSearching.value = false
    emit('search', newQuery)
  }, 200)
})

// Highlight matching text
const highlightMatches = (text: string): string => {
  if (!query.value.trim()) return text
  const words = query.value.trim().split(/\s+/)
  let result = text
  words.forEach(word => {
    const regex = new RegExp(`(${word})`, 'gi')
    result = result.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-900/50 text-inherit rounded px-0.5">$1</mark>')
  })
  return result
}

// Navigate results with keyboard
const navigateResults = (direction: number) => {
  const maxIndex = Math.min(results.value.length - 1, 5)
  highlightedIndex.value = Math.max(-1, Math.min(maxIndex, highlightedIndex.value + direction))
}

// Handle enter key
const handleEnter = () => {
  const selected = highlightedIndex.value >= 0 ? results.value[highlightedIndex.value] : undefined
  if (selected) {
    selectResult(selected)
  } else if (query.value.trim()) {
    viewAllResults()
  }
}

// Select a result
const selectResult = (result: SearchResult) => {
  emit('select', result)
  showDropdown.value = false

  if (result.type === 'guide' && result.slug) {
    router.push(`/help-centre/article/${result.slug}`)
  } else if (result.type === 'faq') {
    router.push(`/help-centre/faq?highlight=${result.id}`)
  }
}

// View all results
const viewAllResults = () => {
  if (query.value.trim()) {
    router.push(`/help-centre/search?q=${encodeURIComponent(query.value)}`)
    showDropdown.value = false
  }
}

// Clear search
const clearSearch = () => {
  query.value = ''
  results.value = []
  showDropdown.value = false
  searchInput.value?.focus()
}

// Close dropdown
const closeDropdown = () => {
  showDropdown.value = false
}

// Click outside handler
const handleClickOutside = (event: MouseEvent) => {
  if (searchContainer.value && !searchContainer.value.contains(event.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
})
</script>
