<template>
  <div class="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
    <div class="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-slate-800">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300">{{ title }}</h4>
      <button
        @click="emit('edit')"
        type="button"
        class="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
      >
        <Pencil class="w-3 h-3" />
        Edit
      </button>
    </div>
    <div class="p-4">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Pencil } from 'lucide-vue-next'

interface Props {
  title: string
}

defineProps<Props>()

const emit = defineEmits<{
  edit: []
}>()
</script>
