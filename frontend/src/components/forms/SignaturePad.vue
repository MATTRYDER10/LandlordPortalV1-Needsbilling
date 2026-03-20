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
const lastPoint = ref<{ x: number; y: number } | null>(null)
const lastEmitTime = ref(0)

onMounted(() => {
  setTimeout(() => {
    initCanvas()
  }, 50)
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

watch(() => props.modelValue, (newValue) => {
  // Skip if this change came from our own emit within the last 500ms
  if (Date.now() - lastEmitTime.value < 500) return

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
  } else if (!newValue) {
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
    ctx.value.lineWidth = 2.5
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

function startDrawing(event: MouseEvent) {
  event.preventDefault()
  isDrawing.value = true
  const pos = getPos(event)
  lastPoint.value = pos
  ctx.value?.beginPath()
  ctx.value?.moveTo(pos.x, pos.y)
  // Draw a small dot for click without drag
  ctx.value?.arc(pos.x, pos.y, 1, 0, Math.PI * 2)
  ctx.value?.fill()
}

function draw(event: MouseEvent) {
  if (!isDrawing.value || !ctx.value) return
  event.preventDefault()

  const pos = getPos(event)

  // Draw smooth line using quadratic curves
  if (lastPoint.value) {
    ctx.value.beginPath()
    ctx.value.moveTo(lastPoint.value.x, lastPoint.value.y)

    // Use quadratic curve for smoother lines
    const midX = (lastPoint.value.x + pos.x) / 2
    const midY = (lastPoint.value.y + pos.y) / 2
    ctx.value.quadraticCurveTo(lastPoint.value.x, lastPoint.value.y, midX, midY)
    ctx.value.stroke()
  }

  lastPoint.value = pos
}

function handleTouchStart(event: TouchEvent) {
  event.preventDefault()
  if (event.touches.length === 1) {
    isDrawing.value = true
    const pos = getPos(event.touches[0])
    lastPoint.value = pos
    ctx.value?.beginPath()
    ctx.value?.moveTo(pos.x, pos.y)
    // Draw a small dot for tap without drag
    ctx.value?.arc(pos.x, pos.y, 1, 0, Math.PI * 2)
    ctx.value?.fill()
  }
}

function handleTouchMove(event: TouchEvent) {
  event.preventDefault()
  if (!isDrawing.value || !ctx.value || event.touches.length !== 1) return

  const pos = getPos(event.touches[0])

  // Draw smooth line using quadratic curves
  if (lastPoint.value) {
    ctx.value.beginPath()
    ctx.value.moveTo(lastPoint.value.x, lastPoint.value.y)

    const midX = (lastPoint.value.x + pos.x) / 2
    const midY = (lastPoint.value.y + pos.y) / 2
    ctx.value.quadraticCurveTo(lastPoint.value.x, lastPoint.value.y, midX, midY)
    ctx.value.stroke()
  }

  lastPoint.value = pos
}

function stopDrawing() {
  if (isDrawing.value) {
    isDrawing.value = false
    lastPoint.value = null
    hasSignature.value = !isCanvasEmpty()
    if (hasSignature.value) {
      lastEmitTime.value = Date.now()
      emit('update:modelValue', getSignatureData())
    }
  }
}

function isCanvasEmpty(): boolean {
  if (!canvas.value || !ctx.value) return true
  const imageData = ctx.value.getImageData(0, 0, canvas.value.width, canvas.value.height)
  return !imageData.data.some((channel, index) => {
    return index % 4 === 3 && channel !== 0
  })
}

function getSignatureData(): string {
  return canvas.value?.toDataURL('image/png') || ''
}

function clear() {
  if (!canvas.value || !ctx.value) return
  const dpr = window.devicePixelRatio || 1
  ctx.value.clearRect(0, 0, canvas.value.width / dpr, canvas.value.height / dpr)
  hasSignature.value = false
  lastPoint.value = null
  emit('update:modelValue', null)
}

defineExpose({
  clear,
  getSignatureData,
  hasSignature
})
</script>
