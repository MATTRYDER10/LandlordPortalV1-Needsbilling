<template>
  <!-- Floating chat bubble -->
  <div class="goosebot-widget" :class="{ 'goosebot-open': isOpen }">
    <!-- Chat window -->
    <Transition
      enter-active-class="transition ease-out duration-200 origin-bottom-right"
      enter-from-class="opacity-0 scale-90 translate-y-4"
      enter-to-class="opacity-100 scale-100 translate-y-0"
      leave-active-class="transition ease-in duration-150 origin-bottom-right"
      leave-from-class="opacity-100 scale-100 translate-y-0"
      leave-to-class="opacity-0 scale-90 translate-y-4"
    >
      <div
        v-if="isOpen"
        class="fixed bottom-24 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-[400px] h-[min(500px,calc(100vh-8rem))] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 flex flex-col overflow-hidden z-[9999]"
      >
        <!-- Header -->
        <div class="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <span class="text-lg">🪿</span>
            </div>
            <div>
              <h3 class="text-white font-semibold text-sm leading-tight">GooseBot</h3>
              <p class="text-white/80 text-[11px]">
                {{ statusText }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-1">
            <button
              v-if="conversationStatus === 'active'"
              @click="requestHuman"
              class="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              title="Talk to a human"
            >
              <UserRound class="w-4 h-4" />
            </button>
            <button
              @click="isOpen = false"
              class="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div
          ref="messagesContainer"
          class="flex-1 overflow-y-auto px-4 py-3 space-y-3"
        >
          <!-- Welcome message -->
          <div v-if="messages.length === 0 && !loading" class="text-center py-6">
            <div class="w-14 h-14 bg-orange-50 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span class="text-2xl">🪿</span>
            </div>
            <p class="text-gray-800 dark:text-white font-medium text-sm">Hi! I'm GooseBot</p>
            <p class="text-gray-500 dark:text-slate-400 text-xs mt-1 max-w-[260px] mx-auto">
              {{ userType === 'agent'
                ? 'I can look up references, offers, and tenancies. How can I help?'
                : 'I can help with your reference form, check your status, and answer questions.' }}
            </p>
            <!-- Quick action buttons -->
            <div class="flex flex-wrap justify-center gap-1.5 mt-3">
              <button
                v-for="suggestion in quickSuggestions"
                :key="suggestion"
                @click="sendMessage(suggestion)"
                class="px-2.5 py-1 text-[11px] bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 rounded-full hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors"
              >
                {{ suggestion }}
              </button>
            </div>
          </div>

          <!-- Message bubbles -->
          <div
            v-for="msg in messages"
            :key="msg.id || msg.tempId"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <!-- Bot / human avatar -->
            <div v-if="msg.role !== 'user'" class="flex-shrink-0 mr-2 mt-1">
              <div
                class="w-6 h-6 rounded-full flex items-center justify-center text-[11px]"
                :class="msg.role === 'human'
                  ? 'bg-blue-100 dark:bg-blue-900/30'
                  : 'bg-orange-100 dark:bg-orange-900/30'"
              >
                {{ msg.role === 'human' ? '👤' : '🪿' }}
              </div>
            </div>

            <div
              class="max-w-[80%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed"
              :class="getBubbleClasses(msg.role)"
            >
              <!-- System messages -->
              <p v-if="msg.role === 'system'" class="italic text-gray-500 dark:text-slate-400 text-xs text-center">
                {{ msg.content }}
              </p>
              <!-- Regular messages with markdown support -->
              <div v-else v-html="formatMessage(msg.content)" class="goosebot-content" />
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="loading" class="flex justify-start">
            <div class="flex-shrink-0 mr-2 mt-1">
              <div class="w-6 h-6 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center text-[11px]">
                🪿
              </div>
            </div>
            <div class="bg-gray-100 dark:bg-slate-800 rounded-2xl px-4 py-3">
              <div class="flex gap-1">
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0ms" />
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 150ms" />
                <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 300ms" />
              </div>
            </div>
          </div>

          <!-- Waiting for human state -->
          <div v-if="conversationStatus === 'waiting_for_human'" class="text-center py-3">
            <div class="inline-flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-3 py-2 rounded-xl text-xs">
              <Loader2 class="w-3.5 h-3.5 animate-spin" />
              <span>Connecting you with a team member...</span>
            </div>
            <div v-if="waitingSeconds >= 60" class="mt-2 space-y-1.5">
              <p class="text-xs text-gray-500 dark:text-slate-400">Our team hasn't jumped in just yet.</p>
              <div class="flex justify-center gap-2">
                <button
                  @click="keepWaiting"
                  class="px-3 py-1 text-[11px] bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Keep waiting
                </button>
                <button
                  @click="showLeaveMessage = true"
                  class="px-3 py-1 text-[11px] bg-orange-500 text-white rounded-full hover:bg-orange-600 transition-colors"
                >
                  Leave a message
                </button>
              </div>
            </div>
          </div>

          <!-- Leave message form -->
          <div v-if="showLeaveMessage" class="bg-gray-50 dark:bg-slate-800 rounded-xl p-3 mt-2">
            <p class="text-xs text-gray-600 dark:text-slate-300 mb-2 font-medium">Leave a detailed message and we'll get back to you within 1 hour:</p>
            <textarea
              v-model="leaveMessageText"
              rows="3"
              class="w-full text-xs border border-gray-200 dark:border-slate-600 rounded-lg p-2 bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none"
              placeholder="Describe your issue in detail..."
            />
            <button
              @click="submitLeaveMessage"
              :disabled="!leaveMessageText.trim()"
              class="mt-1.5 w-full py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Send message
            </button>
          </div>

          <!-- Message left confirmation -->
          <div v-if="conversationStatus === 'message_left'" class="text-center py-4">
            <div class="w-10 h-10 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle class="w-5 h-5 text-green-600" />
            </div>
            <p class="text-sm font-medium text-gray-800 dark:text-white">Message sent</p>
            <p class="text-xs text-gray-500 dark:text-slate-400 mt-1">We'll get back to you within 1 hour.</p>
          </div>
        </div>

        <!-- Input area -->
        <div
          v-if="conversationStatus !== 'message_left'"
          class="border-t border-gray-200 dark:border-slate-700 px-3 py-2.5 flex-shrink-0"
        >
          <div class="flex items-end gap-2">
            <div class="flex-1 relative">
              <textarea
                ref="inputRef"
                v-model="inputText"
                @keydown.enter.exact.prevent="sendMessage()"
                rows="1"
                :placeholder="inputPlaceholder"
                :disabled="loading"
                class="w-full text-[13px] border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 resize-none max-h-20 placeholder:text-gray-400"
                style="field-sizing: content"
              />
            </div>
            <button
              @click="sendMessage()"
              :disabled="!inputText.trim() || loading"
              class="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              <Send class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Floating bubble button -->
    <button
      @click="isOpen = !isOpen"
      class="fixed bottom-4 right-4 sm:right-6 w-14 h-14 bg-gradient-to-br from-orange-500 to-amber-500 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-[9999] group"
      :class="{ 'ring-4 ring-orange-200 dark:ring-orange-900/40': hasUnread && !isOpen }"
    >
      <Transition
        enter-active-class="transition ease-out duration-200"
        enter-from-class="opacity-0 rotate-90 scale-50"
        enter-to-class="opacity-100 rotate-0 scale-100"
        leave-active-class="transition ease-in duration-150"
        leave-from-class="opacity-100 rotate-0 scale-100"
        leave-to-class="opacity-0 -rotate-90 scale-50"
        mode="out-in"
      >
        <X v-if="isOpen" class="w-6 h-6 text-white" />
        <span v-else class="text-2xl">🪿</span>
      </Transition>

      <!-- Unread dot -->
      <span
        v-if="hasUnread && !isOpen"
        class="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { Send, X, UserRound, Loader2, CheckCircle } from 'lucide-vue-next'
import { useAuthStore } from '../stores/auth'

const API_URL = import.meta.env.VITE_API_URL ?? ''

// Props for context
const props = withDefaults(defineProps<{
  userType?: 'agent' | 'tenant' | 'guarantor'
  referenceId?: string
  offerId?: string
  formToken?: string  // Tenant/guarantor form token — backend resolves referenceId from this
  userIdentifier?: string
  userName?: string
  companyId?: string
}>(), {
  userType: 'agent',
})

const authStore = useAuthStore()

// State
const isOpen = ref(false)
const inputText = ref('')
const messages = ref<Array<{
  id?: string
  tempId?: string
  role: string
  content: string
  created_at?: string
}>>([])
const loading = ref(false)
const conversationId = ref<string | null>(null)
const conversationStatus = ref('active')
const hasUnread = ref(false)
const showLeaveMessage = ref(false)
const leaveMessageText = ref('')
const waitingSeconds = ref(0)
const messagesContainer = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLTextAreaElement | null>(null)
let pollInterval: ReturnType<typeof setInterval> | null = null
let waitingInterval: ReturnType<typeof setInterval> | null = null

// Computed
const effectiveCompanyId = computed(() =>
  props.companyId || authStore.activeBranchId || authStore.company?.id
)

const statusText = computed(() => {
  switch (conversationStatus.value) {
    case 'waiting_for_human': return 'Connecting you with a team member...'
    case 'human_joined': return 'Chatting with a team member'
    case 'message_left': return 'Message sent'
    case 'closed': return 'Conversation ended'
    default: return 'AI Assistant'
  }
})

const inputPlaceholder = computed(() => {
  if (conversationStatus.value === 'human_joined') return 'Message the team member...'
  if (conversationStatus.value === 'waiting_for_human') return 'Waiting for a team member...'
  return 'Type a message...'
})

const quickSuggestions = computed(() => {
  if (props.userType === 'agent') {
    return [
      'What offers came in today?',
      'Show me all references',
      'Any payments we\'re waiting for?',
      'How do I create a tenancy?',
    ]
  }
  return [
    'What\'s the status of my reference?',
    'What documents do I need?',
    'My employer hasn\'t responded',
    'I need help with my form',
  ]
})

// Send message
async function sendMessage(text?: string) {
  const msg = (text || inputText.value).trim()
  if (!msg || loading.value) return

  inputText.value = ''
  const tempId = `temp-${Date.now()}`

  // Optimistic add
  messages.value.push({ tempId, role: 'user', content: msg })
  scrollToBottom()

  loading.value = true
  try {
    // Build headers — agents get full auth + branch headers, tenants don't
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authStore.session?.access_token) {
      headers['Authorization'] = `Bearer ${authStore.session.access_token}`
    }
    // CRITICAL: Multi-branch agents need X-Branch-Id so backend derives the correct companyId
    if (props.userType === 'agent' && authStore.activeBranchId) {
      headers['X-Branch-Id'] = authStore.activeBranchId
    }

    const response = await fetch(`${API_URL}/api/chat/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        conversationId: conversationId.value,
        message: msg,
        userType: props.userType,
        // Agents: companyId is derived server-side from auth — NOT sent from here
        // Tenants: send formToken so backend can resolve referenceId securely
        formToken: props.formToken,
        referenceId: props.userType === 'agent' ? undefined : props.referenceId,
        offerId: props.offerId,
        userIdentifier: props.userIdentifier || authStore.user?.email,
        userName: props.userName || authStore.company?.name,
      }),
    })

    const data = await response.json()

    if (!conversationId.value) {
      conversationId.value = data.conversationId
    }

    if (data.status) {
      conversationStatus.value = data.status
    }

    // Add bot reply
    if (data.reply) {
      messages.value.push({
        id: `bot-${Date.now()}`,
        role: 'assistant',
        content: data.reply,
      })
    }

    // Start polling if escalated
    if (data.escalated) {
      startWaitingTimer()
      startPolling()
    }
  } catch (err) {
    messages.value.push({
      id: `err-${Date.now()}`,
      role: 'assistant',
      content: 'Sorry, I had trouble processing that. Please try again.',
    })
  } finally {
    loading.value = false
    scrollToBottom()
    nextTick(() => inputRef.value?.focus())
  }
}

// Request human (via header button)
function requestHuman() {
  sendMessage('I\'d like to speak to a human please')
}

// Polling for new messages (human handover)
function startPolling() {
  if (pollInterval) return
  pollInterval = setInterval(async () => {
    if (!conversationId.value) return
    try {
      const lastMsg = messages.value[messages.value.length - 1]
      const since = lastMsg?.created_at || ''
      const response = await fetch(`${API_URL}/api/chat/${conversationId.value}/messages?since=${encodeURIComponent(since)}`)
      const data = await response.json()

      if (data.messages?.length) {
        for (const msg of data.messages) {
          // Avoid duplicates
          const exists = messages.value.some(m => m.id === msg.id)
          if (!exists) {
            messages.value.push(msg)
            if (msg.role === 'human' || msg.role === 'system') {
              hasUnread.value = !isOpen.value
            }
            // Human joined — update status
            if (msg.role === 'system' && msg.content.includes('team member has joined')) {
              conversationStatus.value = 'human_joined'
              stopWaitingTimer()
            }
          }
        }
        scrollToBottom()
      }
    } catch {
      // silent
    }
  }, 2000)
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

// Waiting timer (60s countdown for human)
function startWaitingTimer() {
  waitingSeconds.value = 0
  if (waitingInterval) clearInterval(waitingInterval)
  waitingInterval = setInterval(() => {
    waitingSeconds.value++
  }, 1000)
}

function stopWaitingTimer() {
  if (waitingInterval) {
    clearInterval(waitingInterval)
    waitingInterval = null
  }
}

function keepWaiting() {
  waitingSeconds.value = 0
}

// Leave message
async function submitLeaveMessage() {
  if (!leaveMessageText.value.trim() || !conversationId.value) return

  try {
    await fetch(`${API_URL}/api/chat/${conversationId.value}/leave-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: leaveMessageText.value }),
    })
    conversationStatus.value = 'message_left'
    showLeaveMessage.value = false
    stopPolling()
    stopWaitingTimer()
  } catch {
    // silent
  }
}

// Formatting
function formatMessage(content: string): string {
  let html = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  // Line breaks
  html = html.replace(/\n/g, '<br>')
  // Lists
  html = html.replace(/^- (.+)/gm, '<span class="block ml-2">• $1</span>')

  return html
}

function getBubbleClasses(role: string): string {
  switch (role) {
    case 'user':
      return 'bg-orange-500 text-white rounded-br-md'
    case 'human':
      return 'bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-white rounded-bl-md'
    case 'system':
      return 'bg-transparent w-full text-center'
    default:
      return 'bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-white rounded-bl-md'
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Clear unread when opened
watch(isOpen, (open) => {
  if (open) {
    hasUnread.value = false
    nextTick(() => inputRef.value?.focus())
  }
})

onUnmounted(() => {
  stopPolling()
  stopWaitingTimer()
})
</script>

<style>
.goosebot-content strong {
  font-weight: 600;
}
.goosebot-content em {
  font-style: italic;
}
</style>
