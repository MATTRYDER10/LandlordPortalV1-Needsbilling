<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[60] flex items-center justify-center">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/50" @click="close" />

      <!-- Modal -->
      <div class="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Report an Issue</h2>
          <button @click="close" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Body -->
        <form @submit.prevent="submit" class="px-6 py-4 space-y-4">
          <!-- Page (auto-filled) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Page</label>
            <input
              type="text"
              :value="currentPage"
              disabled
              class="w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-500 dark:text-gray-400"
            />
          </div>

          <!-- Title -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title <span class="text-red-500">*</span></label>
            <input
              v-model="form.title"
              type="text"
              placeholder="Brief summary of the issue"
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <!-- Severity -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Severity <span class="text-red-500">*</span></label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="s in severityOptions"
                :key="s.value"
                type="button"
                @click="form.severity = s.value"
                :class="[
                  'px-3 py-1.5 text-sm font-medium rounded-full border transition-colors',
                  form.severity === s.value
                    ? s.activeClass
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-400'
                ]"
              >
                {{ s.label }}
              </button>
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description <span class="text-red-500">*</span></label>
            <textarea
              v-model="form.description"
              rows="4"
              placeholder="Describe what happened, what you expected, and any steps to reproduce..."
              required
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
          </div>

          <!-- Entity Link (Optional) -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Link to entity (optional)</label>
            <div class="relative">
              <input
                v-model="entitySearchQuery"
                type="text"
                placeholder="Search for a property, tenancy, reference, or landlord..."
                @input="onEntitySearch"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <!-- Selected entity badge -->
              <div v-if="selectedEntity" class="mt-2 flex items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-xs font-medium">
                  {{ selectedEntity.type }}: {{ selectedEntity.label }}
                  <button type="button" @click="clearEntity" class="ml-1 hover:text-orange-900 dark:hover:text-orange-100">
                    <X class="w-3 h-3" />
                  </button>
                </span>
              </div>
              <!-- Search results dropdown -->
              <div
                v-if="entityResults.length > 0 && !selectedEntity"
                class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto"
              >
                <button
                  v-for="result in entityResults"
                  :key="result.type + result.id"
                  type="button"
                  @click="selectEntity(result)"
                  class="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                >
                  <span class="inline-flex items-center px-1.5 py-0.5 bg-gray-200 dark:bg-gray-500 text-gray-600 dark:text-gray-200 rounded text-xs font-medium uppercase">
                    {{ result.type }}
                  </span>
                  <span class="text-gray-900 dark:text-white truncate">{{ result.label }}</span>
                </button>
              </div>
              <div v-if="entityLoading" class="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg p-3 text-sm text-gray-500 dark:text-gray-400">
                Searching...
              </div>
            </div>
          </div>

          <!-- Screenshots -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Screenshots (up to 3)</label>
            <div class="flex gap-3 flex-wrap">
              <!-- Preview thumbnails -->
              <div
                v-for="(screenshot, index) in screenshots"
                :key="index"
                class="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-600 group"
              >
                <img :src="screenshot" class="w-full h-full object-cover" />
                <button
                  type="button"
                  @click="removeScreenshot(index)"
                  class="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X class="w-3 h-3" />
                </button>
              </div>
              <!-- Add button -->
              <label
                v-if="screenshots.length < 3"
                class="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center cursor-pointer hover:border-orange-400 transition-colors"
              >
                <ImagePlus class="w-6 h-6 text-gray-400" />
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  @change="onFileSelected"
                />
              </label>
            </div>
          </div>

          <!-- Submit -->
          <div class="flex justify-end gap-3 pt-2">
            <button
              type="button"
              @click="close"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="submitting || !form.title || !form.description || !form.severity"
              class="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
              {{ submitting ? 'Submitting...' : 'Submit Issue' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { X, ImagePlus, Loader2 } from 'lucide-vue-next'
import { useApi } from '@/composables/useApi'
import { useEntitySearch, type EntityResult } from '@/composables/useEntitySearch'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const route = useRoute()
const toast = useToast()
const { apiFetch } = useApi()
const { results: entityResults, loading: entityLoading, search: searchEntities, clear: clearEntitySearch } = useEntitySearch()

const currentPage = computed(() => route.fullPath)

const severityOptions = [
  { value: 'low' as const, label: 'Low', activeClass: 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
  { value: 'medium' as const, label: 'Medium', activeClass: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
  { value: 'high' as const, label: 'High', activeClass: 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' },
  { value: 'critical' as const, label: 'Critical', activeClass: 'border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300' }
]

const form = ref({
  title: '',
  description: '',
  severity: '' as string
})

const entitySearchQuery = ref('')
const selectedEntity = ref<EntityResult | null>(null)
const screenshots = ref<string[]>([])
const submitting = ref(false)

function onEntitySearch() {
  if (selectedEntity.value) return
  searchEntities(entitySearchQuery.value)
}

function selectEntity(entity: EntityResult) {
  selectedEntity.value = entity
  entitySearchQuery.value = ''
  clearEntitySearch()
}

function clearEntity() {
  selectedEntity.value = null
  entitySearchQuery.value = ''
  clearEntitySearch()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (screenshots.value.length >= 3) return

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') {
      screenshots.value.push(reader.result)
    }
  }
  reader.readAsDataURL(file)

  // Reset input so the same file can be selected again
  input.value = ''
}

function removeScreenshot(index: number) {
  screenshots.value.splice(index, 1)
}

function close() {
  emit('close')
}

function resetForm() {
  form.value = { title: '', description: '', severity: '' }
  selectedEntity.value = null
  entitySearchQuery.value = ''
  screenshots.value = []
  clearEntitySearch()
}

async function submit() {
  if (!form.value.title || !form.value.description || !form.value.severity) return

  submitting.value = true
  try {
    const body: Record<string, unknown> = {
      page: currentPage.value,
      title: form.value.title,
      description: form.value.description,
      severity: form.value.severity,
      screenshots: screenshots.value.length > 0 ? screenshots.value : undefined
    }

    if (selectedEntity.value) {
      body.entityType = selectedEntity.value.type
      body.entityId = selectedEntity.value.id
      body.entityLabel = selectedEntity.value.label
    }

    const response = await apiFetch('/api/support/report', {
      method: 'POST',
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: 'Failed to submit issue' }))
      throw new Error(data.error || 'Failed to submit issue')
    }

    const data = await response.json()
    toast.success(`Issue #${data.issueNumber} submitted successfully`)
    resetForm()
    close()
  } catch (err: any) {
    toast.error(err.message || 'Failed to submit issue')
  } finally {
    submitting.value = false
  }
}
</script>
