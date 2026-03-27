<template>
  <Sidebar>
    <div class="flex-1 flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-950">
      <div class="text-center max-w-md px-6">
        <img src="/inventorygoose-logo.png" alt="InventoryGoose" class="w-24 h-24 mx-auto mb-6 rounded-2xl shadow-lg" />
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">InventoryGoose</h1>
        <span class="inline-block px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary/10 text-primary rounded-full mb-6">Coming Soon</span>
        <p class="text-gray-500 dark:text-slate-400 text-base leading-relaxed">
          Professional property inventory management is on its way. Create detailed check-in and check-out reports, track property condition, and streamline your inventory process.
        </p>
      </div>
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import Sidebar from '@/components/Sidebar.vue'
</script>
