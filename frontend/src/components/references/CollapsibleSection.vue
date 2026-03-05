<template>
  <div class="border-b border-gray-200 dark:border-slate-700">
    <button
      @click="isOpen = !isOpen"
      class="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
    >
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white">{{ title }}</h3>
        <!-- Status indicator -->
        <span
          v-if="status"
          class="w-2 h-2 rounded-full"
          :class="{
            'bg-green-500': status === 'pass',
            'bg-yellow-500': status === 'pending',
            'bg-red-500': status === 'fail'
          }"
        ></span>
        <!-- Badge -->
        <span
          v-if="badge"
          class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300"
        >
          {{ badge }}
        </span>
      </div>
      <ChevronDown
        class="w-5 h-5 text-gray-400 dark:text-slate-500 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 max-h-0"
      enter-to-class="opacity-100 max-h-[1000px]"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 max-h-[1000px]"
      leave-to-class="opacity-0 max-h-0"
    >
      <div v-if="isOpen" class="px-6 pb-4 overflow-hidden">
        <slot></slot>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  defaultOpen?: boolean
  status?: 'pass' | 'pending' | 'fail'
  badge?: string
}>()

const isOpen = ref(props.defaultOpen ?? true)
</script>
