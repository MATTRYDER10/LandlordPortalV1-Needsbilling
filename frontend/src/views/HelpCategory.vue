<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <!-- Top Bar -->
      <div class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4">
        <HelpBreadcrumb :crumbs="breadcrumbs" />
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto px-6 py-8">

          <!-- Category Header -->
          <div v-if="category" class="mb-8">
            <div class="flex items-center gap-4 mb-4">
              <div :class="[
                'w-14 h-14 rounded-xl flex items-center justify-center',
                colorClasses.bg
              ]">
                <component :is="iconComponent" :class="['w-7 h-7', colorClasses.icon]" />
              </div>
              <div>
                <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ category.title }}
                </h1>
                <p class="text-gray-500 dark:text-slate-400 mt-1">
                  {{ category.description }}
                </p>
              </div>
            </div>
          </div>

          <!-- Not Found State -->
          <div v-else class="text-center py-12">
            <AlertCircle class="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Category not found</h2>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">This category doesn't exist.</p>
            <router-link
              to="/help-centre"
              class="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80 font-medium"
            >
              <ArrowLeft class="w-4 h-4" />
              Back to Help Centre
            </router-link>
          </div>

          <!-- Guides Section -->
          <div v-if="categoryGuides.length > 0" class="mb-10">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <BookOpen class="w-5 h-5 text-primary" />
              Guides
              <span class="text-sm font-normal text-gray-500 dark:text-slate-400">({{ categoryGuides.length }})</span>
            </h2>
            <div class="space-y-3">
              <router-link
                v-for="guide in categoryGuides"
                :key="guide.id"
                :to="`/help-centre/article/${guide.slug}`"
                class="block bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 hover:border-primary dark:hover:border-primary hover:shadow-md transition-all group"
              >
                <div class="flex items-start gap-4">
                  <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <FileText class="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                      {{ guide.title }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {{ guide.content.intro }}
                    </p>
                    <div class="flex items-center gap-3 mt-2 text-xs text-gray-400 dark:text-slate-500">
                      <span class="flex items-center gap-1">
                        <Clock class="w-3.5 h-3.5" />
                        {{ guide.estimatedReadTime }}
                      </span>
                      <span class="flex items-center gap-1">
                        <Calendar class="w-3.5 h-3.5" />
                        Updated {{ formatDate(guide.updatedAt) }}
                      </span>
                    </div>
                  </div>
                  <ChevronRight class="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 mt-2" />
                </div>
              </router-link>
            </div>
          </div>

          <!-- FAQs Section -->
          <div v-if="categoryFaqs.length > 0">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <HelpCircle class="w-5 h-5 text-primary" />
              FAQs
              <span class="text-sm font-normal text-gray-500 dark:text-slate-400">({{ categoryFaqs.length }})</span>
            </h2>
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
              <HelpFaqAccordion :faqs="categoryFaqs" />
            </div>
          </div>

          <!-- Empty State -->
          <div v-if="category && categoryGuides.length === 0 && categoryFaqs.length === 0" class="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800">
            <FileText class="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white">No articles yet</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Content for this category is coming soon.</p>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  BookOpen,
  FileText,
  HelpCircle,
  Clock,
  Calendar,
  ChevronRight,
  ArrowLeft,
  AlertCircle,
  Rocket,
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
import { useHelpContent } from '@/composables/useHelpContent'

const route = useRoute()
const { getCategoryBySlug, getGuidesByCategory, getFaqsByCategory } = useHelpContent()

const categorySlug = computed(() => route.params.slug as string)
const category = computed(() => getCategoryBySlug(categorySlug.value))
const categoryGuides = computed(() => category.value ? getGuidesByCategory(category.value.id) : [])
const categoryFaqs = computed(() => category.value ? getFaqsByCategory(category.value.id) : [])

// Breadcrumbs
const breadcrumbs = computed(() => {
  if (!category.value) return []
  return [{ label: category.value.title }]
})

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

const iconComponent = computed(() => {
  if (!category.value) return HelpCircle
  return iconComponents[category.value.icon] || HelpCircle
})

// Color classes
const colorClasses = computed(() => {
  if (!category.value) return { bg: '', icon: '' }
  const colorMap: Record<string, { bg: string; icon: string }> = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-100 dark:bg-green-900/30', icon: 'text-green-600 dark:text-green-400' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-600 dark:text-purple-400' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', icon: 'text-orange-600 dark:text-orange-400' },
    emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: 'text-emerald-600 dark:text-emerald-400' },
    red: { bg: 'bg-red-100 dark:bg-red-900/30', icon: 'text-red-600 dark:text-red-400' },
    slate: { bg: 'bg-slate-100 dark:bg-slate-800', icon: 'text-slate-600 dark:text-slate-400' },
    amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', icon: 'text-amber-600 dark:text-amber-400' },
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'text-indigo-600 dark:text-indigo-400' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', icon: 'text-teal-600 dark:text-teal-400' }
  }
  return colorMap[category.value.color] || colorMap.blue
})

// Format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>
