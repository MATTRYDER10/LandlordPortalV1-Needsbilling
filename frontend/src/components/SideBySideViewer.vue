<template>
  <div class="grid grid-cols-2 gap-6">
    <!-- Left Panel -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">{{ leftTitle }}</h4>
      <div class="border rounded-lg overflow-hidden bg-gray-50">
        <div v-if="leftImageUrl" class="relative group">
          <img
            :src="leftImageUrl"
            :alt="leftTitle"
            class="w-full h-auto cursor-zoom-in"
            @click="openImageModal(leftImageUrl, leftTitle)"
          />
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
            <svg class="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </div>
        </div>
        <div v-else class="p-8 text-center text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">No document provided</p>
        </div>
      </div>
      <slot name="left-content"></slot>
    </div>

    <!-- Right Panel -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">{{ rightTitle }}</h4>
      <div class="border rounded-lg overflow-hidden bg-gray-50">
        <div v-if="rightImageUrl" class="relative group">
          <img
            :src="rightImageUrl"
            :alt="rightTitle"
            class="w-full h-auto cursor-zoom-in"
            @click="openImageModal(rightImageUrl, rightTitle)"
          />
          <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
            <svg class="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </div>
        </div>
        <div v-else class="p-8 text-center text-gray-400">
          <svg class="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p class="text-sm">No document provided</p>
        </div>
      </div>
      <slot name="right-content"></slot>
    </div>
  </div>

  <!-- Image Zoom Modal -->
  <div v-if="showModal" class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-90" @click="closeImageModal">
    <div class="flex items-center justify-center min-h-screen p-4">
      <button
        @click="closeImageModal"
        class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div class="relative max-w-7xl max-h-screen">
        <h3 class="text-white text-xl mb-4 text-center">{{ modalTitle }}</h3>
        <img
          :src="modalImageUrl"
          :alt="modalTitle"
          class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
          @click.stop
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  leftImageUrl?: string
  rightImageUrl?: string
  leftTitle?: string
  rightTitle?: string
}

withDefaults(defineProps<Props>(), {
  leftImageUrl: '',
  rightImageUrl: '',
  leftTitle: 'Left View',
  rightTitle: 'Right View'
})

const showModal = ref(false)
const modalImageUrl = ref('')
const modalTitle = ref('')

const openImageModal = (imageUrl: string, title: string) => {
  modalImageUrl.value = imageUrl
  modalTitle.value = title
  showModal.value = true
}

const closeImageModal = () => {
  showModal.value = false
  modalImageUrl.value = ''
  modalTitle.value = ''
}
</script>
