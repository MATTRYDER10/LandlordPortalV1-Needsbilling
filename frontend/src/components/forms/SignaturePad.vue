<template>
  <div class="space-y-3">
    <label v-if="label" class="block text-sm font-medium text-gray-700 dark:text-slate-300">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>

    <!-- Signature Canvas -->
    <div
      class="relative border-2 rounded-lg overflow-hidden bg-white dark:bg-slate-900"
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
        @touchstart.prevent="handleTouchStart"
        @touchmove.prevent="handleTouchMove"
        @touchend="stopDrawing"
        class="w-full cursor-crosshair"
        :style="{ height: height + 'px' }"
      ></canvas>

      <!-- Clear Button -->
      <button
        v-if="hasSignature"
        type="button"
        @click="clear"
        class="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
      >
        <RotateCcw class="w-4 h-4 text-gray-500 dark:text-slate-400" />
      </button>

      <!-- Placeholder Text -->
      <div
        v-if="!hasSignature"
        class="absolute inset-0 flex items-center justify-center pointer-events-none"
      >
        <p class="text-gray-400 dark:text-slate-500 text-sm">Sign here</p>
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
  height: 150
})

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const canvas = ref<HTMLCanvasElement>()
const ctx = ref<CanvasRenderingContext2D | null>(null)
const isDrawing = ref(false)
const hasSignature = ref(false)
const error = ref('')

onMounted(() => {
  initCanvas()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

watch(() => props.modelValue, (newValue) => {
  if (newValue && canvas.value && ctx.value) {
    const img = new Image()
    img.onload = () => {
      ctx.value?.clearRect(0, 0, canvas.value!.width, canvas.value!.height)
      ctx.value?.drawImage(img, 0, 0)
      hasSignature.value = true
    }
    img.src = newValue
  } else if (!newValue) {
    clear()
  }
})

function initCanvas() {
  if (!canvas.value) return

  const rect = canvas.value.getBoundingClientRect()
  canvas.value.width = rect.width * window.devicePixelRatio
  canvas.value.height = props.height * window.devicePixelRatio

  canvas.value.style.width = rect.width + 'px'
  canvas.value.style.height = props.height + 'px'

  ctx.value = canvas.value.getContext('2d')
  if (ctx.value) {
    ctx.value.scale(window.devicePixelRatio, window.devicePixelRatio)
    ctx.value.strokeStyle = '#1f2937'
    ctx.value.lineWidth = 2
    ctx.value.lineCap = 'round'
    ctx.value.lineJoin = 'round'
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
  isDrawing.value = true
  const pos = getPos(event)
  ctx.value?.beginPath()
  ctx.value?.moveTo(pos.x, pos.y)
}

function draw(event: MouseEvent) {
  if (!isDrawing.value || !ctx.value) return
  const pos = getPos(event)
  ctx.value.lineTo(pos.x, pos.y)
  ctx.value.stroke()
}

function handleTouchStart(event: TouchEvent) {
  if (event.touches.length === 1) {
    isDrawing.value = true
    const pos = getPos(event.touches[0])
    ctx.value?.beginPath()
    ctx.value?.moveTo(pos.x, pos.y)
  }
}

function handleTouchMove(event: TouchEvent) {
  if (!isDrawing.value || !ctx.value || event.touches.length !== 1) return
  const pos = getPos(event.touches[0])
  ctx.value.lineTo(pos.x, pos.y)
  ctx.value.stroke()
}

function stopDrawing() {
  if (isDrawing.value) {
    isDrawing.value = false
    hasSignature.value = !isCanvasEmpty()
    if (hasSignature.value) {
      emit('update:modelValue', getSignatureData())
    }
  }
}

function isCanvasEmpty(): boolean {
  if (!canvas.value || !ctx.value) return true
  const imageData = ctx.value.getImageData(0, 0, canvas.value.width, canvas.value.height)
  return !imageData.data.some((channel, index) => {
    // Check alpha channel (every 4th value starting at index 3)
    return index % 4 === 3 && channel !== 0
  })
}

function getSignatureData(): string {
  return canvas.value?.toDataURL('image/png') || ''
}

function clear() {
  if (!canvas.value || !ctx.value) return
  ctx.value.clearRect(0, 0, canvas.value.width / window.devicePixelRatio, canvas.value.height / window.devicePixelRatio)
  hasSignature.value = false
  emit('update:modelValue', null)
}

defineExpose({
  clear,
  getSignatureData,
  hasSignature
})
</script>
