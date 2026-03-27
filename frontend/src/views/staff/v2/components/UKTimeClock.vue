<template>
  <div class="flex items-center gap-2 text-sm">
    <span class="text-lg">🇬🇧</span>
    <div>
      <div class="font-medium text-gray-900 dark:text-white">{{ formattedTime }}</div>
      <div class="text-xs text-gray-500 dark:text-slate-400">{{ formattedDate }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const currentTime = ref(new Date())
let intervalId: ReturnType<typeof setInterval> | null = null

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' GMT'
})

const formattedDate = computed(() => {
  return currentTime.value.toLocaleDateString('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
})

import { computed } from 'vue'

onMounted(() => {
  intervalId = setInterval(() => {
    currentTime.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>
