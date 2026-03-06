<template>
  <article class="max-w-3xl">
    <!-- Article Header -->
    <header class="mb-8">
      <div class="flex items-center gap-3 text-sm text-gray-500 dark:text-slate-400 mb-3">
        <span class="flex items-center gap-1">
          <Clock class="w-4 h-4" />
          {{ article.estimatedReadTime }} {{ t('help.article.readTime', { time: '' }).replace('{time}', '') }}
        </span>
        <span class="w-1 h-1 rounded-full bg-gray-300 dark:bg-slate-600"></span>
        <span>
          {{ t('help.article.lastUpdated') }}: {{ formatDate(article.updatedAt) }}
        </span>
      </div>
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">
        {{ article.title }}
      </h1>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="tag in article.tags"
          :key="tag"
          class="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded-full"
        >
          {{ tag }}
        </span>
      </div>
    </header>

    <!-- Introduction -->
    <div class="prose prose-gray dark:prose-invert max-w-none mb-8">
      <p class="text-lg text-gray-600 dark:text-slate-300 leading-relaxed">
        {{ article.content.intro }}
      </p>
    </div>

    <!-- Content Sections -->
    <div class="space-y-8">
      <template v-for="(section, index) in article.content.sections" :key="index">
        <!-- Text Section -->
        <div v-if="section.type === 'text'" class="prose prose-gray dark:prose-invert max-w-none">
          <h2 v-if="section.title" class="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            {{ section.title }}
          </h2>
          <p class="text-gray-600 dark:text-slate-300 leading-relaxed">
            {{ section.content }}
          </p>
        </div>

        <!-- Steps Section -->
        <div v-else-if="section.type === 'steps'" class="space-y-4">
          <h2 v-if="section.title" class="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {{ section.title }}
          </h2>
          <div class="space-y-4">
            <div
              v-for="(step, stepIndex) in section.steps"
              :key="stepIndex"
              class="flex gap-4"
            >
              <div class="flex-shrink-0">
                <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-semibold text-sm">
                  {{ stepIndex + 1 }}
                </div>
                <div v-if="stepIndex < (section.steps?.length || 0) - 1" class="w-px h-full bg-gray-200 dark:bg-slate-700 mx-auto mt-2"></div>
              </div>
              <div class="flex-1 pb-4">
                <h4 class="font-semibold text-gray-900 dark:text-white mb-2">{{ step.title }}</h4>
                <p class="text-gray-600 dark:text-slate-300 leading-relaxed">{{ step.content }}</p>
                <!-- Step Image -->
                <div v-if="step.image" class="mt-4 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700">
                  <img :src="step.image" :alt="step.title" class="w-full" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Callout Section -->
        <div
          v-else-if="section.type === 'callout'"
          :class="[
            'rounded-lg p-4 border-l-4',
            calloutClasses(section.style || 'info')
          ]"
        >
          <div class="flex items-start gap-3">
            <component :is="calloutIcon(section.style || 'info')" class="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="font-semibold mb-1">
                {{ section.title || t(`help.callout.${section.style || 'info'}`) }}
              </h4>
              <p class="text-sm leading-relaxed">{{ section.content }}</p>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Related Articles -->
    <div v-if="relatedArticles.length > 0" class="mt-12 pt-8 border-t border-gray-200 dark:border-slate-800">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {{ t('help.article.relatedArticles') }}
      </h3>
      <div class="grid gap-3">
        <router-link
          v-for="related in relatedArticles"
          :key="related.id"
          :to="`/help-centre/article/${related.slug}`"
          class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors group"
        >
          <BookOpen class="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-primary transition-colors" />
          <span class="font-medium text-gray-900 dark:text-white group-hover:text-primary transition-colors">
            {{ related.title }}
          </span>
          <ChevronRight class="w-4 h-4 text-gray-400 dark:text-slate-500 ml-auto group-hover:translate-x-1 transition-transform" />
        </router-link>
      </div>
    </div>

    <!-- Feedback Section -->
    <div class="mt-12 pt-8 border-t border-gray-200 dark:border-slate-800">
      <div v-if="!feedbackGiven" class="flex items-center gap-4">
        <span class="text-sm text-gray-600 dark:text-slate-400">
          {{ t('help.article.feedback.question') }}
        </span>
        <div class="flex gap-2">
          <button
            @click="submitFeedback(true)"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400 rounded-lg transition-colors flex items-center gap-2"
          >
            <ThumbsUp class="w-4 h-4" />
            {{ t('help.article.feedback.yes') }}
          </button>
          <button
            @click="submitFeedback(false)"
            class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-gray-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-400 rounded-lg transition-colors flex items-center gap-2"
          >
            <ThumbsDown class="w-4 h-4" />
            {{ t('help.article.feedback.no') }}
          </button>
        </div>
      </div>
      <div v-else class="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <CheckCircle class="w-5 h-5" />
        {{ t('help.article.feedback.thanks') }}
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import {
  Clock,
  BookOpen,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  CheckCircle,
  Lightbulb,
  AlertTriangle,
  Info,
  AlertCircle
} from 'lucide-vue-next'
import { useTranslation } from '@/composables/useTranslation'
import { useHelpContent, type Guide } from '@/composables/useHelpContent'

const { t } = useTranslation()
const { getRelatedArticles, submitFeedback: submitArticleFeedback, hasFeedback } = useHelpContent()

const props = defineProps<{
  article: Guide
}>()

const feedbackGiven = ref(false)

onMounted(() => {
  feedbackGiven.value = hasFeedback(props.article.id)
})

// Get related articles
const relatedArticles = computed(() => {
  return getRelatedArticles(props.article.content.relatedArticles || [])
})

// Format date
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

// Callout styling
const calloutClasses = (style: string): string => {
  const classes: Record<string, string> = {
    tip: 'bg-green-50 dark:bg-green-900/20 border-green-500 text-green-800 dark:text-green-200',
    warning: 'bg-amber-50 dark:bg-amber-900/20 border-amber-500 text-amber-800 dark:text-amber-200',
    info: 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-800 dark:text-blue-200',
    important: 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-800 dark:text-red-200'
  }
  return classes[style] || classes.info
}

// Callout icon
const calloutIcon = (style: string) => {
  const icons: Record<string, any> = {
    tip: Lightbulb,
    warning: AlertTriangle,
    info: Info,
    important: AlertCircle
  }
  return icons[style] || Info
}

// Submit feedback
const submitFeedback = (helpful: boolean) => {
  submitArticleFeedback(props.article.id, helpful)
  feedbackGiven.value = true
}
</script>
