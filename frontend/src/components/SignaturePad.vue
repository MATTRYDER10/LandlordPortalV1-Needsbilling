<template>
  <div class="signature-pad-container">
    <div class="mb-2 flex items-center justify-between">
      <label class="block text-sm font-medium text-gray-700">
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

    <div class="signature-pad-wrapper border-2 border-gray-300 rounded-lg bg-white">
      <canvas
        ref="canvas"
        @mousedown="startDrawing"
        @mousemove="draw"
        @mouseup="stopDrawing"
        @mouseleave="stopDrawing"
        @touchstart.prevent="handleTouchStart"
        @touchmove.prevent="handleTouchMove"
        @touchend.prevent="stopDrawing"
        class="signature-canvas cursor-crosshair"
      ></canvas>
    </div>

    <p class="mt-1 text-xs text-gray-500">
      Draw your signature above using your mouse or touchscreen
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  modelValue: string
  label?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const isDrawing = ref(false)
const context = ref<CanvasRenderingContext2D | null>(null)

onMounted(() => {
  if (canvas.value) {
    // Set canvas size
    canvas.value.width = canvas.value.offsetWidth
    canvas.value.height = 200

    context.value = canvas.value.getContext('2d')
    if (context.value) {
      context.value.strokeStyle = '#000000'
      context.value.lineWidth = 2
      context.value.lineCap = 'round'
      context.value.lineJoin = 'round'
    }

    // Load existing signature if provided
    if (props.modelValue) {
      const img = new Image()
      img.onload = () => {
        if (context.value && canvas.value) {
          context.value.drawImage(img, 0, 0)
        }
      }
      img.src = props.modelValue
    }
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
  if (!context.value || !canvas.value) return

  context.value.clearRect(0, 0, canvas.value.width, canvas.value.height)
  emit('update:modelValue', '')
}

const saveSignature = () => {
  if (!canvas.value) return

  // Convert canvas to base64 image
  const dataUrl = canvas.value.toDataURL('image/png')
  emit('update:modelValue', dataUrl)
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
</style>
