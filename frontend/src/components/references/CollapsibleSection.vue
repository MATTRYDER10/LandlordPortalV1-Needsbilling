<template>
  <div class="border-b border-gray-200">
    <button
      @click="isOpen = !isOpen"
      class="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
    >
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-semibold text-gray-900">{{ title }}</h3>
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
          class="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600"
        >
          {{ badge }}
        </span>
      </div>
      <svg
        class="w-5 h-5 text-gray-400 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
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

const props = defineProps<{
  title: string
  defaultOpen?: boolean
  status?: 'pass' | 'pending' | 'fail'
  badge?: string
}>()

const isOpen = ref(props.defaultOpen ?? true)
</script>
