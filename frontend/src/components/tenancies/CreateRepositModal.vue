<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-slate-900 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <img src="/reposit-logo.png" alt="Reposit" class="h-7 w-auto" />
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Create Reposit</h3>
                <p class="text-sm text-gray-500 dark:text-slate-400">Deposit replacement for tenants</p>
              </div>
            </div>
            <button
              @click="$emit('close')"
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-6 space-y-6">
            <!-- Pricing Summary -->
            <div v-if="pricing" class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <h4 class="text-sm font-medium text-purple-800 dark:text-purple-300 mb-2">Pricing Summary</h4>
              <div class="space-y-1 text-sm">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-slate-400">Monthly Rent</span>
                  <span class="font-medium text-gray-900 dark:text-white">&pound;{{ pricing.monthlyRent?.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-slate-400">Number of Tenants</span>
                  <span class="font-medium text-gray-900 dark:text-white">{{ pricing.headcount }}</span>
                </div>
                <div class="flex justify-between pt-2 border-t border-purple-200 dark:border-purple-700 mt-2">
                  <span class="text-gray-600 dark:text-slate-400">Fee per Tenant</span>
                  <span class="font-medium text-purple-700 dark:text-purple-300">&pound;{{ pricing.perTenantFee?.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="font-medium text-gray-700 dark:text-slate-300">Total Fee</span>
                  <span class="font-bold text-purple-700 dark:text-purple-300">&pound;{{ pricing.totalFee?.toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <!-- Eligibility Status -->
            <div v-if="eligibility" class="rounded-lg p-4" :class="eligibility.allEligible ? 'bg-green-50 dark:bg-green-900/20' : 'bg-amber-50 dark:bg-amber-900/20'">
              <div class="flex items-start gap-3">
                <CheckCircle v-if="eligibility.allEligible" class="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <AlertCircle v-else class="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <div>
                  <h4 class="text-sm font-medium" :class="eligibility.allEligible ? 'text-green-800 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'">
                    {{ eligibility.allEligible ? 'All Tenants Eligible' : 'Some Tenants May Need Guarantors' }}
                  </h4>
                  <p class="text-sm mt-1" :class="eligibility.allEligible ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'">
                    {{ eligibility.allEligible
                      ? 'All tenants have passed identity, affordability, credit, and Right to Rent checks.'
                      : 'Some tenants did not meet all eligibility criteria. They may need guarantors.'
                    }}
                  </p>
                </div>
              </div>

              <!-- Tenant Details -->
              <div v-if="eligibility.tenants?.length" class="mt-4 space-y-2">
                <div
                  v-for="tenant in eligibility.tenants"
                  :key="tenant.referenceId"
                  class="flex items-center justify-between text-sm"
                >
                  <span class="text-gray-700 dark:text-slate-300">{{ tenant.tenantName }}</span>
                  <span
                    class="px-2 py-0.5 rounded-full text-xs font-medium"
                    :class="tenant.eligibility.eligible
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'"
                  >
                    {{ tenant.eligibility.eligible ? 'Eligible' : 'Not Eligible' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Agent Selection -->
            <div v-if="agents.length > 0">
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Reposit Agent</label>
              <select
                v-model="selectedAgentId"
                class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-purple-500 focus:border-purple-500 dark:bg-slate-800 dark:text-white"
              >
                <option value="">Use default agent</option>
                <option v-for="agent in agents" :key="agent.id" :value="agent.id">
                  {{ agent.displayName }}
                </option>
              </select>
            </div>

            <!-- Publish Option -->
            <div class="flex items-start gap-3">
              <input
                id="publish-immediately"
                v-model="publishImmediately"
                type="checkbox"
                class="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 dark:border-slate-600 rounded"
              />
              <label for="publish-immediately" class="text-sm text-gray-700 dark:text-slate-300">
                <span class="font-medium">Send to tenants immediately</span>
                <p class="text-gray-500 dark:text-slate-400 mt-0.5">
                  If unchecked, the Reposit will be created as a draft and you can publish it later.
                </p>
              </label>
            </div>

            <!-- Info -->
            <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
              <h4 class="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">What happens next?</h4>
              <ul class="text-sm text-gray-600 dark:text-slate-400 space-y-1 list-disc list-inside">
                <li>Tenants receive an email from Reposit to sign and pay</li>
                <li>Each tenant pays their individual fee</li>
                <li>Once all tenants complete, coverage is active</li>
                <li>Landlord is protected for up to 12 weeks rent equivalent</li>
              </ul>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-end gap-3">
            <button
              type="button"
              @click="$emit('close')"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleCreate"
              :disabled="creating"
              class="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              <Loader2 v-if="creating" class="w-4 h-4 animate-spin" />
              <Sparkles v-else class="w-4 h-4" />
              {{ creating ? 'Creating...' : 'Create Reposit' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { X, Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-vue-next'
import { API_URL } from '@/lib/apiUrl'
import { authFetch } from '@/lib/authFetch'

const props = defineProps<{
  show: boolean
  tenancyId: string
  pricing?: {
    totalFee: number
    perTenantFee: number
    monthlyRent: number
    headcount: number
  } | null
  eligibility?: {
    allEligible: boolean
    notes?: string
    tenants?: any[]
  } | null
}>()

const emit = defineEmits<{
  close: []
  created: [repositId: string]
}>()

const authStore = useAuthStore()
const creating = ref(false)
const agents = ref<Array<{ id: string; displayName: string }>>([])
const selectedAgentId = ref('')
const publishImmediately = ref(true)

const loadAgents = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(
      `${API_URL}/api/settings/reposit/agents`,
      { token }
    )

    if (response.ok) {
      const data = await response.json()
      agents.value = (data.agents || []).map((a: any) => ({
        id: a.id,
        displayName: [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email || a.id
      }))
    }
  } catch (error) {
    console.error('Error loading agents:', error)
  }
}

const handleCreate = async () => {
  creating.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const payload = {
      tenancyId: props.tenancyId,
      agentId: selectedAgentId.value || undefined,
      publishImmediately: publishImmediately.value
    }
    console.log('[CreateRepositModal] Sending create request with payload:', payload)

    const response = await authFetch(
      `${API_URL}/api/reposit/create`,
      {
        token,
        method: 'POST',
        body: JSON.stringify(payload)
      }
    )

    if (response.ok) {
      const data = await response.json()
      emit('created', data.repositId)
    } else {
      const data = await response.json()
      throw new Error(data.error || 'Failed to create Reposit')
    }
  } catch (error: any) {
    console.error('Error creating Reposit:', error)
    alert(error.message || 'Failed to create Reposit')
  } finally {
    creating.value = false
  }
}

onMounted(() => {
  loadAgents()
})
</script>
