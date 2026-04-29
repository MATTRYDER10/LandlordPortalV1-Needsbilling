<template>
  <Transition name="fade">
    <span
      v-if="show"
      class="absolute right-0 bottom-3.5 text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1 select-none"
    >
      press <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-mono font-semibold text-gray-500 dark:text-slate-400">{{ label }}</kbd>
    </span>
  </Transition>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ show: boolean; label?: string }>(), {
  label: 'Enter ↵'
})
</script>
