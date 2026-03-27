<template>
  <div>
    <button
      @click="showModal = true"
      class="fixed bottom-6 right-6 z-50 w-12 h-12 bg-orange-500 hover:bg-orange-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center"
      title="Report an issue"
    >
      <Bug class="w-5 h-5" />
    </button>

    <ReportIssueModal :visible="showModal" @close="showModal = false" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Bug } from 'lucide-vue-next'
import ReportIssueModal from './ReportIssueModal.vue'

const showModal = ref(false)
</script>
