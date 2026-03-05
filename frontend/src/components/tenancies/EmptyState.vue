<template>
  <div class="p-6">
    <div class="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center overflow-hidden">
      <!-- Background decoration -->
      <div class="absolute inset-0 overflow-hidden">
        <div
          class="absolute -top-20 -right-20 w-56 h-56 rounded-full blur-3xl"
          :class="bgGradientClass"
        />
        <div
          class="absolute -bottom-20 -left-20 w-56 h-56 rounded-full blur-3xl"
          :class="bgGradientSecondaryClass"
        />
      </div>

      <div class="relative">
        <!-- Icon -->
        <div
          class="mx-auto w-16 h-16 rounded-xl flex items-center justify-center mb-5"
          :class="iconBgClass"
        >
          <component
            :is="iconComponent"
            class="w-8 h-8"
            :class="iconColorClass"
          />
        </div>

        <!-- Title -->
        <h3 class="text-lg font-bold text-slate-900 dark:text-white">
          {{ title }}
        </h3>

        <!-- Description -->
        <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          {{ description }}
        </p>

        <!-- Action -->
        <div v-if="variant === 'draft' || variant === 'empty'" class="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            @click="$emit('action')"
            class="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-md shadow-primary/25 transition-all hover:shadow-lg hover:shadow-primary/30"
          >
            <Plus class="w-3.5 h-3.5" />
            Create Tenancy
          </button>

          <router-link
            to="/references?status=completed"
            class="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <FileCheck class="w-3.5 h-3.5" />
            View Completed References
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { KeyRound, SearchX, Plus, FileCheck, FileEdit, CheckCircle2, AlertTriangle } from 'lucide-vue-next'

const props = defineProps<{
  variant: 'empty' | 'search' | 'draft' | 'active' | 'notice_served'
}>()

defineEmits<{
  action: []
}>()

const iconComponent = computed(() => {
  switch (props.variant) {
    case 'search': return SearchX
    case 'draft': return FileEdit
    case 'active': return CheckCircle2
    case 'notice_served': return AlertTriangle
    default: return KeyRound
  }
})

const title = computed(() => {
  switch (props.variant) {
    case 'search': return 'No tenancies found'
    case 'draft': return 'No draft tenancies'
    case 'active': return 'No active tenancies'
    case 'notice_served': return 'No notices served'
    default: return 'No tenancies yet'
  }
})

const description = computed(() => {
  switch (props.variant) {
    case 'search':
      return 'Try adjusting your search terms or clearing the search to see all tenancies.'
    case 'draft':
      return 'Create a new tenancy or convert a completed reference to get started.'
    case 'active':
      return 'Once you activate a draft tenancy, it will appear here.'
    case 'notice_served':
      return 'Tenancies with Section 8 notices or end tenancy notices will appear here.'
    default:
      return 'Tenancies will appear here once you create them or convert completed references.'
  }
})

const iconBgClass = computed(() => {
  switch (props.variant) {
    case 'search': return 'bg-slate-100 dark:bg-slate-800'
    case 'draft': return 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50'
    case 'active': return 'bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50'
    case 'notice_served': return 'bg-gradient-to-br from-rose-100 to-red-100 dark:from-rose-900/50 dark:to-red-900/50'
    default: return 'bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50'
  }
})

const iconColorClass = computed(() => {
  switch (props.variant) {
    case 'search': return 'text-slate-400 dark:text-slate-500'
    case 'draft': return 'text-amber-600 dark:text-amber-400'
    case 'active': return 'text-emerald-600 dark:text-emerald-400'
    case 'notice_served': return 'text-rose-600 dark:text-rose-400'
    default: return 'text-primary'
  }
})

const bgGradientClass = computed(() => {
  switch (props.variant) {
    case 'draft': return 'bg-gradient-to-br from-amber-100/50 to-orange-100/30 dark:from-amber-900/20 dark:to-orange-900/10'
    case 'active': return 'bg-gradient-to-br from-emerald-100/50 to-teal-100/30 dark:from-emerald-900/20 dark:to-teal-900/10'
    case 'notice_served': return 'bg-gradient-to-br from-rose-100/50 to-red-100/30 dark:from-rose-900/20 dark:to-red-900/10'
    default: return 'bg-gradient-to-br from-primary/5 to-amber-100/30 dark:from-primary/10 dark:to-amber-900/10'
  }
})

const bgGradientSecondaryClass = computed(() => {
  switch (props.variant) {
    case 'draft': return 'bg-gradient-to-tr from-orange-100/30 to-amber-50/20 dark:from-orange-900/10 dark:to-amber-900/5'
    case 'active': return 'bg-gradient-to-tr from-teal-100/30 to-emerald-50/20 dark:from-teal-900/10 dark:to-emerald-900/5'
    case 'notice_served': return 'bg-gradient-to-tr from-red-100/30 to-rose-50/20 dark:from-red-900/10 dark:to-rose-900/5'
    default: return 'bg-gradient-to-tr from-emerald-100/30 to-teal-50/20 dark:from-emerald-900/10 dark:to-teal-900/5'
  }
})
</script>
