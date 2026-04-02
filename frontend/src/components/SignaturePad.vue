<template>
  <div class="signature-pad-container">
    <div v-if="label" class="mb-2 flex items-center justify-between">
      <label class="block text-sm font-medium text-gray-700 dark:text-slate-200">
        {{ label }} *
      </label>
      <button
        type="button"
        @click="clear"
        class="text-sm text-red-600 hover:text-red-700 font-medium"
      >
        Clear
      </button>
    </div>

    <!-- Draw Mode -->
    <div v-if="mode === 'draw'" class="signature-pad-wrapper border-2 border-gray-300 dark:border-slate-600 rounded-t-lg bg-white dark:bg-slate-800">
      <canvas
        ref="canvas"
        @mousedown="startDrawing"
        @mousemove="draw"
        @mouseup="stopDrawing"
        @touchstart.prevent="handleTouchStart"
        @touchmove.prevent="handleTouchMove"
        @touchend.prevent="stopDrawing"
        :class="['signature-canvas cursor-crosshair', compact ? 'compact' : '']"
      ></canvas>
    </div>

    <!-- Type Mode -->
    <div v-else :class="['signature-pad-wrapper border-2 border-gray-300 dark:border-slate-600 rounded-t-lg bg-white dark:bg-slate-800', compact ? 'p-2' : 'p-4']">
      <input
        v-model="typedSignature"
        type="text"
        :placeholder="typePlaceholder"
        @input="updateTypedSignature"
        :class="['w-full font-signature text-center border-none focus:outline-none focus:ring-0 bg-transparent dark:text-white', compact ? 'text-2xl' : 'text-4xl']"
        style="font-family: 'Brush Script MT', cursive;"
      />
      <canvas ref="typeCanvas" class="hidden"></canvas>
    </div>

    <!-- Mode Toggle Buttons -->
    <div class="flex border-2 border-t-0 border-gray-300 dark:border-slate-600 rounded-b-lg overflow-hidden">
      <button
        type="button"
        @click="mode = 'draw'"
        :class="[
          'w-1/2 text-sm font-medium transition-colors',
          compact ? 'py-1.5' : 'py-2',
          mode === 'draw'
            ? 'bg-primary text-white'
            : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
        ]"
      >
        Draw
      </button>
      <button
        type="button"
        @click="mode = 'type'"
        :class="[
          'w-1/2 text-sm font-medium transition-colors border-l-2 border-gray-300 dark:border-slate-600',
          compact ? 'py-1.5' : 'py-2',
          mode === 'type'
            ? 'bg-primary text-white'
            : 'bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600'
        ]"
      >
        Type
      </button>
    </div>

    <div v-if="!label" class="flex items-center justify-between mt-1">
      <p class="text-xs text-gray-500 dark:text-slate-400">
        {{ mode === 'draw' ? 'Draw your signature' : 'Type your signature' }}
      </p>
      <button
        type="button"
        @click="clear"
        class="text-xs text-red-600 hover:text-red-700 font-medium"
      >
        Clear
      </button>
    </div>
    <p v-else class="mt-1 text-xs text-gray-500 dark:text-slate-400">
      {{ mode === 'draw' ? 'Draw your signature above using your mouse or touchscreen' : 'Type your signature above' }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = withDefaults(defineProps<{
  modelValue: string
  label?: string
  typePlaceholder?: string
  compact?: boolean
}>(), {
  compact: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const typeCanvas = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const context = ref<CanvasRenderingContext2D | null>(null)
const mode = ref<'draw' | 'type'>('draw')
const typedSignature = ref('')

onMounted(() => {
  const canvasHeight = props.compact ? 70 : 200
  const dpr = window.devicePixelRatio || 1

  if (canvas.value) {
    const width = canvas.value.offsetWidth
    canvas.value.width = width * dpr
    canvas.value.height = canvasHeight * dpr
    canvas.value.style.width = width + 'px'
    canvas.value.style.height = canvasHeight + 'px'

    context.value = canvas.value.getContext('2d')
    if (context.value) {
      context.value.scale(dpr, dpr)
      context.value.strokeStyle = '#000000'
      context.value.lineWidth = 3
      context.value.lineCap = 'round'
      context.value.lineJoin = 'round'
    }

    // Load existing signature if provided
    if (props.modelValue) {
      const img = new Image()
      img.onload = () => {
        if (context.value && canvas.value) {
          context.value.drawImage(img, 0, 0, width, canvasHeight)
        }
      }
      img.src = props.modelValue
    }
  }

  // Setup type canvas
  if (typeCanvas.value) {
    typeCanvas.value.width = 600
    typeCanvas.value.height = canvasHeight
  }

  // Listen for mouseup on document so strokes end even if mouse leaves canvas
  document.addEventListener('mouseup', handleDocumentMouseUp)
})

const handleDocumentMouseUp = () => {
  if (isDrawing.value) {
    stopDrawing()
  }
}

onUnmounted(() => {
  document.removeEventListener('mouseup', handleDocumentMouseUp)
})

// Watch mode changes to clear when switching
watch(mode, (newMode) => {
  if (newMode === 'type') {
    // Clear draw canvas when switching to type
    if (context.value && canvas.value) {
      context.value.clearRect(0, 0, canvas.value.width, canvas.value.height)
    }
  } else {
    // Clear typed signature when switching to draw
    typedSignature.value = ''
  }
})

const startDrawing = (e: MouseEvent) => {
  if (!context.value || !canvas.value) return

  isDrawing.value = true
  const rect = canvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  context.value.beginPath()
  context.value.moveTo(x, y)
}

const draw = (e: MouseEvent) => {
  if (!isDrawing.value || !context.value || !canvas.value) return

  const rect = canvas.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top

  context.value.lineTo(x, y)
  context.value.stroke()
}

const stopDrawing = () => {
  if (isDrawing.value) {
    isDrawing.value = false
    saveSignature()
  }
}

const handleTouchStart = (e: TouchEvent) => {
  if (!context.value || !canvas.value) return

  isDrawing.value = true
  const rect = canvas.value.getBoundingClientRect()
  const touch = e.touches[0]
  if (!touch) return
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top

  context.value.beginPath()
  context.value.moveTo(x, y)
}

const handleTouchMove = (e: TouchEvent) => {
  if (!isDrawing.value || !context.value || !canvas.value) return

  const rect = canvas.value.getBoundingClientRect()
  const touch = e.touches[0]
  if (!touch) return
  const x = touch.clientX - rect.left
  const y = touch.clientY - rect.top

  context.value.lineTo(x, y)
  context.value.stroke()
}

const clear = () => {
  if (mode.value === 'draw') {
    if (!context.value || !canvas.value) return
    const dpr = window.devicePixelRatio || 1
    context.value.clearRect(0, 0, canvas.value.width / dpr, canvas.value.height / dpr)
  } else {
    typedSignature.value = ''
  }
  emit('update:modelValue', '')
}

const saveSignature = () => {
  if (!canvas.value) return

  // Convert canvas to base64 image
  const dataUrl = canvas.value.toDataURL('image/png')
  emit('update:modelValue', dataUrl)
}

const updateTypedSignature = () => {
  if (!typeCanvas.value) return

  const ctx = typeCanvas.value.getContext('2d')
  if (!ctx) return

  // Clear canvas
  ctx.clearRect(0, 0, typeCanvas.value.width, typeCanvas.value.height)

  if (typedSignature.value) {
    // Set font and style
    ctx.font = '60px "Brush Script MT", cursive'
    ctx.fillStyle = '#000000'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Draw text
    ctx.fillText(typedSignature.value, typeCanvas.value.width / 2, typeCanvas.value.height / 2)

    // Convert to image and emit
    const dataUrl = typeCanvas.value.toDataURL('image/png')
    emit('update:modelValue', dataUrl)
  } else {
    emit('update:modelValue', '')
  }
}
</script>

<style scoped>
.signature-pad-wrapper {
  position: relative;
  width: 100%;
}

.signature-canvas {
  display: block;
  width: 100%;
  height: 200px;
  touch-action: none;
}

.signature-canvas.compact {
  height: 70px;
}

.font-signature {
  font-family: 'Brush Script MT', cursive;
}
</style>
