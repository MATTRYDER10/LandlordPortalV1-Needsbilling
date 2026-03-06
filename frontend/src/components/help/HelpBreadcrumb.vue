<template>
  <nav class="flex items-center space-x-2 text-sm">
    <router-link
      to="/help-centre"
      class="text-gray-500 dark:text-slate-400 hover:text-primary transition-colors"
    >
      {{ t('help.breadcrumb.home') }}
    </router-link>
    <template v-for="(crumb, index) in crumbs" :key="index">
      <ChevronRight class="w-4 h-4 text-gray-400 dark:text-slate-500" />
      <router-link
        v-if="crumb.to"
        :to="crumb.to"
        class="text-gray-500 dark:text-slate-400 hover:text-primary transition-colors"
      >
        {{ crumb.label }}
      </router-link>
      <span v-else class="text-gray-900 dark:text-white font-medium">
        {{ crumb.label }}
      </span>
    </template>
  </nav>
</template>

<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'
import { useTranslation } from '@/composables/useTranslation'

const { t } = useTranslation()

interface Breadcrumb {
  label: string
  to?: string
}

defineProps<{
  crumbs: Breadcrumb[]
}>()
</script>
