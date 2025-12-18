<template>
  <div class="bg-white rounded-lg shadow-lg sticky top-48">
    <div class="p-6 border-b">
      <h3 class="text-lg font-semibold text-gray-900">Final Decision</h3>
      <p class="text-sm text-gray-600 mt-1">Review all sections before making a final decision</p>
    </div>

    <!-- Section Summary -->
    <div class="p-6 border-b">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">Section Summary</h4>
      <div class="space-y-2">
        <div v-for="section in sections" :key="section.id" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">{{ getSectionLabel(section.sectionType) }}</span>
          <span :class="[
            'px-2 py-0.5 text-xs font-medium rounded-full',
            section.decision === 'PASS' ? 'bg-green-100 text-green-800' :
            section.decision === 'PASS_WITH_CONDITION' ? 'bg-amber-100 text-amber-800' :
            section.decision === 'ACTION_REQUIRED' ? 'bg-orange-100 text-orange-800' :
            section.decision === 'FAIL' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-600'
          ]">
            {{ formatDecision(section.decision) }}
          </span>
        </div>
      </div>
    </div>

    <!-- Conditions Summary -->
    <div v-if="conditionSections.length > 0" class="p-6 border-b bg-amber-50">
      <h4 class="text-sm font-semibold text-amber-800 mb-2">Conditions to Apply</h4>
      <ul class="space-y-2">
        <li v-for="section in conditionSections" :key="section.id" class="text-sm text-amber-700">
          <span class="font-medium">{{ getSectionLabel(section.sectionType) }}:</span>
          {{ section.conditionText }}
        </li>
      </ul>
    </div>

    <!-- Issues Warning -->
    <div v-if="hasActionRequired || hasFail" class="p-6 border-b bg-red-50">
      <h4 class="text-sm font-semibold text-red-800 mb-2">Issues Found</h4>
      <ul class="space-y-2">
        <li v-for="section in issueSections" :key="section.id" class="text-sm text-red-700">
          <span class="font-medium">{{ getSectionLabel(section.sectionType) }}:</span>
          <span v-if="section.decision === 'ACTION_REQUIRED'" class="ml-1">Action Required</span>
          <span v-else-if="section.decision === 'FAIL'" class="ml-1">{{ section.failReason || 'Failed' }}</span>
        </li>
      </ul>
    </div>

    <!-- Final Decision Selection -->
    <div class="p-6">
      <h4 class="text-sm font-semibold text-gray-700 mb-3">Select Final Decision</h4>

      <div v-if="!canFinalize" class="mb-4 p-3 bg-gray-100 rounded-lg">
        <p class="text-sm text-gray-600">
          Complete all sections before making a final decision
        </p>
      </div>

      <div class="space-y-2">
        <!-- PASS -->
        <button
          @click="selectedDecision = 'PASS'"
          :disabled="!canFinalize || hasFail || hasActionRequired || readOnly"
          :class="[
            'w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all',
            selectedDecision === 'PASS'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 hover:border-green-300',
            (!canFinalize || hasFail || hasActionRequired || readOnly) && 'opacity-50 cursor-not-allowed'
          ]"
        >
          <div class="flex items-center gap-3">
            <div :class="[
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selectedDecision === 'PASS' ? 'border-green-500 bg-green-500' : 'border-gray-300'
            ]">
              <Check v-if="selectedDecision === 'PASS'" class="w-3 h-3 text-white" />
            </div>
            <span class="font-medium text-gray-900">Pass</span>
          </div>
          <span class="text-xs text-gray-500">Approved without conditions</span>
        </button>

        <!-- PASS WITH CONDITION -->
        <button
          @click="selectedDecision = 'PASS_WITH_CONDITION'"
          :disabled="!canFinalize || hasFail || hasActionRequired || conditionSections.length === 0 || readOnly"
          :class="[
            'w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all',
            selectedDecision === 'PASS_WITH_CONDITION'
              ? 'border-amber-500 bg-amber-50'
              : 'border-gray-200 hover:border-amber-300',
            (!canFinalize || hasFail || hasActionRequired || conditionSections.length === 0 || readOnly) && 'opacity-50 cursor-not-allowed'
          ]"
        >
          <div class="flex items-center gap-3">
            <div :class="[
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selectedDecision === 'PASS_WITH_CONDITION' ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
            ]">
              <Check v-if="selectedDecision === 'PASS_WITH_CONDITION'" class="w-3 h-3 text-white" />
            </div>
            <span class="font-medium text-gray-900">Pass with Conditions</span>
          </div>
          <span class="text-xs text-gray-500">{{ conditionSections.length }} condition(s)</span>
        </button>

        <!-- PASS WITH GUARANTOR (Tenant only) -->
        <button
          v-if="!isGuarantor"
          @click="selectedDecision = 'PASS_WITH_GUARANTOR'"
          :disabled="!canFinalize || hasActionRequired || readOnly"
          :class="[
            'w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all',
            selectedDecision === 'PASS_WITH_GUARANTOR'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 hover:border-purple-300',
            (!canFinalize || hasActionRequired || readOnly) && 'opacity-50 cursor-not-allowed'
          ]"
        >
          <div class="flex items-center gap-3">
            <div :class="[
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selectedDecision === 'PASS_WITH_GUARANTOR' ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
            ]">
              <Check v-if="selectedDecision === 'PASS_WITH_GUARANTOR'" class="w-3 h-3 text-white" />
            </div>
            <span class="font-medium text-gray-900">Pass with Guarantor</span>
          </div>
          <span class="text-xs text-gray-500">Requires guarantor approval</span>
        </button>

        <!-- REFER -->
        <button
          @click="selectedDecision = 'REFER'"
          :disabled="!canFinalize || readOnly"
          :class="[
            'w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all',
            selectedDecision === 'REFER'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300',
            (!canFinalize || readOnly) && 'opacity-50 cursor-not-allowed'
          ]"
        >
          <div class="flex items-center gap-3">
            <div :class="[
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selectedDecision === 'REFER' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
            ]">
              <Check v-if="selectedDecision === 'REFER'" class="w-3 h-3 text-white" />
            </div>
            <span class="font-medium text-gray-900">Refer</span>
          </div>
          <span class="text-xs text-gray-500">Escalate for review</span>
        </button>

        <!-- FAIL -->
        <button
          @click="selectedDecision = 'FAIL'"
          :disabled="!canFinalize || readOnly"
          :class="[
            'w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 transition-all',
            selectedDecision === 'FAIL'
              ? 'border-red-500 bg-red-50'
              : 'border-gray-200 hover:border-red-300',
            (!canFinalize || readOnly) && 'opacity-50 cursor-not-allowed'
          ]"
        >
          <div class="flex items-center gap-3">
            <div :class="[
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selectedDecision === 'FAIL' ? 'border-red-500 bg-red-500' : 'border-gray-300'
            ]">
              <Check v-if="selectedDecision === 'FAIL'" class="w-3 h-3 text-white" />
            </div>
            <span class="font-medium text-gray-900">Fail</span>
          </div>
          <span class="text-xs text-gray-500">Application rejected</span>
        </button>
      </div>

      <!-- Notes -->
      <div v-if="selectedDecision" class="mt-4">
        <label class="block text-sm font-medium text-gray-700 mb-1">
          Notes <span class="text-gray-400">(optional)</span>
        </label>
        <textarea
          v-model="notes"
          rows="3"
          class="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-primary"
          placeholder="Add any additional notes..."
          :disabled="readOnly"
        ></textarea>
      </div>

      <!-- Submit Button -->
      <button
        @click="handleSubmit"
        :disabled="!selectedDecision || loading || readOnly"
        :class="[
          'w-full mt-4 px-4 py-3 rounded-lg font-medium text-white transition-all flex items-center justify-center gap-2',
          selectedDecision === 'PASS' ? 'bg-green-600 hover:bg-green-700' :
          selectedDecision === 'PASS_WITH_CONDITION' ? 'bg-amber-600 hover:bg-amber-700' :
          selectedDecision === 'PASS_WITH_GUARANTOR' ? 'bg-purple-600 hover:bg-purple-700' :
          selectedDecision === 'REFER' ? 'bg-blue-600 hover:bg-blue-700' :
          selectedDecision === 'FAIL' ? 'bg-red-600 hover:bg-red-700' :
          'bg-gray-400',
          (!selectedDecision || loading || readOnly) && 'opacity-50 cursor-not-allowed'
        ]"
      >
        <Loader2 v-if="loading" class="w-5 h-5 animate-spin" />
        <span v-if="loading">Processing...</span>
        <span v-else>
          {{ selectedDecision ? `Finalize as ${formatFinalDecision(selectedDecision)}` : 'Select a decision' }}
        </span>
      </button>

      <!-- Confirmation Modal -->
      <div v-if="showConfirmModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
          <div class="p-6">
            <h3 class="text-lg font-semibold text-gray-900 mb-2">Confirm Decision</h3>
            <p class="text-gray-600 mb-4">
              Are you sure you want to finalize this verification as
              <span class="font-semibold">{{ formatFinalDecision(selectedDecision!) }}</span>?
            </p>
            <p class="text-sm text-gray-500">
              This action cannot be undone. The {{ isGuarantor ? 'guarantor' : 'tenant' }} will be notified of the result.
            </p>
          </div>
          <div class="px-6 py-4 bg-gray-50 flex justify-end gap-3">
            <button
              @click="showConfirmModal = false"
              class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            <button
              @click="confirmSubmit"
              :class="[
                'px-4 py-2 text-sm font-medium text-white rounded-md',
                selectedDecision === 'PASS' ? 'bg-green-600 hover:bg-green-700' :
                selectedDecision === 'PASS_WITH_CONDITION' ? 'bg-amber-600 hover:bg-amber-700' :
                selectedDecision === 'PASS_WITH_GUARANTOR' ? 'bg-purple-600 hover:bg-purple-700' :
                selectedDecision === 'REFER' ? 'bg-blue-600 hover:bg-blue-700' :
                'bg-red-600 hover:bg-red-700'
              ]"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { VerificationSection, FinalDecision } from '@/types/staff'
import { getSectionLabel } from '@/types/staff'
import { Check, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  sections: VerificationSection[]
  isGuarantor: boolean
  personName: string
  canFinalize: boolean
  hasActionRequired: boolean
  hasFail: boolean
  readOnly?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'finalize', decision: FinalDecision, notes?: string): void
}>()

const selectedDecision = ref<FinalDecision | null>(null)
const notes = ref('')
const showConfirmModal = ref(false)

const conditionSections = computed(() =>
  props.sections.filter(s => s.decision === 'PASS_WITH_CONDITION')
)

const issueSections = computed(() =>
  props.sections.filter(s => s.decision === 'ACTION_REQUIRED' || s.decision === 'FAIL')
)

function formatDecision(decision: string): string {
  const labels: Record<string, string> = {
    NOT_REVIEWED: 'Not Reviewed',
    PASS: 'Pass',
    PASS_WITH_CONDITION: 'Conditional',
    ACTION_REQUIRED: 'Action Required',
    FAIL: 'Fail'
  }
  return labels[decision] || decision
}

function formatFinalDecision(decision: FinalDecision): string {
  const labels: Record<FinalDecision, string> = {
    PASS: 'Pass',
    PASS_WITH_CONDITION: 'Pass with Conditions',
    PASS_WITH_GUARANTOR: 'Pass with Guarantor',
    REFER: 'Refer',
    FAIL: 'Fail'
  }
  return labels[decision] || decision
}

function handleSubmit() {
  if (!selectedDecision.value) return
  showConfirmModal.value = true
}

function confirmSubmit() {
  if (!selectedDecision.value) return
  showConfirmModal.value = false
  emit('finalize', selectedDecision.value, notes.value || undefined)
}
</script>

<style scoped>
/* Additional styles if needed */
</style>
