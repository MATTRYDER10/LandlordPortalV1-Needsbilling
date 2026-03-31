<template>
  <div class="max-w-4xl">
    <div class="bg-white dark:bg-slate-900 rounded-lg shadow dark:shadow-slate-900/50 p-6">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Landlord Service Types</h3>
          <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">Configure service types and default fees for properties</p>
        </div>
        <button
          @click="showAddForm = true"
          class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md"
        >
          Add Service Type
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="text-center py-8 text-gray-500 dark:text-slate-400">Loading...</div>

      <!-- Service Types Table -->
      <div v-else>
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200 dark:border-slate-700">
              <th class="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400">Name</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400">Management Fee %</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400">Letting/Setup Fee</th>
              <th class="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400">Fee Type</th>
              <th class="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="st in serviceTypes"
              :key="st.id"
              class="border-b border-gray-100 dark:border-slate-800"
            >
              <!-- Editing row -->
              <template v-if="editingId === st.id">
                <td class="py-3 px-4">
                  <input
                    v-model="editForm.name"
                    class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded"
                  />
                </td>
                <td class="py-3 px-4">
                  <input
                    v-model.number="editForm.default_fee_percent"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    class="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded"
                    placeholder="e.g. 7.08"
                  />
                </td>
                <td class="py-3 px-4">
                  <input
                    v-model.number="editForm.default_letting_fee_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    class="w-24 px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded"
                    placeholder="Amount"
                  />
                </td>
                <td class="py-3 px-4">
                  <select
                    v-model="editForm.default_letting_fee_type"
                    class="px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded"
                  >
                    <option value="">None</option>
                    <option value="fixed">Fixed (£)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </td>
                <td class="py-3 px-4 text-right">
                  <button @click="saveEdit(st.id)" class="text-sm text-primary hover:text-primary/80 mr-3" :disabled="saving">
                    {{ saving ? 'Saving...' : 'Save' }}
                  </button>
                  <button @click="cancelEdit" class="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">
                    Cancel
                  </button>
                </td>
              </template>

              <!-- Display row -->
              <template v-else>
                <td class="py-3 px-4">
                  <span class="text-sm text-gray-900 dark:text-white font-medium">{{ st.name }}</span>
                  <span v-if="st.is_default" class="ml-2 text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">Default</span>
                </td>
                <td class="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">
                  {{ st.default_fee_percent != null ? st.default_fee_percent + '%' : '—' }}
                </td>
                <td class="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">
                  {{ st.default_letting_fee_amount != null ? formatFeeAmount(st) : '—' }}
                </td>
                <td class="py-3 px-4 text-sm text-gray-700 dark:text-slate-300">
                  {{ st.default_letting_fee_type === 'fixed' ? 'Fixed (£)' : st.default_letting_fee_type === 'percentage' ? 'Percentage (%)' : '—' }}
                </td>
                <td class="py-3 px-4 text-right">
                  <button @click="startEdit(st)" class="text-sm text-primary hover:text-primary/80 mr-3">Edit</button>
                  <button
                    v-if="!st.is_default"
                    @click="deleteServiceType(st.id)"
                    class="text-sm text-red-500 hover:text-red-700"
                    :disabled="deleting === st.id"
                  >
                    {{ deleting === st.id ? 'Deleting...' : 'Delete' }}
                  </button>
                </td>
              </template>
            </tr>
          </tbody>
        </table>

        <!-- Add Form -->
        <div v-if="showAddForm" class="mt-4 p-4 border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <h4 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">New Service Type</h4>
          <div class="grid grid-cols-4 gap-3">
            <div>
              <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Name</label>
              <input
                v-model="addForm.name"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded"
                placeholder="Service type name"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Default Fee %</label>
              <input
                v-model.number="addForm.default_fee_percent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded"
                placeholder="e.g. 7.08"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Letting Fee</label>
              <input
                v-model.number="addForm.default_letting_fee_amount"
                type="number"
                step="0.01"
                min="0"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded"
                placeholder="Amount"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Fee Type</label>
              <select
                v-model="addForm.default_letting_fee_type"
                class="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white rounded"
              >
                <option value="">None</option>
                <option value="fixed">Fixed (£)</option>
                <option value="percentage">Percentage (%)</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2 mt-3">
            <button
              @click="addServiceType"
              :disabled="saving || !addForm.name?.trim()"
              class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded disabled:opacity-50"
            >
              {{ saving ? 'Adding...' : 'Add' }}
            </button>
            <button
              @click="showAddForm = false"
              class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>

        <div v-if="errorMsg" class="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ errorMsg }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useApi } from '../../composables/useApi'

const { get, post, put, del } = useApi()

interface ServiceType {
  id: string
  name: string
  is_default: boolean
  default_fee_percent: number | null
  default_letting_fee_amount: number | null
  default_letting_fee_type: string | null
  sort_order: number
}

const serviceTypes = ref<ServiceType[]>([])
const loading = ref(true)
const saving = ref(false)
const deleting = ref<string | null>(null)
const errorMsg = ref('')
const showAddForm = ref(false)
const editingId = ref<string | null>(null)

const editForm = ref({
  name: '',
  default_fee_percent: null as number | null,
  default_letting_fee_amount: null as number | null,
  default_letting_fee_type: '' as string
})

const addForm = ref({
  name: '',
  default_fee_percent: null as number | null,
  default_letting_fee_amount: null as number | null,
  default_letting_fee_type: '' as string
})

function formatFeeAmount(st: ServiceType) {
  if (st.default_letting_fee_type === 'percentage') return st.default_letting_fee_amount + '%'
  return '£' + Number(st.default_letting_fee_amount).toFixed(2)
}

async function fetchServiceTypes() {
  loading.value = true
  errorMsg.value = ''
  try {
    serviceTypes.value = await get<ServiceType[]>('/api/service-types')
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to load service types'
  } finally {
    loading.value = false
  }
}

function startEdit(st: ServiceType) {
  editingId.value = st.id
  editForm.value = {
    name: st.name,
    default_fee_percent: st.default_fee_percent,
    default_letting_fee_amount: st.default_letting_fee_amount,
    default_letting_fee_type: st.default_letting_fee_type || ''
  }
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(id: string) {
  saving.value = true
  errorMsg.value = ''
  try {
    await put(`/api/service-types/${id}`, {
      name: editForm.value.name,
      default_fee_percent: editForm.value.default_fee_percent,
      default_letting_fee_amount: editForm.value.default_letting_fee_amount,
      default_letting_fee_type: editForm.value.default_letting_fee_type || null
    })
    editingId.value = null
    await fetchServiceTypes()
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function addServiceType() {
  saving.value = true
  errorMsg.value = ''
  try {
    await post('/api/service-types', {
      name: addForm.value.name,
      default_fee_percent: addForm.value.default_fee_percent,
      default_letting_fee_amount: addForm.value.default_letting_fee_amount,
      default_letting_fee_type: addForm.value.default_letting_fee_type || null
    })
    showAddForm.value = false
    addForm.value = { name: '', default_fee_percent: null, default_letting_fee_amount: null, default_letting_fee_type: '' }
    await fetchServiceTypes()
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to add service type'
  } finally {
    saving.value = false
  }
}

async function deleteServiceType(id: string) {
  if (!confirm('Are you sure you want to delete this service type?')) return
  deleting.value = id
  errorMsg.value = ''
  try {
    await del(`/api/service-types/${id}`)
    await fetchServiceTypes()
  } catch (err: any) {
    errorMsg.value = err.message || 'Failed to delete'
  } finally {
    deleting.value = null
  }
}

onMounted(fetchServiceTypes)
</script>
