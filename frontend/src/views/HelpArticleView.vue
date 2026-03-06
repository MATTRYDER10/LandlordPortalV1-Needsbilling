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
          <!-- Article Found -->
          <HelpArticle v-if="article" :article="article" />

          <!-- Not Found State -->
          <div v-else class="text-center py-12">
            <FileText class="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <h2 class="text-lg font-medium text-gray-900 dark:text-white">Article not found</h2>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">This article doesn't exist or has been moved.</p>
            <router-link
              to="/help-centre"
              class="inline-flex items-center gap-2 mt-4 text-primary hover:text-primary/80 font-medium"
            >
              <ArrowLeft class="w-4 h-4" />
              Back to Help Centre
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { FileText, ArrowLeft } from 'lucide-vue-next'
import Sidebar from '@/components/Sidebar.vue'
import HelpBreadcrumb from '@/components/help/HelpBreadcrumb.vue'
import HelpArticle from '@/components/help/HelpArticle.vue'
import { useHelpContent } from '@/composables/useHelpContent'

const route = useRoute()
const { getGuideBySlug, getCategoryById } = useHelpContent()

const articleSlug = computed(() => route.params.slug as string)
const article = computed(() => getGuideBySlug(articleSlug.value))

// Breadcrumbs
const breadcrumbs = computed(() => {
  if (!article.value) return []
  const category = getCategoryById(article.value.category)
  const crumbs = []

  if (category) {
    crumbs.push({
      label: category.title,
      to: `/help-centre/category/${category.slug}`
    })
  }

  crumbs.push({ label: article.value.title })
  return crumbs
})
</script>
