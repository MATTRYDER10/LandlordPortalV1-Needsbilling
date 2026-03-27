<template>
  <div class="space-y-3">
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-slate-300">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>

    <!-- Signature Canvas -->
    <div
      class="relative border-2 rounded-xl overflow-hidden bg-white dark:bg-slate-900"
      :class="[
        hasSignature ? 'border-green-500' : 'border-gray-300 dark:border-slate-600',
        error ? 'border-red-500' : ''
      ]"
    >
      <canvas
        ref="canvas"
        @mousedown="startDrawing"
        @mousemove="draw"
        @mouseup="stopDrawing"
        @mouseleave="stopDrawing"
        @touchstart="handleTouchStart"
        @touchmove="handleTouchMove"
        @touchend="stopDrawing"
        @touchcancel="stopDrawing"
        class="w-full cursor-crosshair select-none"
        :style="{
          height: height + 'px',
          minHeight: height + 'px',
          touchAction: 'none'
        }"
      ></canvas>

      <!-- Clear Button -->
      <button
        v-if="hasSignature"
        type="button"
        @click="clear"
        class="absolute top-3 right-3 p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <RotateCcw class="w-5 h-5 text-gray-500 dark:text-slate-400" />
      </button>

      <!-- Placeholder Text -->
      <div
        v-if="!hasSignature"
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <p class="text-gray-400 dark:text-slate-500 text-base">Sign here</p>
      </div>
    </div>

    <!-- Status -->
    <div class="flex items-center justify-between text-sm">
      <div v-if="hasSignature" class="flex items-center gap-1 text-green-600 dark:text-green-400">
        <CheckCircle class="w-4 h-4" />
        <span>Signature captured</span>
      </div>
      <div v-else class="text-gray-500 dark:text-slate-400">
        Use your mouse or finger to sign above
      </div>
    </div>

    <!-- Error Message -->
    <p v-if="error" class="text-sm text-red-500">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { RotateCcw, CheckCircle } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  label?: string
  required?: boolean
  height?: number
  modelValue?: string | null
}>(), {
  height: 200
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const canvas = ref<HTMLCanvasElement>()
const ctx = ref<CanvasRenderingContext2D | null>(null)
const isDrawing = ref(false)
const hasSignature = ref(false)
const error = ref('')
// Store points for current stroke to draw smooth continuous lines
const points = ref<{ x: number; y: number }[]>([])

onMounted(() => {
  setTimeout(() => {
    initCanvas()
  }, 50)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

// Track whether the user has interacted with the pad (drawn anything)
const userHasDrawn = ref(false)

// Only restore signature from modelValue on initial load or external reset
// NEVER redraw while user is drawing — this causes the erasing bug on mobile
watch(() => props.modelValue, (newValue) => {
  // Once user has drawn, ignore all external modelValue changes
  if (userHasDrawn.value) return

  if (newValue && canvas.value && ctx.value) {
    const img = new Image()
    img.onload = () => {
      if (!ctx.value || !canvas.value) return
      const dpr = window.devicePixelRatio || 1
      ctx.value.clearRect(0, 0, canvas.value.width / dpr, canvas.value.height / dpr)
      const cssWidth = canvas.value.width / dpr
      const cssHeight = canvas.value.height / dpr
      ctx.value.drawImage(img, 0, 0, cssWidth, cssHeight)
      hasSignature.value = true
    }
    img.src = newValue
  } else if (!newValue && !userHasDrawn.value) {
    clear()
  }
})

function initCanvas(retryCount = 0) {
  if (!canvas.value) return

  const rect = canvas.value.getBoundingClientRect()

  if (rect.width === 0 && retryCount < 3) {
    setTimeout(() => initCanvas(retryCount + 1), 100)
    return
  }

  const width = rect.width > 0 ? rect.width : (canvas.value.parentElement?.clientWidth || 300)
  const dpr = window.devicePixelRatio || 1

  canvas.value.width = width * dpr
  canvas.value.height = props.height * dpr

  canvas.value.style.width = width + 'px'
  canvas.value.style.height = props.height + 'px'

  // Use willReadFrequently for better performance with getImageData
  ctx.value = canvas.value.getContext('2d', { willReadFrequently: true })
  if (ctx.value) {
    ctx.value.scale(dpr, dpr)
    ctx.value.strokeStyle = '#1a1a1a'
    ctx.value.lineWidth = 3
    ctx.value.lineCap = 'round'
    ctx.value.lineJoin = 'round'
    ctx.value.imageSmoothingEnabled = true
    ctx.value.imageSmoothingQuality = 'high'
  }
}

function handleResize() {
  const signature = hasSignature.value ? getSignatureData() : null
  initCanvas()
  if (signature && ctx.value && canvas.value) {
    const img = new Image()
    img.onload = () => {
      ctx.value?.drawImage(img, 0, 0)
    }
    img.src = signature
  }
}

function getPos(event: MouseEvent | Touch): { x: number; y: number } {
  const rect = canvas.value!.getBoundingClientRect()
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  }
}

function beginStroke(pos: { x: number; y: number }) {
  isDrawing.value = true
  userHasDrawn.value = true
  points.value = [pos]

  if (!ctx.value) return
  ctx.value.beginPath()
  ctx.value.moveTo(pos.x, pos.y)
  // Draw a dot so single clicks are visible
  ctx.value.lineTo(pos.x + 0.1, pos.y + 0.1)
  ctx.value.stroke()
}

function continueStroke(pos: { x: number; y: number }) {
  if (!isDrawing.value || !ctx.value) return

  points.value.push(pos)
  const pts = points.value
  const len = pts.length

  if (len < 2) return

  // Use quadratic curve through midpoints for silky smooth lines
  // This avoids the "dots" problem by continuing the existing path
  ctx.value.beginPath()
  ctx.value.moveTo(pts[len - 2].x, pts[len - 2].y)

  if (len >= 3) {
    // Smooth curve: use previous point as control, midpoint as endpoint
    const prev = pts[len - 3]
    const curr = pts[len - 2]
    const next = pts[len - 1]
    const midX = (curr.x + next.x) / 2
    const midY = (curr.y + next.y) / 2
    ctx.value.quadraticCurveTo(curr.x, curr.y, midX, midY)
  } else {
    // Just 2 points — draw a straight line
    ctx.value.lineTo(pos.x, pos.y)
  }

  ctx.value.stroke()
}

function endStroke() {
  if (!isDrawing.value) return
  isDrawing.value = false
  points.value = []
  hasSignature.value = true
  emit('update:modelValue', getSignatureData())
}

function startDrawing(event: MouseEvent) {
  event.preventDefault()
  beginStroke(getPos(event))
}

function draw(event: MouseEvent) {
  if (!isDrawing.value) return
  event.preventDefault()
  continueStroke(getPos(event))
}

function handleTouchStart(event: TouchEvent) {
  event.preventDefault()
  if (event.touches.length === 1) {
    beginStroke(getPos(event.touches[0]))
  }
}

function handleTouchMove(event: TouchEvent) {
  event.preventDefault()
  if (event.touches.length === 1) {
    continueStroke(getPos(event.touches[0]))
  }
}

function stopDrawing() {
  endStroke()
}

function getSignatureData(): string {
  return canvas.value?.toDataURL('image/png') || ''
}

function clear() {
  if (!canvas.value || !ctx.value) return
  const dpr = window.devicePixelRatio || 1
  ctx.value.clearRect(0, 0, canvas.value.width / dpr, canvas.value.height / dpr)
  hasSignature.value = false
  userHasDrawn.value = false
  points.value = []
  emit('update:modelValue', null)
}

defineExpose({
  clear,
  getSignatureData,
  hasSignature
})
</script>
