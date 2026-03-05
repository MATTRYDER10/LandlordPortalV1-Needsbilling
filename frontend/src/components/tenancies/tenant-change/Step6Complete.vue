<script setup lang="ts">
import { ref, computed } from 'vue'
import { CheckCircle, AlertTriangle, Calendar, ArrowRight, UserMinus, UserPlus } from 'lucide-vue-next'

interface Tenant {
  id: string
  first_name: string
  last_name: string
}

interface IncomingTenant {
  firstName: string
  lastName: string
  email?: string
}

interface TenantChange {
  id: string
  outgoing_tenant_ids: string[]
  incoming_tenants: IncomingTenant[]
  changeover_date: string | null
  addendum_fully_signed_at: string | null
  completed_at: string | null
}

const props = defineProps<{
  tenantChange: TenantChange
  tenants: Tenant[]
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'complete'): void
}>()

const error = ref('')

const outgoingTenantNames = computed(() => {
  return props.tenantChange.outgoing_tenant_ids.map(id => {
    const tenant = props.tenants.find(t => t.id === id)
    return tenant ? `${tenant.first_name} ${tenant.last_name}` : 'Unknown Tenant'
  })
})

// Move to Step 7 (checklist) - actual completion happens there
function proceedToChecklist() {
  emit('complete')
}
</script>

<template>
  <div class="space-y-6">
    <div class="text-center">
      <div class="w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle class="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Ready to Complete
      </h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">
        All signatures have been collected. Complete the changeover to update the tenancy.
      </p>
    </div>

    <!-- Error -->
    <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
      <div class="flex items-center gap-2 text-red-700 dark:text-red-400">
        <AlertTriangle class="w-4 h-4" />
        <span class="text-sm">{{ error }}</span>
      </div>
    </div>

    <!-- Summary Card -->
    <div class="p-6 bg-gray-50 dark:bg-slate-800 rounded-lg space-y-6">
      <h4 class="font-semibold text-gray-900 dark:text-white">Change Summary</h4>

      <!-- Changeover Date -->
      <div class="flex items-center gap-3 p-3 bg-white dark:bg-slate-700 rounded-lg">
        <Calendar class="w-5 h-5 text-orange-500" />
        <div>
          <p class="text-sm text-gray-500 dark:text-slate-400">Changeover Date</p>
          <p class="font-medium text-gray-900 dark:text-white">
            {{ tenantChange.changeover_date
              ? new Date(tenantChange.changeover_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
              : 'Not set' }}
          </p>
        </div>
      </div>

      <!-- Outgoing Tenants -->
      <div class="p-4 bg-red-50 dark:bg-red-900/30 rounded-lg border border-red-200 dark:border-red-800">
        <div class="flex items-center gap-2 mb-3">
          <UserMinus class="w-5 h-5 text-red-500" />
          <h5 class="font-medium text-red-700 dark:text-red-400">Outgoing Tenant(s)</h5>
        </div>
        <ul class="space-y-1">
          <li v-for="name in outgoingTenantNames" :key="name" class="text-sm text-red-600 dark:text-red-300">
            {{ name }}
          </li>
        </ul>
        <p class="mt-2 text-xs text-red-500 dark:text-red-400">
          Will be marked as inactive on the tenancy
        </p>
      </div>

      <!-- Arrow -->
      <div class="flex justify-center">
        <ArrowRight class="w-6 h-6 text-gray-400 dark:text-slate-500" />
      </div>

      <!-- Incoming Tenants -->
      <div class="p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
        <div class="flex items-center gap-2 mb-3">
          <UserPlus class="w-5 h-5 text-green-500" />
          <h5 class="font-medium text-green-700 dark:text-green-400">Incoming Tenant(s)</h5>
        </div>
        <ul class="space-y-1">
          <li v-for="(tenant, index) in tenantChange.incoming_tenants" :key="index" class="text-sm text-green-600 dark:text-green-300">
            {{ tenant.firstName }} {{ tenant.lastName }}
            <span v-if="tenant.email" class="text-green-500 dark:text-green-400">({{ tenant.email }})</span>
          </li>
        </ul>
        <p class="mt-2 text-xs text-green-500 dark:text-green-400">
          Will be added as active tenants
        </p>
      </div>
    </div>

    <!-- Continue to Checklist -->
    <div class="flex justify-center">
      <button
        @click="proceedToChecklist"
        class="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
      >
        <CheckCircle class="w-5 h-5" />
        Continue to Final Checklist
      </button>
    </div>

    <p class="text-center text-sm text-gray-500 dark:text-slate-400 mt-3">
      Complete the post-completion checklist in the next step to finalize the tenant change.
    </p>
  </div>
</template>
