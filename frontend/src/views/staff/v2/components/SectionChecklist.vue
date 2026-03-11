<template>
  <div class="space-y-6">
    <div
      v-for="(step, index) in steps"
      :key="index"
      class="border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden"
    >
      <!-- Step Header -->
      <div
        class="px-4 py-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium"
            :class="getStepStatusClass(index)"
          >
            <Check v-if="isStepComplete(index)" class="w-4 h-4" />
            <span v-else>{{ index + 1 }}</span>
          </div>
          <span class="font-medium text-gray-900 dark:text-white">{{ step.title }}</span>
        </div>
        <button
          v-if="step.hasIssue && !step.issueReason"
          @click="openIssueModal(index)"
          class="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 flex items-center gap-1"
        >
          <AlertTriangle class="w-4 h-4" />
          Report Issue
        </button>
        <span
          v-else-if="step.issueReason"
          class="text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
        >
          <XCircle class="w-4 h-4" />
          Issue: {{ step.issueReason }}
        </span>
      </div>

      <!-- Step Content -->
      <div class="p-4">
        <!-- Evidence Display -->
        <div v-if="step.evidence" class="mb-4">
          <!-- Image evidence -->
          <div
            v-if="step.evidence.type === 'image'"
            class="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800"
          >
            <img
              :src="step.evidence.url"
              :alt="step.evidence.label"
              class="max-h-64 mx-auto cursor-zoom-in"
              @click="$emit('viewImage', step.evidence.url)"
            />
            <div class="absolute bottom-2 right-2 px-2 py-1 bg-black/50 text-white text-xs rounded">
              Click to enlarge
            </div>
          </div>

          <!-- Side-by-side images -->
          <div
            v-else-if="step.evidence.type === 'compare'"
            class="grid grid-cols-2 gap-4"
          >
            <div class="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800">
              <img
                :src="step.evidence.leftUrl"
                :alt="step.evidence.leftLabel"
                class="max-h-48 mx-auto cursor-zoom-in"
                @click="$emit('viewImage', step.evidence.leftUrl)"
              />
              <div class="text-center text-xs text-gray-500 mt-2">{{ step.evidence.leftLabel }}</div>
            </div>
            <div class="relative rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-800">
              <img
                :src="step.evidence.rightUrl"
                :alt="step.evidence.rightLabel"
                class="max-h-48 mx-auto cursor-zoom-in"
                @click="$emit('viewImage', step.evidence.rightUrl)"
              />
              <div class="text-center text-xs text-gray-500 mt-2">{{ step.evidence.rightLabel }}</div>
            </div>
          </div>

          <!-- Document/PDF link -->
          <div
            v-else-if="step.evidence.type === 'document'"
            class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-slate-800 rounded-lg"
          >
            <FileText class="w-8 h-8 text-primary" />
            <div class="flex-1">
              <p class="font-medium text-gray-900 dark:text-white">{{ step.evidence.label }}</p>
              <p class="text-sm text-gray-500">{{ step.evidence.filename }}</p>
            </div>
            <a
              :href="step.evidence.url"
              target="_blank"
              class="px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90"
            >
              View
            </a>
          </div>

          <!-- Text/Form data -->
          <div
            v-else-if="step.evidence.type === 'data'"
            class="bg-gray-50 dark:bg-slate-800 rounded-lg p-4"
          >
            <div class="grid grid-cols-2 gap-3">
              <div v-for="(value, key) in step.evidence.data" :key="key">
                <span class="text-xs text-gray-500 dark:text-slate-400">{{ formatLabel(key) }}</span>
                <p class="font-medium text-gray-900 dark:text-white">{{ value || '-' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Checklist Items -->
        <div class="space-y-3">
          <label
            v-for="(item, itemIndex) in step.checklistItems"
            :key="itemIndex"
            class="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              v-model="checkedItems[`${index}-${itemIndex}`]"
              class="mt-0.5 w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <div class="flex-1">
              <span class="text-gray-900 dark:text-white">{{ item.label }}</span>
              <p v-if="item.hint" class="text-xs text-gray-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                <Info class="w-3 h-3" />
                {{ item.hint }}
              </p>
            </div>
          </label>
        </div>

        <!-- Input Fields (if any) -->
        <div v-if="step.inputFields" class="mt-4 grid grid-cols-2 gap-4">
          <div v-for="field in step.inputFields" :key="field.name">
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              {{ field.label }}
            </label>
            <input
              v-if="field.type === 'text' || field.type === 'date'"
              :type="field.type"
              v-model="inputValues[field.name]"
              :placeholder="field.placeholder"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            />
            <select
              v-else-if="field.type === 'select'"
              v-model="inputValues[field.name]"
              class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">{{ field.placeholder || 'Select...' }}</option>
              <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <!-- Step Actions -->
        <div class="mt-4 flex gap-3">
          <button
            @click="markStepComplete(index)"
            :disabled="!canCompleteStep(index)"
            class="flex-1 py-2 px-4 rounded-lg font-medium transition-all flex items-center justify-center gap-2"
            :class="isStepComplete(index)
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-300 disabled:opacity-50'"
          >
            <Check v-if="isStepComplete(index)" class="w-4 h-4" />
            {{ isStepComplete(index) ? 'Step Complete' : 'Mark Complete' }}
          </button>
          <button
            v-if="!step.issueReason"
            @click="openIssueModal(index)"
            class="py-2 px-4 border border-amber-300 text-amber-600 rounded-lg hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
          >
            Issue Found
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Issue Modal -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="showIssueModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Report Issue</h3>
          <select
            v-model="issueReason"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white mb-3"
          >
            <option value="">Select issue type...</option>
            <option value="UNCLEAR">Document unclear or unreadable</option>
            <option value="MISMATCH">Information does not match</option>
            <option value="EXPIRED">Document expired</option>
            <option value="MISSING">Evidence missing</option>
            <option value="FRAUD">Suspected fraud</option>
            <option value="OTHER">Other</option>
          </select>
          <textarea
            v-model="issueNotes"
            rows="3"
            placeholder="Additional details..."
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white mb-4"
          />
          <div class="flex gap-3">
            <button
              @click="showIssueModal = false"
              class="flex-1 py-2 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              @click="submitIssue"
              :disabled="!issueReason"
              class="flex-1 py-2 px-4 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              Submit Issue
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { Check, AlertTriangle, XCircle, Info, FileText } from 'lucide-vue-next'

interface ChecklistItem {
  label: string
  hint?: string
}

interface InputField {
  name: string
  label: string
  type: 'text' | 'date' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
}

interface Evidence {
  type: 'image' | 'compare' | 'document' | 'data'
  url?: string
  label?: string
  filename?: string
  leftUrl?: string
  leftLabel?: string
  rightUrl?: string
  rightLabel?: string
  data?: Record<string, any>
}

interface Step {
  title: string
  checklistItems: ChecklistItem[]
  evidence?: Evidence
  inputFields?: InputField[]
  hasIssue?: boolean
  issueReason?: string
}

const props = defineProps<{
  steps: Step[]
}>()

const emit = defineEmits<{
  viewImage: [url: string]
  stepComplete: [index: number, data: { inputValues: Record<string, any> }]
  issueReported: [index: number, reason: string, notes: string]
  allComplete: [data: { inputValues: Record<string, any>; completedSteps: number[] }]
}>()

const checkedItems = reactive<Record<string, boolean>>({})
const inputValues = reactive<Record<string, any>>({})
const completedSteps = ref<number[]>([])

const showIssueModal = ref(false)
const currentIssueStep = ref<number | null>(null)
const issueReason = ref('')
const issueNotes = ref('')

function isStepComplete(index: number): boolean {
  return completedSteps.value.includes(index)
}

function canCompleteStep(index: number): boolean {
  const step = props.steps[index]
  if (!step) return false

  // All checklist items must be checked
  return step.checklistItems.every((_, itemIndex) => checkedItems[`${index}-${itemIndex}`])
}

function getStepStatusClass(index: number): string {
  if (isStepComplete(index)) {
    return 'bg-green-600 text-white'
  }
  if (props.steps[index]?.issueReason) {
    return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
  }
  return 'bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
}

function markStepComplete(index: number) {
  if (!canCompleteStep(index)) return
  if (!completedSteps.value.includes(index)) {
    completedSteps.value.push(index)
  }
  emit('stepComplete', index, { inputValues: { ...inputValues } })

  // Check if all steps complete
  if (completedSteps.value.length === props.steps.length) {
    emit('allComplete', {
      inputValues: { ...inputValues },
      completedSteps: [...completedSteps.value]
    })
  }
}

function openIssueModal(index: number) {
  currentIssueStep.value = index
  issueReason.value = ''
  issueNotes.value = ''
  showIssueModal.value = true
}

function submitIssue() {
  if (currentIssueStep.value !== null && issueReason.value) {
    emit('issueReported', currentIssueStep.value, issueReason.value, issueNotes.value)
    showIssueModal.value = false
  }
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

// Watch for step changes to reset state
watch(() => props.steps, () => {
  Object.keys(checkedItems).forEach(key => delete checkedItems[key])
  Object.keys(inputValues).forEach(key => delete inputValues[key])
  completedSteps.value = []
}, { deep: true })
</script>
