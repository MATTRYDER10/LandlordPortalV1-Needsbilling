<template>
  <Sidebar>
    <div class="h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <!-- Hero Section -->
      <div class="bg-gradient-to-br from-primary/10 via-orange-50 to-amber-50 dark:from-primary/20 dark:via-slate-900 dark:to-slate-900 border-b border-gray-200 dark:border-slate-800">
        <div class="max-w-4xl mx-auto px-6 py-12 text-center">
          <h1 class="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            {{ t('help.title') }}
          </h1>
          <p class="text-lg text-gray-600 dark:text-slate-400 mb-8">
            {{ t('help.subtitle') }}
          </p>

          <!-- Search Bar -->
          <div class="max-w-2xl mx-auto">
            <HelpSearch @select="handleSearchSelect" />
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="flex-1 overflow-y-auto">
        <div class="max-w-6xl mx-auto px-6 py-8 space-y-10">

          <!-- Bug Report Banner -->
          <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-5 flex items-start gap-4">
            <div class="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
              <Bug class="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900 dark:text-white text-sm">Report Technical Issues</h3>
              <p class="text-sm text-gray-600 dark:text-slate-400 mt-1">
                Click the <strong>bug icon</strong> in the bottom-right corner of any page to report technical issues directly to our team. Issues will be picked up and resolved as quickly as possible, usually within 24 hours Monday - Saturday.
              </p>
            </div>
          </div>

          <!-- Quick Stats -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center">
              <div class="text-2xl font-bold text-primary">{{ categories.length }}</div>
              <div class="text-sm text-gray-500 dark:text-slate-400">Categories</div>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center">
              <div class="text-2xl font-bold text-primary">{{ guides.length }}</div>
              <div class="text-sm text-gray-500 dark:text-slate-400">Guides</div>
            </div>
            <div class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center">
              <div class="text-2xl font-bold text-primary">{{ faqs.length }}</div>
              <div class="text-sm text-gray-500 dark:text-slate-400">FAQs</div>
            </div>
            <router-link
              to="/help-centre/faq"
              class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 text-center hover:border-primary dark:hover:border-primary transition-colors group"
            >
              <div class="text-2xl font-bold text-primary group-hover:scale-110 transition-transform">
                <HelpCircle class="w-7 h-7 mx-auto" />
              </div>
              <div class="text-sm text-gray-500 dark:text-slate-400 group-hover:text-primary transition-colors">View FAQs</div>
            </router-link>
          </div>

          <!-- Categories Section -->
          <div>
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-5">
              {{ t('help.categories.title') }}
            </h2>
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <HelpCategoryCard
                v-for="category in categories"
                :key="category.id"
                :category="category"
                :article-count="getArticleCount(category.id)"
              />
            </div>
          </div>

          <!-- Popular Articles -->
          <div v-if="guides.length > 0">
            <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-5">
              Popular Guides
            </h2>
            <div class="grid md:grid-cols-2 gap-4">
              <router-link
                v-for="guide in guides.slice(0, 4)"
                :key="guide.id"
                :to="`/help-centre/article/${guide.slug}`"
                class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 hover:border-primary dark:hover:border-primary hover:shadow-md transition-all group"
              >
                <div class="flex items-start gap-4">
                  <div class="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                    <BookOpen class="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <h3 class="font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors">
                      {{ guide.title }}
                    </h3>
                    <p class="text-sm text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
                      {{ guide.content.intro }}
                    </p>
                    <div class="flex items-center gap-2 mt-2 text-xs text-gray-400 dark:text-slate-500">
                      <Clock class="w-3.5 h-3.5" />
                      {{ guide.estimatedReadTime }}
                    </div>
                  </div>
                  <ChevronRight class="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                </div>
              </router-link>
            </div>
          </div>

          <!-- FAQ Preview -->
          <div v-if="faqs.length > 0" class="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
              <div class="flex items-center gap-2">
                <HelpCircle class="w-5 h-5 text-primary" />
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                  {{ t('help.faq.title') }}
                </h2>
              </div>
              <router-link
                to="/help-centre/faq"
                class="text-sm font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              >
                {{ t('help.viewAll') }}
                <ChevronRight class="w-4 h-4" />
              </router-link>
            </div>
            <HelpFaqAccordion :faqs="faqs.slice(0, 5)" />
          </div>

          <!-- Support Section -->
          <div class="bg-gradient-to-r from-primary/10 to-orange-100 dark:from-primary/20 dark:to-orange-900/20 rounded-xl p-6 border border-primary/20">
            <div class="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div class="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <MessageCircle class="w-7 h-7 text-primary" />
              </div>
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900 dark:text-white text-lg">
                  {{ t('help.support.title') }}
                </h3>
                <p class="text-gray-600 dark:text-slate-300 mt-1">
                  {{ t('help.support.description') }}
                </p>
              </div>
              <a
                href="mailto:support@propertygoose.co.uk"
                class="inline-flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-medium rounded-lg transition-colors"
              >
                <Mail class="w-5 h-5" />
                {{ t('help.support.email') }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  HelpCircle,
  BookOpen,
  Clock,
  ChevronRight,
  MessageCircle,
  Mail,
  Bug
} from 'lucide-vue-next'
import Sidebar from '@/components/Sidebar.vue'
import HelpSearch from '@/components/help/HelpSearch.vue'
import HelpCategoryCard from '@/components/help/HelpCategoryCard.vue'
import HelpFaqAccordion from '@/components/help/HelpFaqAccordion.vue'
import { useTranslation } from '@/composables/useTranslation'
import { useHelpContent, type SearchResult } from '@/composables/useHelpContent'

const { t } = useTranslation()
const router = useRouter()
const { categories, guides, faqs, getArticleCount } = useHelpContent()

const handleSearchSelect = (result: SearchResult) => {
  if (result.type === 'guide' && result.slug) {
    router.push(`/help-centre/article/${result.slug}`)
  } else if (result.type === 'faq') {
    router.push(`/help-centre/faq?highlight=${result.id}`)
  }
}
</script>
