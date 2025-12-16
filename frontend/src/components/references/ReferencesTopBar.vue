<template>
  <div class="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20">
    <div class="flex items-center justify-between gap-4">
      <!-- Title -->
      <div>
        <h1 class="text-2xl font-bold text-gray-900">References</h1>
      </div>

      <!-- Search -->
      <div class="flex-1 max-w-md">
        <div class="relative">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg class="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            :value="search"
            @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Search by property, tenant..."
            class="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
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
            class="block w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none bg-white"
          >
            <option value="move_in_date">Move-in Date</option>
            <option value="created_at">Created Date</option>
          </select>
          <div class="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
            <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <!-- Sort order toggle -->
        <button
          @click="toggleSortOrder"
          class="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
          :title="sortOrder === 'asc' ? 'Ascending' : 'Descending'"
        >
          <svg class="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path v-if="sortOrder === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
          </svg>
        </button>

        <!-- Refresh -->
        <button
          @click="$emit('refresh')"
          class="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
          title="Refresh"
        >
          <svg class="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
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
