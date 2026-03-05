<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Landlord Details</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">Enter the landlord(s) named on the tenancy agreement.</p>
    </div>

    <!-- Landlord Names -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        Landlord Name(s) *
      </label>
      <div class="space-y-2">
        <div v-for="(name, index) in formState.landlordNames" :key="index" class="flex gap-2">
          <input
            :value="name"
            @input="updateLandlordName(index, ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Full legal name"
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
          <button
            v-if="formState.landlordNames.length > 1"
            @click="removeLandlord(index)"
            type="button"
            class="px-3 py-2 text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 class="w-4 h-4" />
          </button>
        </div>
      </div>
      <button
        @click="addLandlord"
        type="button"
        class="mt-2 text-sm text-primary hover:text-primary/80 flex items-center gap-1"
      >
        <Plus class="w-4 h-4" />
        Add landlord (joint landlords)
      </button>
    </div>

    <!-- Landlord Address -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        Landlord Address *
      </label>
      <div class="space-y-3">
        <input
          :value="formState.landlordAddress.line1"
          @input="updateLandlordAddress('line1', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Address line 1"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
        />
        <input
          :value="formState.landlordAddress.line2"
          @input="updateLandlordAddress('line2', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Address line 2 (optional)"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
        />
        <div class="grid grid-cols-2 gap-3">
          <input
            :value="formState.landlordAddress.town"
            @input="updateLandlordAddress('town', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Town/City"
            class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
          <input
            :value="formState.landlordAddress.county"
            @input="updateLandlordAddress('county', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="County (optional)"
            class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
        </div>
        <input
          :value="formState.landlordAddress.postcode"
          @input="updateLandlordAddress('postcode', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="Postcode"
          class="w-40 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm uppercase dark:bg-slate-900 dark:text-white"
        />
      </div>
    </div>

    <!-- Served by Agent Toggle -->
    <div class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
      <label class="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          :checked="formState.servedByAgent"
          @change="emit('update', { servedByAgent: ($event.target as HTMLInputElement).checked })"
          class="w-5 h-5 text-primary rounded border-gray-300 dark:border-slate-600 focus:ring-primary dark:bg-slate-900"
        />
        <div>
          <span class="font-medium text-gray-900 dark:text-white">Notice served by agent</span>
          <p class="text-sm text-gray-500 dark:text-slate-400">Check this if you are serving the notice on behalf of the landlord</p>
        </div>
      </label>
    </div>

    <!-- Agent Details (shown if servedByAgent is true) -->
    <Transition name="slide">
      <div v-if="formState.servedByAgent" class="space-y-4 pl-4 border-l-2 border-primary">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Agent Name
          </label>
          <input
            :value="formState.agentName"
            @input="emit('update', { agentName: ($event.target as HTMLInputElement).value })"
            type="text"
            placeholder="Agency name"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Agent Address
          </label>
          <div class="space-y-3">
            <input
              :value="formState.agentAddress.line1"
              @input="updateAgentAddress('line1', ($event.target as HTMLInputElement).value)"
              type="text"
              placeholder="Address line 1"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
            />
            <input
              :value="formState.agentAddress.line2"
              @input="updateAgentAddress('line2', ($event.target as HTMLInputElement).value)"
              type="text"
              placeholder="Address line 2 (optional)"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
            />
            <div class="grid grid-cols-2 gap-3">
              <input
                :value="formState.agentAddress.town"
                @input="updateAgentAddress('town', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="Town/City"
                class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
              />
              <input
                :value="formState.agentAddress.postcode"
                @input="updateAgentAddress('postcode', ($event.target as HTMLInputElement).value)"
                type="text"
                placeholder="Postcode"
                class="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm uppercase dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
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

function updateLandlordName(index: number, value: string) {
  const names = [...props.formState.landlordNames]
  names[index] = value
  emit('update', { landlordNames: names })
}

function addLandlord() {
  emit('update', { landlordNames: [...props.formState.landlordNames, ''] })
}

function removeLandlord(index: number) {
  const names = props.formState.landlordNames.filter((_, i) => i !== index)
  emit('update', { landlordNames: names })
}

function updateLandlordAddress(field: keyof Address, value: string) {
  emit('update', {
    landlordAddress: {
      ...props.formState.landlordAddress,
      [field]: value,
    },
  })
}

function updateAgentAddress(field: keyof Address, value: string) {
  emit('update', {
    agentAddress: {
      ...props.formState.agentAddress,
      [field]: value,
    },
  })
}
</script>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
