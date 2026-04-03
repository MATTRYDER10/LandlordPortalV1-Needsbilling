<template>
  <div ref="containerRef" class="pdf-viewer-container" @touchstart="onTouchStart" @touchmove="onTouchMove" @touchend="onTouchEnd">
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
        <p class="text-sm text-gray-500">Loading document...</p>
      </div>
    </div>
    <div v-if="errorMsg" class="flex items-center justify-center py-16">
      <p class="text-sm text-red-500">{{ errorMsg }}</p>
    </div>
    <div ref="pagesRef" class="pdf-pages">
      <canvas
        v-for="page in pageCount"
        :key="page"
        :ref="el => setCanvasRef(el, page)"
        class="pdf-page"
      ></canvas>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'

const props = defineProps<{
  src: string
}>()

const containerRef = ref<HTMLElement | null>(null)
const pagesRef = ref<HTMLElement | null>(null)
const loading = ref(true)
const errorMsg = ref('')
const pageCount = ref(0)
const canvasRefs = new Map<number, HTMLCanvasElement>()

function setCanvasRef(el: any, page: number) {
  if (el) canvasRefs.set(page, el as HTMLCanvasElement)
}

// Touch handling to prevent iOS rubber-banding while allowing scroll
let touchStartY = 0
function onTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0]!.clientY
}
function onTouchMove(_e: TouchEvent) {
  // Let native scroll handle it — the container has overflow-y: auto
}
function onTouchEnd() {}

async function loadPdf() {
  if (!props.src) return
  loading.value = true
  errorMsg.value = ''

  try {
    const pdfjsLib = await import('pdfjs-dist')

    // Set worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()

    const loadingTask = pdfjsLib.getDocument(props.src)
    const pdf = await loadingTask.promise
    pageCount.value = pdf.numPages

    await nextTick()

    const container = containerRef.value
    if (!container) return

    // Determine scale: fit width, with a reasonable max for desktop
    const containerWidth = container.clientWidth
    const isMobile = containerWidth < 768

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const unscaledViewport = page.getViewport({ scale: 1 })

      // On mobile: fit to container width with small padding
      // On desktop: fit to container width but cap at a readable scale
      const padding = isMobile ? 8 : 40
      const availableWidth = containerWidth - (padding * 2)
      let scale = availableWidth / unscaledViewport.width

      // Desktop: cap scale so the PDF isn't zoomed in too much
      if (!isMobile && scale > 1.5) {
        scale = 1.5
      }

      const viewport = page.getViewport({ scale })
      const canvas = canvasRefs.get(i)
      if (!canvas) continue

      const context = canvas.getContext('2d')
      if (!context) continue

      // Use devicePixelRatio for crisp rendering
      const dpr = window.devicePixelRatio || 1
      canvas.width = viewport.width * dpr
      canvas.height = viewport.height * dpr
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      context.scale(dpr, dpr)

      await page.render({ canvasContext: context, viewport }).promise
    }
  } catch (err: any) {
    console.error('Failed to load PDF:', err)
    errorMsg.value = 'Failed to load document'
  } finally {
    loading.value = false
  }
}

onMounted(loadPdf)
watch(() => props.src, loadPdf)
</script>

<style scoped>
.pdf-viewer-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  background: #525659;
}

.pdf-pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
  gap: 8px;
}

@media (min-width: 768px) {
  .pdf-pages {
    padding: 20px 0;
    gap: 16px;
  }
}

.pdf-page {
  display: block;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  background: white;
}
</style>
