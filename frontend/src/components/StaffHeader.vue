<template>
  <div class="bg-white shadow">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-6">
        <div class="flex items-center">
          <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-10 mr-3" />
          <span class="text-sm font-semibold px-3 py-1 bg-primary/10 text-primary rounded-full">Staff Portal</span>
        </div>
        <button
          @click="handleSignOut"
          class="flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
        >
          <LogOut class="w-5 h-5 mr-2" />
          Sign Out
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { LogOut } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()

const handleSignOut = async () => {
  await authStore.signOut()
  router.push('/staff/login')
}
</script>
