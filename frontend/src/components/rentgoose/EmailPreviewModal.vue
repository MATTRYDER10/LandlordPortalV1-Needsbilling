<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="$emit('close')">
      <div class="fixed inset-0 bg-black/50" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <!-- Header -->
        <div :class="['px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div class="min-w-0 flex-1">
            <h3 class="text-lg font-semibold truncate">{{ email?.subject || 'Email Preview' }}</h3>
            <div :class="['flex items-center gap-3 mt-1 text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">
              <span>To: {{ email?.to_email }}</span>
              <span>&middot;</span>
              <span>{{ formatDate(email?.sent_at) }}</span>
              <span>&middot;</span>
              <span :class="statusClass">{{ email?.status }}</span>
            </div>
          </div>
          <button @click="$emit('close')" :class="['ml-4 p-1 rounded-lg transition-colors', isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500']">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-auto p-1">
          <iframe
            v-if="email?.html_body"
            :srcdoc="email.html_body"
            class="w-full border-0 rounded-lg"
            style="min-height: 500px; height: 100%;"
            sandbox="allow-same-origin"
          ></iframe>
          <div v-else class="flex items-center justify-center py-20">
            <p :class="['text-sm', isDark ? 'text-slate-400' : 'text-gray-500']">No HTML preview available for this email.</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDarkMode } from '../../composables/useDarkMode'

const { isDark } = useDarkMode()

const props = defineProps<{
  show: boolean
  email: {
    subject: string
    to_email: string
    status: string
    sent_at: string
    html_body: string | null
    email_category: string | null
  } | null
}>()

defineEmits(['close'])

function formatDate(dateStr?: string) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const statusClass = computed(() => {
  const s = props.email?.status
  if (s === 'delivered') return 'text-emerald-500'
  if (s === 'bounced') return 'text-red-500'
  if (s === 'sent') return 'text-blue-500'
  return isDark.value ? 'text-slate-400' : 'text-gray-500'
})
</script>
