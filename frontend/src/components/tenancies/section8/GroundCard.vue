<template>
  <div
    @click="emit('toggle')"
    class="border rounded-lg p-4 cursor-pointer transition-all"
    :class="selected
      ? (ground.type === 'mandatory'
        ? 'border-red-300 bg-red-50 ring-1 ring-red-300'
        : 'border-amber-300 bg-amber-50 ring-1 ring-amber-300')
      : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-800'"
  >
    <div class="flex items-start gap-3">
      <input
        type="checkbox"
        :checked="selected"
        @click.stop
        @change="emit('toggle')"
        class="mt-1 w-4 h-4 rounded border-gray-300 dark:border-slate-600 focus:ring-2 dark:bg-slate-900"
        :class="ground.type === 'mandatory'
          ? 'text-red-600 focus:ring-red-500'
          : 'text-amber-600 focus:ring-amber-500'"
      />

      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span
            class="text-xs font-semibold"
            :class="ground.type === 'mandatory' ? 'text-red-600' : 'text-amber-600'"
          >
            {{ ground.number }}
          </span>
          <span
            class="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded"
            :class="ground.type === 'mandatory'
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'"
          >
            {{ ground.type }}
          </span>
          <span class="px-1.5 py-0.5 text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded">
            {{ ground.noticePeriodLabel }}
          </span>
        </div>

        <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">{{ ground.title }}</p>

        <!-- Expandable guidance -->
        <button
          @click.stop="expanded = !expanded"
          class="mt-2 text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 flex items-center gap-1"
        >
          <ChevronDown
            class="w-3 h-3 transition-transform"
            :class="{ 'rotate-180': expanded }"
          />
          {{ expanded ? 'Hide guidance' : 'Show guidance' }}
        </button>

        <Transition name="expand">
          <div v-if="expanded" class="mt-2 text-xs text-gray-600 dark:text-slate-400 bg-gray-100 dark:bg-slate-800 rounded-lg p-3">
            <p class="font-medium text-gray-700 dark:text-slate-300 mb-1">Staff Guidance:</p>
            <p>{{ ground.staffGuidance }}</p>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import type { S8Ground } from '@/types/section8'

interface Props {
  ground: S8Ground
  selected: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  toggle: []
}>()

const expanded = ref(false)
</script>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
