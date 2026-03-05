<template>
  <div class="evidence-preview" @click="openFullView">
    <div class="preview-container">
      <!-- Loading State -->
      <div v-if="loading" class="preview-loading">
        <svg class="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>

      <!-- Error State -->
      <div v-else-if="imageError" class="preview-error">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span class="error-text">Failed to load</span>
      </div>

      <!-- PDF Preview -->
      <div v-else-if="isPdf" class="preview-pdf">
        <FileText class="pdf-icon" />
        <span class="file-type">PDF</span>
      </div>

      <!-- Image Preview -->
      <img
        v-else-if="isImage && blobUrl"
        :src="previewUrl"
        :alt="fileName"
        class="preview-image"
        @error="handleImageError"
      />

      <!-- Generic File -->
      <div v-else class="preview-generic">
        <FileText class="file-icon" />
        <span class="file-type">{{ fileExtension.toUpperCase() }}</span>
      </div>
    </div>

    <div class="preview-info">
      <p class="file-name" :title="fileName">{{ truncatedFileName }}</p>
      <p v-if="uploadedAt" class="upload-date">{{ formatDate(uploadedAt) }}</p>
    </div>

    <div class="preview-actions">
      <button class="action-btn view" @click.stop="openFullView" title="View">
        <Eye />
      </button>
      <a :href="previewUrl" target="_blank" class="action-btn download" @click.stop title="Download">
        <Download />
      </a>
    </div>
  </div>

  <!-- Full View Modal -->
  <Teleport to="body">
    <div v-if="showFullView" class="full-view-overlay" @click="closeFullView">
      <div class="full-view-container" @click.stop>
        <div class="full-view-header">
          <h3 class="full-view-title">{{ fileName }}</h3>
          <div class="full-view-actions">
            <a :href="previewUrl" target="_blank" class="full-view-btn">
              <ExternalLink />
              Open in new tab
            </a>
            <button class="full-view-close" @click="closeFullView">
              <X />
            </button>
          </div>
        </div>
        <div class="full-view-content">
          <div v-if="imageError" class="full-view-error">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p class="error-title">Failed to load document</p>
            <p class="error-subtitle">The file could not be loaded. It may have been deleted or you may not have permission to view it.</p>
            <a :href="previewUrl" target="_blank" class="download-link">Try downloading instead</a>
          </div>
          <iframe
            v-else-if="isPdf && blobUrl"
            :src="blobUrl"
            class="full-view-pdf"
            frameborder="0"
          />
          <div v-else-if="isPdf && !blobUrl && !imageError" class="full-view-loading">
            <svg class="animate-spin" width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="white" stroke-width="4"></circle>
              <path class="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="loading-text">Loading PDF...</p>
          </div>
          <img
            v-else-if="isImage"
            :src="previewUrl"
            :alt="fileName"
            class="full-view-image"
          />
          <div v-else class="full-view-unsupported">
            <FileText class="unsupported-icon" />
            <p>Preview not available</p>
            <a :href="previewUrl" target="_blank" class="download-link">Download file</a>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { FileText, Eye, Download, ExternalLink, X } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const props = defineProps<{
  url: string
  fileName: string
  fileType?: string
  uploadedAt?: string
}>()

const authStore = useAuthStore()
const token = computed(() => authStore.session?.access_token || '')
const showFullView = ref(false)
const imageError = ref(false)
const blobUrl = ref<string | null>(null)
const loading = ref(false)

// Load file as blob through backend proxy (works for both images and PDFs)
async function loadImageAsBlob() {
  if (!token.value || !props.url) {
    return
  }

  // Skip if not a storage path (already a full URL)
  if (props.url.startsWith('http://') || props.url.startsWith('https://') || props.url.startsWith('blob:')) {
    blobUrl.value = props.url
    return
  }

  loading.value = true
  try {
    // Parse file path: referenceId/folder/filename
    const parts = props.url.split('/')
    if (parts.length !== 3) {
      console.error('Invalid file path format. Expected: referenceId/folder/filename, got:', props.url)
      return
    }

    const [refId, folder, filename] = parts as [string, string, string]
    const downloadUrl = `${API_BASE}/api/staff/download/${refId}/${folder}/${encodeURIComponent(filename)}`

    const response = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${token.value}`
      }
    })

    if (!response.ok) {
      console.error('Failed to load evidence file:', response.status, response.statusText)
      imageError.value = true
      return
    }

    const blob = await response.blob()
    blobUrl.value = URL.createObjectURL(blob)
  } catch (err) {
    console.error('Failed to load evidence file:', err)
    imageError.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadImageAsBlob()
})

watch(() => props.url, () => {
  loadImageAsBlob()
})

const fileExtension = computed(() => {
  const ext = props.fileName.split('.').pop()?.toLowerCase() || ''
  return ext
})

const isPdf = computed(() => {
  return fileExtension.value === 'pdf' || props.fileType === 'application/pdf'
})

const isImage = computed(() => {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
  return imageExtensions.includes(fileExtension.value)
    props.fileType?.startsWith('image/')
    false
})

const previewUrl = computed(() => {
  return blobUrl.value || props.url
})

const truncatedFileName = computed(() => {
  if (props.fileName.length > 25) {
    const ext = fileExtension.value
    const name = props.fileName.slice(0, -(ext.length + 1))
    return name.slice(0, 20) + '...' + ext
  }
  return props.fileName
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const handleImageError = () => {
  imageError.value = true
}

const openFullView = () => {
  showFullView.value = true
  document.body.style.overflow = 'hidden'
}

const closeFullView = () => {
  showFullView.value = false
  document.body.style.overflow = ''
}
</script>

<style scoped>
.evidence-preview {
  display: flex;
  flex-direction: column;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.evidence-preview:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 8px rgba(249, 115, 22, 0.1);
}

.preview-container {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

.preview-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.preview-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #ef4444;
}

.preview-error svg {
  width: 2rem;
  height: 2rem;
}

.error-text {
  font-size: 0.75rem;
  font-weight: 500;
}

.preview-pdf,
.preview-generic {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.pdf-icon,
.file-icon {
  width: 2.5rem;
  height: 2.5rem;
  color: #9ca3af;
}

.file-type {
  font-size: 0.625rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-info {
  padding: 0.5rem;
  flex: 1;
}

.file-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: #374151;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.upload-date {
  font-size: 0.625rem;
  color: #9ca3af;
  margin: 0.25rem 0 0;
}

.preview-actions {
  display: flex;
  border-top: 1px solid #e5e7eb;
}

.action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  text-decoration: none;
  transition: background 0.2s, color 0.2s;
}

.action-btn:hover {
  background: #f3f4f6;
  color: var(--color-primary);
}

.action-btn svg {
  width: 1rem;
  height: 1rem;
}

.action-btn.view {
  border-right: 1px solid #e5e7eb;
}

/* Full View Modal */
.full-view-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.full-view-container {
  background: white;
  border-radius: 0.5rem;
  width: 100%;
  max-width: 1200px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.full-view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
}

.full-view-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.full-view-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.full-view-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f3f4f6;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  color: #4b5563;
  text-decoration: none;
  cursor: pointer;
  transition: background 0.2s;
}

.full-view-btn:hover {
  background: #e5e7eb;
}

.full-view-btn svg {
  width: 1rem;
  height: 1rem;
}

.full-view-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

.full-view-close:hover {
  background: #f3f4f6;
}

.full-view-close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.full-view-content {
  flex: 1;
  overflow: auto;
  background: #1f2937;
}

.full-view-pdf {
  width: 100%;
  height: 80vh;
}

.full-view-image {
  max-width: 100%;
  max-height: 80vh;
  display: block;
  margin: 0 auto;
}

.full-view-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  padding: 2rem;
  color: white;
}

.full-view-error svg {
  color: #ef4444;
  margin-bottom: 1.5rem;
}

.error-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0 0 0.5rem;
}

.error-subtitle {
  font-size: 0.875rem;
  color: #9ca3af;
  max-width: 400px;
  text-align: center;
  margin: 0 0 1.5rem;
}

.full-view-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  color: white;
}

.loading-text {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: #9ca3af;
}

.full-view-unsupported {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: white;
}

.unsupported-icon {
  width: 4rem;
  height: 4rem;
  color: #9ca3af;
  margin-bottom: 1rem;
}

.download-link {
  margin-top: 1rem;
  padding: 0.5rem 1rem;
  background: var(--color-primary);
  color: white;
  text-decoration: none;
  border-radius: 0.25rem;
}

.download-link:hover {
  background: #ea580c;
}
</style>
