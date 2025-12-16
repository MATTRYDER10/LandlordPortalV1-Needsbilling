<template>
  <div class="flex items-center gap-1 flex-wrap">
    <span
      v-for="section in sections"
      :key="section.type"
      class="px-1.5 py-0.5 text-xs rounded"
      :class="getChipClass(section)"
      :title="section.label"
    >
      {{ section.label }}{{ section.failures > 0 ? ` ×${section.failures}` : '' }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface CheckFailures {
  ID?: number
  RTR?: number
  Income?: number
  Residential?: number
  Credit?: number
  AML?: number
  [key: string]: number | undefined
}

const props = defineProps<{
  failures: CheckFailures
}>()

const sections = computed(() => {
  const sectionDefs = [
    { key: 'ID', label: 'ID' },
    { key: 'RTR', label: 'RTR' },
    { key: 'Income', label: 'Inc' },
    { key: 'Residential', label: 'Res' },
    { key: 'Credit', label: 'Cred' },
    { key: 'AML', label: 'AML' }
  ]

  return sectionDefs.map(s => ({
    type: s.key,
    label: s.label,
    failures: props.failures[s.key] || 0
  }))
})

function getChipClass(section: { failures: number }): string {
  if (section.failures > 0) {
    return 'bg-red-100 text-red-700 font-medium'
  }
  return 'bg-gray-100 text-gray-600'
}
</script>
