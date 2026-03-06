<template>
  <div class="divide-y divide-gray-200 dark:divide-slate-800">
    <div
      v-for="faq in faqs"
      :key="faq.id"
      :id="faq.id"
      :ref="el => { if (el) faqRefs[faq.id] = el as HTMLElement }"
      :class="[
        'group transition-colors',
        highlightedId === faq.id ? 'bg-primary/5 dark:bg-primary/10' : ''
      ]"
    >
      <button
        @click="toggle(faq.id)"
        class="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span class="font-medium text-gray-900 dark:text-white pr-4">{{ faq.question }}</span>
        <ChevronDown
          :class="[
            'w-5 h-5 text-gray-400 dark:text-slate-500 flex-shrink-0 transition-transform duration-200',
            expanded.has(faq.id) ? 'rotate-180' : ''
          ]"
        />
      </button>
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-96"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 max-h-96"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="expanded.has(faq.id)" class="overflow-hidden">
          <div class="px-4 pb-4">
            <p class="text-gray-600 dark:text-slate-300 leading-relaxed">
              {{ faq.answer }}
            </p>
            <router-link
              v-if="faq.relatedGuide"
              :to="`/help-centre/article/${faq.relatedGuide}`"
              class="inline-flex items-center gap-1 mt-3 text-sm text-primary hover:text-primary-dark font-medium"
            >
              Read full guide
              <ExternalLink class="w-3.5 h-3.5" />
            </router-link>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ChevronDown, ExternalLink } from 'lucide-vue-next'
import type { FAQ } from '@/composables/useHelpContent'

const props = defineProps<{
  faqs: FAQ[]
  highlightedId?: string
}>()

const route = useRoute()
const expanded = ref(new Set<string>())
const faqRefs = ref<Record<string, HTMLElement>>({})

// Toggle FAQ
const toggle = (id: string) => {
  if (expanded.value.has(id)) {
    expanded.value.delete(id)
  } else {
    expanded.value.add(id)
  }
}

// Expand and scroll to FAQ if highlighted
const scrollToHighlighted = async () => {
  const highlightId = (route.query.highlight as string) || props.highlightedId
  if (highlightId) {
    expanded.value.add(highlightId)
    await nextTick()
    const el = faqRefs.value[highlightId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }
}

onMounted(() => {
  scrollToHighlighted()
})

watch(() => props.highlightedId, () => {
  scrollToHighlighted()
})

watch(() => route.query.highlight, () => {
  scrollToHighlighted()
})
</script>
