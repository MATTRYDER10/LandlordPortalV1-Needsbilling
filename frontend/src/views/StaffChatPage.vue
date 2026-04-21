<template>
  <div class="min-h-screen bg-gray-50 dark:bg-slate-950">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <Loader2 class="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
        <p class="text-gray-500 dark:text-slate-400 text-sm">Loading conversation...</p>
      </div>
    </div>

    <!-- Not found -->
    <div v-else-if="!conversation" class="flex items-center justify-center min-h-screen">
      <div class="text-center">
        <AlertCircle class="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <h2 class="text-lg font-semibold text-gray-800 dark:text-white">Conversation not found</h2>
        <p class="text-gray-500 dark:text-slate-400 text-sm mt-1">This link may have expired or the conversation was closed.</p>
      </div>
    </div>

    <!-- Chat view -->
    <div v-else class="max-w-3xl mx-auto flex flex-col h-[100dvh]">
      <!-- Header -->
      <div class="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full flex items-center justify-center">
            <span class="text-lg">🪿</span>
          </div>
          <div>
            <h1 class="text-sm font-semibold text-gray-900 dark:text-white">GooseBot — Staff Chat</h1>
            <p class="text-xs text-gray-500 dark:text-slate-400">
              {{ conversation.user_identifier || 'Unknown user' }}
              <span v-if="conversation.user_type" class="ml-1 px-1.5 py-0.5 bg-gray-100 dark:bg-slate-800 rounded text-[10px]">
                {{ conversation.user_type }}
              </span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span
            class="px-2 py-0.5 text-[11px] font-medium rounded-full"
            :class="statusBadgeClass"
          >
            {{ statusLabel }}
          </span>
          <button
            v-if="conversation.status !== 'closed'"
            @click="resolveConversation"
            class="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Resolve & Close
          </button>
        </div>
      </div>

      <!-- Context sidebar (collapsible on mobile) -->
      <div
        v-if="conversation.escalation_reason || conversation.reference_id"
        class="bg-amber-50 dark:bg-amber-900/10 border-b border-amber-200 dark:border-amber-800/30 px-4 py-2 flex-shrink-0"
      >
        <div class="flex items-start gap-2 text-xs">
          <AlertCircle class="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div class="space-y-0.5">
            <p v-if="conversation.escalation_reason" class="text-amber-800 dark:text-amber-200">
              <strong>Escalation:</strong> {{ conversation.escalation_reason }}
            </p>
            <p v-if="conversation.reference_id" class="text-amber-700 dark:text-amber-300">
              <strong>Reference:</strong> {{ conversation.reference_id }}
            </p>
            <p v-if="conversation.offer_id" class="text-amber-700 dark:text-amber-300">
              <strong>Offer:</strong> {{ conversation.offer_id }}
            </p>
          </div>
        </div>
      </div>

      <!-- Messages -->
      <div ref="messagesContainer" class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div
          v-for="msg in conversation.messages"
          :key="msg.id"
          class="flex"
          :class="getAlignment(msg.role)"
        >
          <!-- Avatar -->
          <div v-if="msg.role !== 'system'" class="flex-shrink-0 mr-2 mt-1" :class="{ 'order-last ml-2 mr-0': msg.role === 'human' }">
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-xs"
              :class="getAvatarClass(msg.role)"
            >
              {{ getAvatarEmoji(msg.role) }}
            </div>
          </div>

          <div
            class="max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed"
            :class="getBubbleClass(msg.role)"
          >
            <p v-if="msg.role === 'system'" class="italic text-gray-500 dark:text-slate-400 text-xs text-center">
              {{ msg.content }}
            </p>
            <div v-else v-html="formatContent(msg.content)" />
            <p class="text-[10px] mt-1 opacity-50">
              {{ formatTime(msg.created_at) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Input (only if joined or joining) -->
      <div
        v-if="conversation.status !== 'closed' && conversation.status !== 'message_left'"
        class="border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex-shrink-0"
      >
        <!-- Join button if not yet joined -->
        <div v-if="!hasJoined" class="text-center">
          <button
            @click="joinConversation"
            :disabled="joining"
            class="px-6 py-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 transition-colors font-medium text-sm"
          >
            <span v-if="joining" class="flex items-center gap-2">
              <Loader2 class="w-4 h-4 animate-spin" />
              Joining...
            </span>
            <span v-else>Join Conversation</span>
          </button>
          <p class="text-xs text-gray-500 dark:text-slate-400 mt-1.5">The user is waiting for you</p>
        </div>

        <!-- Message input -->
        <div v-else class="flex items-end gap-2">
          <input
            v-model="staffName"
            v-if="!staffNameSet"
            @keydown.enter="setName"
            type="text"
            placeholder="Your name (press Enter)"
            class="flex-1 text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
          />
          <template v-else>
            <textarea
              ref="inputRef"
              v-model="messageText"
              @keydown.enter.exact.prevent="sendReply"
              rows="1"
              placeholder="Type a reply..."
              class="flex-1 text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none max-h-20"
              style="field-sizing: content"
            />
            <button
              @click="sendReply"
              :disabled="!messageText.trim() || sending"
              class="p-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send class="w-4 h-4" />
            </button>
          </template>
        </div>
      </div>

      <!-- Closed state -->
      <div
        v-if="conversation.status === 'closed'"
        class="border-t border-gray-200 dark:border-slate-700 bg-green-50 dark:bg-green-900/10 px-4 py-3 text-center flex-shrink-0"
      >
        <p class="text-sm text-green-700 dark:text-green-300 font-medium flex items-center justify-center gap-1.5">
          <CheckCircle class="w-4 h-4" />
          Conversation resolved
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Send, Loader2, AlertCircle, CheckCircle } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const route = useRoute()
const token = computed(() => route.params.token as string)

// State
const loading = ref(true)
const conversation = ref<any>(null)
const hasJoined = ref(false)
const joining = ref(false)
const staffName = ref('')
const staffNameSet = ref(false)
const messageText = ref('')
const sending = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
let pollInterval: ReturnType<typeof setInterval> | null = null

// Computed
const statusLabel = computed(() => {
  switch (conversation.value?.status) {
    case 'waiting_for_human': return 'Waiting'
    case 'human_joined': return 'Active'
    case 'closed': return 'Closed'
    case 'message_left': return 'Message Left'
    default: return conversation.value?.status || ''
  }
})

const statusBadgeClass = computed(() => {
  switch (conversation.value?.status) {
    case 'waiting_for_human': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
    case 'human_joined': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
    case 'closed': return 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400'
    default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
  }
})

// Load conversation
onMounted(async () => {
  try {
    const response = await fetch(`${API_URL}/api/chat/staff/${token.value}`)
    if (response.ok) {
      conversation.value = await response.json()
      hasJoined.value = conversation.value.status === 'human_joined'
      startPolling()
    }
  } catch (err) {
    console.error('Failed to load conversation:', err)
  } finally {
    loading.value = false
    scrollToBottom()
  }
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

// Join
async function joinConversation() {
  joining.value = true
  try {
    const response = await fetch(`${API_URL}/api/chat/staff/${token.value}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffName: staffName.value || undefined }),
    })
    if (response.ok) {
      hasJoined.value = true
      if (conversation.value) conversation.value.status = 'human_joined'
    }
  } finally {
    joining.value = false
  }
}

// Set name
function setName() {
  if (staffName.value.trim()) {
    staffNameSet.value = true
    nextTick(() => inputRef.value?.focus())
  }
}

// Send reply
async function sendReply() {
  if (!messageText.value.trim() || sending.value) return
  sending.value = true
  const content = messageText.value
  messageText.value = ''

  // Optimistic: show message immediately
  const displayContent = staffName.value ? `**${staffName.value}:** ${content}` : content
  conversation.value?.messages?.push({
    id: `temp-${Date.now()}`,
    role: 'human',
    content: displayContent,
    created_at: new Date().toISOString(),
  })
  scrollToBottom()

  try {
    await fetch(`${API_URL}/api/chat/staff/${token.value}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, staffName: staffName.value }),
    })
  } finally {
    sending.value = false
    nextTick(() => inputRef.value?.focus())
  }
}

// Resolve
async function resolveConversation() {
  try {
    await fetch(`${API_URL}/api/chat/staff/${token.value}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary: 'Resolved by staff via chat' }),
    })
    if (conversation.value) conversation.value.status = 'closed'
    if (pollInterval) clearInterval(pollInterval)
  } catch (err) {
    console.error('Failed to close:', err)
  }
}

// Polling
function startPolling() {
  pollInterval = setInterval(async () => {
    if (!conversation.value) return
    try {
      const msgs = conversation.value.messages
      const lastMsg = msgs[msgs.length - 1]
      const since = lastMsg?.created_at || ''
      const response = await fetch(`${API_URL}/api/chat/${conversation.value.id}/messages?since=${encodeURIComponent(since)}`)
      const data = await response.json()
      if (data.messages?.length) {
        for (const msg of data.messages) {
          const exists = msgs.some((m: any) => m.id === msg.id)
          if (!exists) {
            msgs.push(msg)
          }
        }
        scrollToBottom()
      }
    } catch {
      // silent
    }
  }, 2000)
}

// Helpers
function getAlignment(role: string) {
  if (role === 'human') return 'justify-end'
  if (role === 'system') return 'justify-center'
  return 'justify-start'
}

function getAvatarClass(role: string) {
  switch (role) {
    case 'user': return 'bg-gray-200 dark:bg-slate-700'
    case 'assistant': return 'bg-orange-100 dark:bg-orange-900/30'
    case 'human': return 'bg-blue-100 dark:bg-blue-900/30'
    default: return 'bg-gray-100 dark:bg-slate-800'
  }
}

function getAvatarEmoji(role: string) {
  switch (role) {
    case 'user': return '👤'
    case 'assistant': return '🪿'
    case 'human': return '🧑'
    default: return '💬'
  }
}

function getBubbleClass(role: string) {
  switch (role) {
    case 'user': return 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-white rounded-bl-md'
    case 'assistant': return 'bg-orange-50 dark:bg-orange-900/10 text-gray-800 dark:text-white rounded-bl-md'
    case 'human': return 'bg-blue-500 text-white rounded-br-md'
    case 'system': return 'bg-transparent w-full'
    default: return 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-white'
  }
}

function formatContent(content: string): string {
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  html = html.replace(/\n/g, '<br>')
  return html
}

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}
</script>
