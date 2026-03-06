<template>
  <router-link
    :to="`/help-centre/category/${category.slug}`"
    class="block bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-5 hover:border-primary dark:hover:border-primary hover:shadow-md transition-all group"
  >
    <div class="flex items-start gap-4">
      <div :class="[
        'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
        colorClasses.bg,
        'group-hover:scale-105 transition-transform'
      ]">
        <component :is="iconComponent" :class="['w-6 h-6', colorClasses.icon]" />
      </div>
      <div class="flex-1 min-w-0">
        <h3 class="font-semibold text-gray-900 dark:text-white group-hover:text-primary transition-colors">
          {{ category.title }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-slate-400 mt-1 line-clamp-2">
          {{ category.description }}
        </p>
        <p class="text-xs text-gray-400 dark:text-slate-500 mt-2">
          {{ t('help.categories.articles', { count: articleCount }) }}
        </p>
      </div>
      <ChevronRight class="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
    </div>
  </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, Rocket, FileText, UserCheck, Home, CreditCard, Shield, Settings, Scale, HelpCircle, LayoutDashboard, Send, ClipboardCheck, Users, FileSignature } from 'lucide-vue-next'
import { useTranslation } from '@/composables/useTranslation'
import type { Category } from '@/composables/useHelpContent'

const { t } = useTranslation()

const props = defineProps<{
  category: Category
  articleCount: number
}>()

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

const iconComponent = computed(() => iconComponents[props.category.icon] || HelpCircle)

// Color classes based on category color
const colorClasses = computed(() => {
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
  return colorMap[props.category.color] ?? colorMap.blue ?? { bg: '', icon: '' }
})
</script>
