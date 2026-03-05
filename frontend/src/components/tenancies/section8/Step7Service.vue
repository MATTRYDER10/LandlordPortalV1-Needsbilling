<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Service & Signature</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">Specify how the notice will be served and sign the document.</p>
    </div>

    <!-- Service Date -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
        Date of Service *
      </label>
      <input
        :value="formState.serviceDate"
        @input="emit('update', { serviceDate: ($event.target as HTMLInputElement).value })"
        type="date"
        class="w-48 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
      />
      <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">The date the notice is/will be served on the tenant</p>
    </div>

    <!-- Service Method -->
    <div>
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
        Method of Service *
      </label>
      <div class="space-y-2">
        <label
          v-for="method in serviceMethods"
          :key="method.value"
          class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-all"
          :class="formState.serviceMethod === method.value
            ? 'border-primary bg-primary/5 ring-1 ring-primary'
            : 'border-gray-200 dark:border-slate-700 hover:border-gray-300 dark:hover:border-slate-600'"
        >
          <input
            type="radio"
            :value="method.value"
            :checked="formState.serviceMethod === method.value"
            @change="emit('update', { serviceMethod: method.value })"
            class="mt-0.5 text-primary focus:ring-primary"
          />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">{{ method.label }}</p>
            <p class="text-xs text-gray-500 dark:text-slate-400">{{ method.description }}</p>
          </div>
        </label>
      </div>
    </div>

    <!-- Email address (if email service method) -->
    <Transition name="slide">
      <div v-if="showEmailField">
        <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
          Email Address for Service
        </label>
        <input
          :value="formState.emailServedTo"
          @input="emit('update', { emailServedTo: ($event.target as HTMLInputElement).value })"
          type="email"
          placeholder="tenant@example.com"
          class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
        />
      </div>
    </Transition>

    <!-- Signatory Details -->
    <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-4">Signatory Details</h4>

      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Signatory Name *
          </label>
          <input
            :value="formState.signatoryName"
            @input="emit('update', { signatoryName: ($event.target as HTMLInputElement).value })"
            type="text"
            placeholder="Full name of person signing"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Signatory Capacity *
          </label>
          <select
            :value="formState.signatoryCapacity"
            @change="emit('update', { signatoryCapacity: ($event.target as HTMLSelectElement).value as any })"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          >
            <option value="">Select capacity...</option>
            <option value="landlord">Landlord</option>
            <option value="agent">Agent for the Landlord</option>
            <option value="joint_landlord">Joint Landlord</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Signature Section -->
    <div class="border-t border-gray-200 dark:border-slate-700 pt-6">
      <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-4">
        <PenTool class="w-4 h-4 inline-block mr-1" />
        Signature *
      </h4>

      <!-- Signature Method Toggle -->
      <div class="flex gap-2 mb-4">
        <button
          type="button"
          @click="emit('update', { signatureMethod: 'type', signature: '' })"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-all"
          :class="formState.signatureMethod === 'type'
            ? 'bg-primary text-white'
            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'"
        >
          <Type class="w-4 h-4 inline-block mr-1" />
          Type Signature
        </button>
        <button
          type="button"
          @click="emit('update', { signatureMethod: 'draw', signature: '' })"
          class="px-4 py-2 text-sm font-medium rounded-lg transition-all"
          :class="formState.signatureMethod === 'draw'
            ? 'bg-primary text-white'
            : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600'"
        >
          <PenTool class="w-4 h-4 inline-block mr-1" />
          Draw Signature
        </button>
      </div>

      <!-- Typed Signature -->
      <div v-if="formState.signatureMethod === 'type'" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
            Type your signature
          </label>
          <input
            :value="formState.signature"
            @input="emit('update', { signature: ($event.target as HTMLInputElement).value })"
            type="text"
            :placeholder="formState.signatoryName || 'Your name'"
            class="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm dark:bg-slate-900 dark:text-white"
          />
        </div>

        <!-- Preview -->
        <div v-if="formState.signature" class="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
          <p class="text-xs text-gray-500 dark:text-slate-400 mb-2">Signature Preview</p>
          <p class="font-signature text-3xl text-blue-800">{{ formState.signature }}</p>
        </div>
      </div>

      <!-- Drawn Signature -->
      <div v-else class="space-y-4">
        <div class="bg-white dark:bg-slate-900 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg p-4">
          <canvas
            ref="signatureCanvas"
            width="500"
            height="150"
            class="w-full border border-gray-200 dark:border-slate-700 rounded cursor-crosshair bg-white dark:bg-slate-800"
            @mousedown="startDrawing"
            @mousemove="draw"
            @mouseup="stopDrawing"
            @mouseleave="stopDrawing"
            @touchstart.prevent="handleTouchStart"
            @touchmove.prevent="handleTouchMove"
            @touchend.prevent="stopDrawing"
          ></canvas>
          <div class="flex justify-between items-center mt-2">
            <p class="text-xs text-gray-500 dark:text-slate-400">Draw your signature above</p>
            <button
              type="button"
              @click="clearSignature"
              class="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <X class="w-3 h-3" />
              Clear
            </button>
          </div>
        </div>

        <!-- Preview of drawn signature -->
        <div v-if="formState.signature" class="bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-4">
          <p class="text-xs text-gray-500 dark:text-slate-400 mb-2">Signature Preview</p>
          <img :src="formState.signature" alt="Signature" class="max-h-16" />
        </div>
      </div>
    </div>

    <!-- Earliest Court Date Summary -->
    <div v-if="formState.earliestCourtDate" class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <Calendar class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p class="font-semibold text-blue-900 dark:text-blue-200">Earliest Court Date</p>
          <p class="text-lg font-bold text-blue-800 dark:text-blue-300 mt-1">
            {{ formatDate(formState.earliestCourtDate) }}
          </p>
          <p v-if="formState.noticeExplanation" class="text-sm text-blue-700 dark:text-blue-300 mt-2">
            {{ formState.noticeExplanation }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { Calendar, PenTool, Type, X } from 'lucide-vue-next'
import type { S8FormState, ServiceMethod } from '@/types/section8'

interface Props {
  formState: S8FormState
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [updates: Partial<S8FormState>]
}>()

interface ServiceMethodOption {
  value: ServiceMethod
  label: string
  description: string
}

const serviceMethods: ServiceMethodOption[] = [
  {
    value: 'first_class_post',
    label: 'First Class Post',
    description: 'Sent via Royal Mail first class post (deemed served 2 working days after posting)',
  },
  {
    value: 'email',
    label: 'Email',
    description: 'Sent via email (only if permitted by the tenancy agreement)',
  },
  {
    value: 'email_and_post',
    label: 'Email and Post',
    description: 'Sent by both email and first class post for additional certainty',
  },
  {
    value: 'personal_service',
    label: 'Personal Service',
    description: 'Hand delivered to the tenant in person',
  },
]

const showEmailField = computed(() =>
  props.formState.serviceMethod === 'email' || props.formState.serviceMethod === 'email_and_post'
)

// Signature canvas
const signatureCanvas = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const ctx = ref<CanvasRenderingContext2D | null>(null)

onMounted(() => {
  initCanvas()
})

watch(() => props.formState.signatureMethod, () => {
  nextTick(() => {
    if (props.formState.signatureMethod === 'draw') {
      initCanvas()
    }
  })
})

function initCanvas() {
  if (!signatureCanvas.value) return
  ctx.value = signatureCanvas.value.getContext('2d')
  if (ctx.value) {
    ctx.value.strokeStyle = '#1e40af'
    ctx.value.lineWidth = 2
    ctx.value.lineCap = 'round'
    ctx.value.lineJoin = 'round'
  }
}

function getCanvasCoordinates(e: MouseEvent | Touch): { x: number; y: number } {
  if (!signatureCanvas.value) return { x: 0, y: 0 }
  const rect = signatureCanvas.value.getBoundingClientRect()
  const scaleX = signatureCanvas.value.width / rect.width
  const scaleY = signatureCanvas.value.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  }
}

function startDrawing(e: MouseEvent) {
  if (!ctx.value) return
  isDrawing.value = true
  const { x, y } = getCanvasCoordinates(e)
  ctx.value.beginPath()
  ctx.value.moveTo(x, y)
}

function draw(e: MouseEvent) {
  if (!isDrawing.value || !ctx.value) return
  const { x, y } = getCanvasCoordinates(e)
  ctx.value.lineTo(x, y)
  ctx.value.stroke()
}

function stopDrawing() {
  if (!isDrawing.value) return
  isDrawing.value = false
  saveSignature()
}

function handleTouchStart(e: TouchEvent) {
  if (!ctx.value || e.touches.length === 0) return
  isDrawing.value = true
  const touch = e.touches[0]!
  const { x, y } = getCanvasCoordinates(touch)
  ctx.value.beginPath()
  ctx.value.moveTo(x, y)
}

function handleTouchMove(e: TouchEvent) {
  if (!isDrawing.value || !ctx.value || e.touches.length === 0) return
  const touch = e.touches[0]!
  const { x, y } = getCanvasCoordinates(touch)
  ctx.value.lineTo(x, y)
  ctx.value.stroke()
}

function saveSignature() {
  if (!signatureCanvas.value) return
  const dataUrl = signatureCanvas.value.toDataURL('image/png')
  emit('update', { signature: dataUrl })
}

function clearSignature() {
  if (!signatureCanvas.value || !ctx.value) return
  ctx.value.clearRect(0, 0, signatureCanvas.value.width, signatureCanvas.value.height)
  emit('update', { signature: '' })
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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

.font-signature {
  font-family: 'Brush Script MT', 'Segoe Script', cursive;
}
</style>
