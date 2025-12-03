<template>
  <div class="grid grid-cols-2 gap-6">
    <!-- Left Panel -->
    <div class="bg-white rounded-lg shadow-lg p-6">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">{{ leftTitle }}</h4>
      <div class="border rounded-lg overflow-hidden bg-gray-50">
        <div v-if="leftImageUrl" class="relative group">
          <!-- PDF Viewer -->
          <div v-if="leftIsPdf" class="w-full" style="min-height: 500px;">
            <iframe
              :src="leftImageUrl"
              class="w-full h-full"
              style="min-height: 500px;"
              frameborder="0"
            ></iframe>
            <div class="absolute top-2 right-2">
              <button
                @click="openDocumentModal(leftImageUrl, leftTitle, 'pdf')"
                class="bg-white bg-opacity-90 hover:bg-opacity-100 px-3 py-2 rounded-md shadow-md text-sm font-medium text-gray-700 flex items-center gap-2 transition-all"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
                View Fullscreen
              </button>
            </div>
          </div>
          <!-- Image Viewer -->
          <div v-else>
            <img
              :src="leftImageUrl"
              :alt="leftTitle"
              class="w-full h-auto cursor-zoom-in"
              @click="openImageModal(leftImageUrl, leftTitle)"
            />
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center pointer-events-none">
              <svg class="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </div>
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
      <div v-if="rightImageUrl" class="border rounded-lg overflow-hidden bg-gray-50">
        <div class="relative group">
          <!-- PDF Viewer -->
          <div v-if="rightIsPdf" class="w-full" style="min-height: 500px;">
            <iframe
              :src="rightImageUrl"
              class="w-full h-full"
              style="min-height: 500px;"
              frameborder="0"
            ></iframe>
            <div class="absolute top-2 right-2">
              <button
                @click="openDocumentModal(rightImageUrl, rightTitle, 'pdf')"
                class="bg-white bg-opacity-90 hover:bg-opacity-100 px-3 py-2 rounded-md shadow-md text-sm font-medium text-gray-700 flex items-center gap-2 transition-all"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
                View Fullscreen
              </button>
            </div>
          </div>
          <!-- Image Viewer -->
          <div v-else>
            <img
              :src="rightImageUrl"
              :alt="rightTitle"
              class="w-full h-auto cursor-zoom-in"
              @click="openImageModal(rightImageUrl, rightTitle)"
            />
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center pointer-events-none">
              <svg class="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
      <slot name="right-content"></slot>
    </div>
  </div>

  <!-- Image Zoom Modal -->
  <div v-if="showModal && modalType === 'image'" class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-90" @click="closeImageModal">
    <div class="flex items-center justify-center min-h-screen p-4">
      <button
        @click="closeImageModal"
        class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
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

  <!-- PDF Fullscreen Modal -->
  <div v-if="showModal && modalType === 'pdf'" class="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-90" @click="closeImageModal">
    <div class="flex items-center justify-center min-h-screen p-4">
      <button
        @click="closeImageModal"
        class="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10"
      >
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <div class="relative w-full h-full max-w-7xl max-h-screen">
        <h3 class="text-white text-xl mb-4 text-center">{{ modalTitle }}</h3>
        <iframe
          :src="modalImageUrl"
          class="w-full h-full rounded-lg shadow-2xl"
          style="min-height: calc(100vh - 120px);"
          frameborder="0"
          @click.stop
        ></iframe>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

interface Props {
  leftImageUrl?: string
  rightImageUrl?: string
  leftTitle?: string
  rightTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  leftImageUrl: '',
  rightImageUrl: '',
  leftTitle: 'Left View',
  rightTitle: 'Right View'
})

const showModal = ref(false)
const modalImageUrl = ref('')
const modalTitle = ref('')
const modalType = ref<'image' | 'pdf'>('image')

const leftIsPdf = ref(false)
const rightIsPdf = ref(false)

// Enhanced PDF detection - check blob MIME type
const checkIfPdf = async (url: string): Promise<boolean> => {
  if (!url || !url.startsWith('blob:')) return false
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return blob.type === 'application/pdf'
  } catch {
    return false
  }
}


onMounted(async () => {
  if (props.leftImageUrl) {
    leftIsPdf.value = await checkIfPdf(props.leftImageUrl)
  }
  if (props.rightImageUrl) {
    rightIsPdf.value = await checkIfPdf(props.rightImageUrl)
  }
})

// Watch for URL changes
watch(() => props.leftImageUrl, async (newUrl) => {
  if (newUrl) {
    leftIsPdf.value = await checkIfPdf(newUrl)
  } else {
    leftIsPdf.value = false
  }
})

watch(() => props.rightImageUrl, async (newUrl) => {
  if (newUrl) {
    rightIsPdf.value = await checkIfPdf(newUrl)
  } else {
    rightIsPdf.value = false
  }
})

const openImageModal = (imageUrl: string, title: string) => {
  modalImageUrl.value = imageUrl
  modalTitle.value = title
  modalType.value = 'image'
  showModal.value = true
}

const openDocumentModal = (url: string, title: string, type: 'pdf') => {
  modalImageUrl.value = url
  modalTitle.value = title
  modalType.value = type
  showModal.value = true
}

const closeImageModal = () => {
  showModal.value = false
  modalImageUrl.value = ''
  modalTitle.value = ''
  modalType.value = 'image'
}
</script>
