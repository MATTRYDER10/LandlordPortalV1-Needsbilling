<template>
  <div class="flex justify-end pt-1">
    <button
      @click="$emit('click')"
      class="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1.5 hover:text-gray-600 dark:hover:text-slate-300 transition-colors select-none"
    >
      press <kbd class="px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded text-[10px] font-mono font-semibold text-gray-500 dark:text-slate-400">Enter &#8629;</kbd>
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ click: [] }>()
</script>
