<template>
  <div class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-4 sticky top-0 z-20">
    <div class="flex items-center justify-between gap-4">
      <!-- Title -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">References</h1>
      </div>

      <!-- Search -->
      <div class="flex-1 max-w-md">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search class="h-5 w-5 text-gray-400 dark:text-slate-500" />
          </div>
          <input
            :value="search"
            @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Search by property, tenant..."
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-md text-sm placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>
      </div>

      <!-- Sort and Actions -->
      <div class="flex items-center gap-3">
        <!-- Sort dropdown -->
        <div class="relative">
          <select
            :value="sortBy"
            @change="handleSortChange"
            class="block w-full pl-3 pr-8 py-2 border border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none bg-white dark:bg-slate-800"
          >
            <option value="move_in_date">Move-in Date</option>
            <option value="created_at">Created Date</option>
          </select>
          <div class="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <ChevronDown class="h-4 w-4 text-gray-400 dark:text-slate-500" />
          </div>
        </div>

        <!-- Sort order toggle -->
        <button
          @click="toggleSortOrder"
          class="p-2 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800"
          :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
        >
          <ArrowUpNarrowWide v-if="sortOrder === 'asc'" class="h-5 w-5 text-gray-600 dark:text-slate-400" />
          <ArrowDownNarrowWide v-else class="h-5 w-5 text-gray-600 dark:text-slate-400" />
        </button>

        <!-- Refresh -->
        <button
          @click="$emit('refresh')"
          class="p-2 border border-gray-300 dark:border-slate-700 rounded-md hover:bg-gray-50 dark:hover:bg-slate-800"
          title="Refresh"
        >
          <RefreshCw class="h-5 w-5 text-gray-600 dark:text-slate-400" />
        </button>

        <!-- Create Reference -->
        <button
          @click="$emit('create')"
          class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
        >
          Create Reference
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search, ChevronDown, ArrowUpNarrowWide, ArrowDownNarrowWide, RefreshCw } from 'lucide-vue-next'

const props = defineProps<{
  search: string
  sortBy: 'move_in_date' | 'created_at'
  sortOrder: 'asc' | 'desc'
}>()

const emit = defineEmits<{
  'update:search': [value: string]
  'update:sortBy': [value: 'move_in_date' | 'created_at']
  'update:sortOrder': [value: 'asc' | 'desc']
  'refresh': []
  'create': []
}>()

function handleSortChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as 'move_in_date' | 'created_at'
  emit('update:sortBy', value)
}

function toggleSortOrder() {
  emit('update:sortOrder', props.sortOrder === 'asc' ? 'desc' : 'asc')
}
</script>
