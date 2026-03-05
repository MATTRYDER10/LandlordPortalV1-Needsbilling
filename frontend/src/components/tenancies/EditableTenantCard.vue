<template>
  <div class="border border-gray-200 dark:border-slate-700 rounded-lg p-4 transition-all bg-white dark:bg-slate-800" :class="{ 'border-primary bg-primary/5 dark:bg-primary/10': isEditing }">
    <!-- View Mode -->
    <div v-if="!isEditing" class="flex items-start justify-between">
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <User class="w-4 h-4 text-gray-400 dark:text-slate-500" />
          <h4 class="font-medium text-gray-900 dark:text-white">
            {{ tenant.first_name }} {{ tenant.last_name }}
          </h4>
          <span
            v-if="tenant.is_lead_tenant"
            class="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full"
          >
            Lead
          </span>
          <span
            v-if="tenant.status !== 'active'"
            class="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 rounded-full"
          >
            {{ tenant.status }}
          </span>
        </div>
        <div class="mt-2 space-y-1">
          <p v-if="tenant.email" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
            <Mail class="w-3 h-3 text-gray-400 dark:text-slate-500" />
            <a :href="`mailto:${tenant.email}`" class="hover:text-primary">{{ tenant.email }}</a>
          </p>
          <p v-else class="text-sm text-gray-400 dark:text-slate-500 flex items-center gap-2">
            <Mail class="w-3 h-3 text-gray-300 dark:text-slate-600" />
            No email
          </p>
          <p v-if="tenant.phone" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
            <Phone class="w-3 h-3 text-gray-400 dark:text-slate-500" />
            <a :href="`tel:${tenant.phone}`" class="hover:text-primary">{{ tenant.phone }}</a>
          </p>
          <p v-else class="text-sm text-gray-400 dark:text-slate-500 flex items-center gap-2">
            <Phone class="w-3 h-3 text-gray-300 dark:text-slate-600" />
            No phone
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <div v-if="tenant.rent_share" class="text-right mr-3">
          <p class="text-xs text-gray-500 dark:text-slate-400">Rent Share</p>
          <p class="font-medium text-gray-900 dark:text-white">&pound;{{ tenant.rent_share.toLocaleString() }}</p>
        </div>
        <button
          @click="startEditing"
          class="p-2 text-gray-400 dark:text-slate-500 hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 rounded-lg transition-colors"
          title="Edit tenant"
        >
          <Pencil class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-else>
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white">Edit Tenant Details</h4>
        <button
          @click="cancelEditing"
          class="p-1 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">First Name *</label>
          <input
            v-model="editForm.firstName"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Last Name *</label>
          <input
            v-model="editForm.lastName"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Email</label>
          <input
            v-model="editForm.email"
            type="email"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Phone</label>
          <input
            v-model="editForm.phone"
            type="tel"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
          />
        </div>
        <div v-if="canEditRentShare" class="col-span-2">
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Rent Share (£/month)</label>
          <input
            v-model.number="editForm.rentShare"
            type="number"
            step="0.01"
            min="0"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-primary focus:border-primary"
            placeholder="e.g. 750.00"
          />
          <p v-if="monthlyRent" class="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Total rent: £{{ monthlyRent.toLocaleString() }}/month
          </p>
        </div>
      </div>
      <div class="mt-3 flex items-center gap-2">
        <label class="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
          <input
            v-model="editForm.isLeadTenant"
            type="checkbox"
            class="w-4 h-4 rounded border-gray-300 dark:border-slate-600 text-primary focus:ring-primary"
          />
          Lead Tenant
        </label>
      </div>
      <div class="mt-4 flex justify-between">
        <button
          @click="confirmRemove"
          class="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
        >
          Remove Tenant
        </button>
        <div class="flex gap-2">
          <button
            @click="cancelEditing"
            class="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
          >
            Cancel
          </button>
          <button
            @click="saveChanges"
            :disabled="!editForm.firstName || !editForm.lastName || saving"
            class="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { User, Mail, Phone, Pencil, X } from 'lucide-vue-next'

interface Tenant {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  is_lead_tenant: boolean
  rent_share: number | null
  status: string
}

const props = defineProps<{
  tenant: Tenant
  canEditRentShare?: boolean
  monthlyRent?: number
}>()

const emit = defineEmits<{
  update: [data: { firstName: string; lastName: string; email: string; phone: string; isLeadTenant: boolean; rentShare?: number }]
  remove: []
}>()

const isEditing = ref(false)
const saving = ref(false)

const editForm = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  isLeadTenant: false,
  rentShare: null as number | null
})

const startEditing = () => {
  editForm.firstName = props.tenant.first_name
  editForm.lastName = props.tenant.last_name
  editForm.email = props.tenant.email || ''
  editForm.phone = props.tenant.phone || ''
  editForm.isLeadTenant = props.tenant.is_lead_tenant
  editForm.rentShare = props.tenant.rent_share
  isEditing.value = true
}

const cancelEditing = () => {
  isEditing.value = false
}

const saveChanges = async () => {
  saving.value = true
  try {
    emit('update', {
      firstName: editForm.firstName,
      lastName: editForm.lastName,
      email: editForm.email,
      phone: editForm.phone,
      isLeadTenant: editForm.isLeadTenant,
      rentShare: props.canEditRentShare && editForm.rentShare != null ? editForm.rentShare : undefined
    })
    isEditing.value = false
  } finally {
    saving.value = false
  }
}

const confirmRemove = () => {
  if (confirm('Are you sure you want to remove this tenant from the tenancy?')) {
    emit('remove')
    isEditing.value = false
  }
}
</script>
