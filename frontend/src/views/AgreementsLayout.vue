<template>
  <Sidebar>
    <!-- Header -->
    <div class="p-8 pb-0">
      <div class="mb-8">
        <h2 class="text-3xl font-bold text-gray-900">Agreements</h2>
        <p class="mt-2 text-gray-600">Manage your AST agreements</p>
      </div>

      <!-- Tab Navigation -->
      <div class="border-b border-gray-200">
        <nav class="-mb-px flex space-x-8" aria-label="Tabs">
          <router-link
            to="/agreements/generate"
            class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm"
            :class="$route.path === '/agreements/generate' || $route.path === '/agreements'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            <svg
              class="-ml-0.5 mr-2 h-5 w-5"
              :class="$route.path === '/agreements/generate' || $route.path === '/agreements'
                ? 'text-primary'
                : 'text-gray-400 group-hover:text-gray-500'"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Generate Agreement
          </router-link>

          <router-link
            to="/agreements/history"
            class="group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm"
            :class="$route.path === '/agreements/history'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'"
          >
            <svg
              class="-ml-0.5 mr-2 h-5 w-5"
              :class="$route.path === '/agreements/history'
                ? 'text-primary'
                : 'text-gray-400 group-hover:text-gray-500'"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Agreement History
          </router-link>
        </nav>
      </div>
    </div>

    <!-- Router View for nested routes -->
    <router-view />
  </Sidebar>
</template>

<script setup lang="ts">
import Sidebar from '../components/Sidebar.vue'
</script>
