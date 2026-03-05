<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Tenant Details</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">Enter the tenant(s) named on the tenancy agreement.</p>
    </div>

    <!-- Tenant Names -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        Tenant Name(s) *
      </label>
      <div class="space-y-2">
        <div v-for="(name, index) in formState.tenantNames" :key="index" class="flex gap-2">
          <input
            :value="name"
            @input="updateTenantName(index, ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Full legal name"
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
          <button
            v-if="formState.tenantNames.length > 1"
            @click="removeTenant(index)"
            type="button"
            class="px-3 py-2 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
      <button
        @click="addTenant"
        type="button"
        class="mt-2 text-sm text-primary hover:text-primary/80 flex items-center gap-1"
      >
        <Plus class="w-4 h-4" />
        Add tenant (joint tenancy)
      </button>
    </div>

    <!-- Property Address -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        Property Address *
      </label>
      <div class="space-y-3">
        <input
          :value="formState.propertyAddress.line1"
          @input="updateAddress('line1', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Address line 1"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
        />
        <input
          :value="formState.propertyAddress.line2"
          @input="updateAddress('line2', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Address line 2 (optional)"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
        />
        <div class="grid grid-cols-2 gap-3">
          <input
            :value="formState.propertyAddress.town"
            @input="updateAddress('town', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Town/City"
            class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
          <input
            :value="formState.propertyAddress.county"
            @input="updateAddress('county', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="County (optional)"
            class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
        </div>
        <input
          :value="formState.propertyAddress.postcode"
          @input="updateAddress('postcode', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Postcode"
          class="w-40 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm uppercase dark:bg-slate-900 dark:text-white"
        />
      </div>
    </div>

    <!-- Contact Details -->
    <div class="grid md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Tenant Email Address
        </label>
        <input
          :value="formState.tenantEmail"
          @input="emit('update', { tenantEmail: ($event.target as HTMLInputElement).value })"
          type="email"
          placeholder="email@example.com"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Tenant Phone Number
        </label>
        <input
          :value="formState.tenantPhone"
          @input="emit('update', { tenantPhone: ($event.target as HTMLInputElement).value })"
          type="tel"
          placeholder="07xxx xxxxxx"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next'
import type { S8FormState, Address } from '@/types/section8'

interface Props {
  formState: S8FormState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [updates: Partial<S8FormState>]
}>()

function updateTenantName(index: number, value: string) {
  const names = [...props.formState.tenantNames]
  names[index] = value
  emit('update', { tenantNames: names })
}

function addTenant() {
  emit('update', { tenantNames: [...props.formState.tenantNames, ''] })
}

function removeTenant(index: number) {
  const names = props.formState.tenantNames.filter((_, i) => i !== index)
  emit('update', { tenantNames: names })
}

function updateAddress(field: keyof Address, value: string) {
  emit('update', {
    propertyAddress: {
      ...props.formState.propertyAddress,
      [field]: value,
    },
  })
}
</script>
