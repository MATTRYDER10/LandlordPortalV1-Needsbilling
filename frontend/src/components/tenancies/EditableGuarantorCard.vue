<template>
  <div class="border border-gray-200 dark:border-slate-700 rounded-lg p-4 transition-all bg-white dark:bg-slate-800" :class="{ 'border-emerald-500 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20': isEditing }">
    <!-- View Mode -->
    <div v-if="!isEditing" class="flex items-start justify-between">
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <ShieldCheck class="w-4 h-4 text-emerald-500" />
          <h4 class="font-medium text-gray-900 dark:text-white">
            {{ guarantor.first_name }} {{ guarantor.last_name }}
          </h4>
          <span
            v-if="guarantor.relationship_to_tenant"
            class="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full"
          >
            {{ guarantor.relationship_to_tenant }}
          </span>
        </div>
        <div class="mt-2 space-y-1">
          <p v-if="guarantor.email" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
            <Mail class="w-3 h-3 text-gray-400 dark:text-slate-500" />
            <a :href="`mailto:${guarantor.email}`" class="hover:text-primary">{{ guarantor.email }}</a>
          </p>
          <p v-else class="text-sm text-gray-400 dark:text-slate-500 flex items-center gap-2">
            <Mail class="w-3 h-3 text-gray-300 dark:text-slate-600" />
            No email
          </p>
          <p v-if="guarantor.phone" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
            <Phone class="w-3 h-3 text-gray-400 dark:text-slate-500" />
            <a :href="`tel:${guarantor.phone}`" class="hover:text-primary">{{ guarantor.phone }}</a>
          </p>
          <p v-else class="text-sm text-gray-400 dark:text-slate-500 flex items-center gap-2">
            <Phone class="w-3 h-3 text-gray-300 dark:text-slate-600" />
            No phone
          </p>
          <p v-if="fullAddress" class="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-2">
            <MapPin class="w-3 h-3 text-gray-400 dark:text-slate-500" />
            {{ fullAddress }}
          </p>
        </div>
      </div>
      <button
        @click="startEditing"
        class="p-2 text-gray-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
        title="Edit guarantor"
      >
        <Pencil class="w-4 h-4" />
      </button>
    </div>

    <!-- Edit Mode -->
    <div v-else>
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-medium text-gray-900 dark:text-white">Edit Guarantor Details</h4>
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
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Last Name *</label>
          <input
            v-model="editForm.lastName"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Email</label>
          <input
            v-model="editForm.email"
            type="email"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Phone</label>
          <input
            v-model="editForm.phone"
            type="tel"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Relationship</label>
          <select
            v-model="editForm.relationshipToTenant"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
          >
            <option value="">Select...</option>
            <option value="Parent">Parent</option>
            <option value="Grandparent">Grandparent</option>
            <option value="Sibling">Sibling</option>
            <option value="Spouse">Spouse</option>
            <option value="Other Family">Other Family</option>
            <option value="Friend">Friend</option>
            <option value="Employer">Employer</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Postcode</label>
          <input
            v-model="editForm.postcode"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
        <div class="col-span-2">
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">Address</label>
          <input
            v-model="editForm.addressLine1"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
            placeholder="Street address"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-500 dark:text-slate-400 mb-1">City</label>
          <input
            v-model="editForm.city"
            type="text"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg focus:ring-emerald-500 focus:border-emerald-500"
          />
        </div>
      </div>
      <div class="mt-4 flex justify-between">
        <button
          @click="confirmRemove"
          class="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
        >
          Remove Guarantor
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
            class="px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { ShieldCheck, Mail, Phone, MapPin, Pencil, X } from 'lucide-vue-next'

interface Guarantor {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  postcode: string | null
  relationship_to_tenant: string | null
}

const props = defineProps<{
  guarantor: Guarantor
}>()

const emit = defineEmits<{
  update: [data: {
    firstName: string
    lastName: string
    email: string
    phone: string
    addressLine1: string
    city: string
    postcode: string
    relationshipToTenant: string
  }]
  remove: []
}>()

const isEditing = ref(false)
const saving = ref(false)

const editForm = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  addressLine1: '',
  city: '',
  postcode: '',
  relationshipToTenant: ''
})

const fullAddress = computed(() => {
  const parts = [
    props.guarantor.address_line1,
    props.guarantor.city,
    props.guarantor.postcode
  ].filter(Boolean)
  return parts.join(', ')
})

const startEditing = () => {
  editForm.firstName = props.guarantor.first_name
  editForm.lastName = props.guarantor.last_name
  editForm.email = props.guarantor.email || ''
  editForm.phone = props.guarantor.phone || ''
  editForm.addressLine1 = props.guarantor.address_line1 || ''
  editForm.city = props.guarantor.city || ''
  editForm.postcode = props.guarantor.postcode || ''
  editForm.relationshipToTenant = props.guarantor.relationship_to_tenant || ''
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
      addressLine1: editForm.addressLine1,
      city: editForm.city,
      postcode: editForm.postcode,
      relationshipToTenant: editForm.relationshipToTenant
    })
    isEditing.value = false
  } finally {
    saving.value = false
  }
}

const confirmRemove = () => {
  if (confirm('Are you sure you want to remove this guarantor from the tenancy?')) {
    emit('remove')
    isEditing.value = false
  }
}
</script>
