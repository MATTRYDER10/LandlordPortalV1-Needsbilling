<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="$emit('close')"
    >
      <div class="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-xl">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Send Landlord Compliance Pack</h3>
            <p class="text-sm text-gray-500 dark:text-slate-400 mt-1">{{ propertyAddress }}</p>
          </div>
          <button
            @click="$emit('close')"
            class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="px-6 py-4 overflow-y-auto flex-1 space-y-6">
          <!-- Compliance Documents Section -->
          <div>
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Compliance Documents
            </h4>
            <div class="space-y-2">
              <!-- Signed Agreement -->
              <label
                v-if="signedAgreementUrl"
                class="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg cursor-pointer"
              >
                <input
                  type="checkbox"
                  v-model="includeAgreement"
                  class="w-4 h-4 text-primary border-gray-300 dark:border-slate-600 rounded focus:ring-primary"
                />
                <FileText class="w-5 h-5 text-green-600" />
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">Signed Tenancy Agreement</span>
                  <span class="text-xs text-green-600 ml-2">Fully Executed</span>
                </div>
              </label>

              <label
                v-for="doc in complianceDocuments"
                :key="doc.id"
                class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  v-model="selectedDocuments"
                  :value="doc.id"
                  class="w-4 h-4 text-primary border-gray-300 dark:border-slate-600 rounded focus:ring-primary"
                />
                <component :is="getDocIcon(doc.type)" class="w-5 h-5 text-gray-500 dark:text-slate-400" />
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ formatDocType(doc.type) }}</span>
                  <span v-if="doc.expiry_date" class="text-xs text-gray-500 dark:text-slate-400 ml-2">
                    Expires {{ formatDate(doc.expiry_date) }}
                  </span>
                </div>
              </label>

              <p v-if="complianceDocuments.length === 0" class="text-sm text-gray-500 dark:text-slate-400 italic py-2">
                No compliance documents available for this property.
              </p>
            </div>
          </div>

          <!-- Property Documents Section -->
          <div v-if="propertyDocs.length > 0" class="border-t border-gray-200 dark:border-slate-700 pt-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Property Documents
            </h4>
            <div class="space-y-2">
              <label
                v-for="doc in propertyDocs"
                :key="doc.id"
                class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                <input
                  type="checkbox"
                  v-model="selectedDocuments"
                  :value="doc.id"
                  class="w-4 h-4 text-primary border-gray-300 dark:border-slate-600 rounded focus:ring-primary"
                />
                <FileText class="w-5 h-5 text-gray-500 dark:text-slate-400" />
                <div class="flex-1">
                  <span class="text-sm font-medium text-gray-900 dark:text-white">{{ doc.file_name }}</span>
                </div>
              </label>
            </div>
          </div>

          <!-- Additional Information Section -->
          <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Additional Information
            </h4>
            <textarea
              v-model="additionalInfo"
              rows="4"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              placeholder="Add any additional information to include in the email..."
            ></textarea>
          </div>

          <!-- Recipients Preview -->
          <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
            <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3">
              Recipients
            </h4>
            <div v-if="landlordsWithEmail.length === 0" class="text-sm text-amber-600 dark:text-amber-400">
              No landlords with email addresses linked to this property.
            </div>
            <div v-else class="flex flex-wrap gap-2">
              <div
                v-for="landlord in landlordsWithEmail"
                :key="landlord.landlord_id"
                class="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 rounded-full text-sm"
              >
                <Mail class="w-4 h-4 text-gray-500 dark:text-slate-400" />
                <span class="font-medium text-gray-900 dark:text-white">{{ landlord.name }}</span>
                <span class="text-gray-500 dark:text-slate-400">{{ landlord.email }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 flex-shrink-0 rounded-b-xl">
          <p class="text-sm text-gray-500 dark:text-slate-400">
            {{ selectedDocuments.length }} documents selected
          </p>
          <div class="flex items-center gap-3">
            <button
              @click="$emit('close')"
              class="px-4 py-2 text-gray-700 dark:text-slate-300 font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              @click="handleSend"
              :disabled="sending || landlordsWithEmail.length === 0 || (selectedDocuments.length === 0 && !includeAgreement)"
              class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <Send v-if="!sending" class="w-4 h-4" />
              <Loader2 v-else class="w-4 h-4 animate-spin" />
              {{ sending ? 'Sending...' : 'Send Landlord Pack' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import {
  X, Mail, Send, Loader2, FileText, Flame, Zap, ShieldCheck,
  Droplets, BellRing, PlugZap
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from 'vue-toastification'
import { authFetch } from '@/lib/authFetch'
import { API_URL } from '@/lib/apiUrl'
const authStore = useAuthStore()
const toast = useToast()

interface PropertyLandlord {
  landlord_id: string
  name: string
  email: string
  is_primary_contact: boolean
  ownership_percentage: number
}

interface ComplianceDoc {
  id: string
  type: string
  file_url: string
  expiry_date: string | null
}

interface PropertyDoc {
  id: string
  file_name: string
  file_path: string
}

const props = withDefaults(defineProps<{
  show: boolean
  propertyId: string
  propertyAddress?: string
  landlords?: PropertyLandlord[]
  complianceDocuments?: ComplianceDoc[]
  propertyDocs?: PropertyDoc[]
  signedAgreementUrl?: string | null
}>(), {
  propertyAddress: '',
  landlords: () => [],
  complianceDocuments: () => [],
  propertyDocs: () => [],
  signedAgreementUrl: null
})

const emit = defineEmits<{
  close: []
  sent: []
}>()

// State
const sending = ref(false)
const selectedDocuments = ref<string[]>([])
const includeAgreement = ref(false)
const additionalInfo = ref('')

// Computed
const landlordsWithEmail = computed(() =>
  props.landlords.filter(l => l.email && l.email.trim())
)

// Pre-select all compliance documents when modal opens
watch(() => props.show, (isOpen) => {
  if (isOpen) {
    selectedDocuments.value = props.complianceDocuments.map(d => d.id)
    includeAgreement.value = !!props.signedAgreementUrl
    additionalInfo.value = ''
  }
})

// Helpers
const getDocIcon = (type: string) => {
  const icons: Record<string, any> = {
    gas_safety: Flame,
    epc: Zap,
    eicr: PlugZap,
    fire_safety: ShieldCheck,
    legionella: Droplets,
    smoke_alarm: BellRing
  }
  return icons[type] || FileText
}

const formatDocType = (type: string): string => {
  const labels: Record<string, string> = {
    gas_safety: 'Gas Safety Certificate',
    epc: 'Energy Performance Certificate (EPC)',
    eicr: 'Electrical Safety Certificate (EICR)',
    fire_safety: 'Fire Safety Certificate',
    legionella: 'Legionella Risk Assessment',
    smoke_alarm: 'Smoke & CO Alarms Certificate',
    pat_testing: 'PAT Testing Certificate'
  }
  return labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

// Send handler
const handleSend = async () => {
  if (landlordsWithEmail.value.length === 0) {
    toast.error('No landlords with email addresses')
    return
  }

  if (selectedDocuments.value.length === 0 && !includeAgreement.value) {
    toast.error('Please select at least one document')
    return
  }

  sending.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const response = await authFetch(
      `${API_URL}/api/properties/${props.propertyId}/landlord-move-in-pack`,
      {
        method: 'POST',
        token,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          selectedDocuments: selectedDocuments.value,
          additionalInfo: additionalInfo.value,
          signedAgreementUrl: includeAgreement.value ? props.signedAgreementUrl : null
        })
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to send landlord pack')
    }

    toast.success(`Landlord compliance pack sent to ${landlordsWithEmail.value.length} landlord(s)`)
    emit('sent')
    emit('close')
  } catch (error: any) {
    console.error('Error sending landlord pack:', error)
    toast.error(error.message || 'Failed to send landlord pack')
  } finally {
    sending.value = false
  }
}
</script>
