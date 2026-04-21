<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="show" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <Transition
          enter-active-class="transition ease-out duration-300"
          enter-from-class="opacity-0 scale-95 translate-y-4"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition ease-in duration-200"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 translate-y-4"
          appear
        >
          <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <!-- Header -->
            <div class="relative px-6 pt-8 pb-6 bg-gradient-to-br from-orange-500 to-amber-500 text-center">
              <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span class="text-4xl">🪿</span>
              </div>
              <h2 class="text-2xl font-bold text-white">GooseBot is live!</h2>
              <p class="text-white/80 text-sm mt-1">Your new AI assistant</p>
              <button
                @click="dismiss"
                class="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Content -->
            <div class="px-6 py-5 space-y-3">
              <p class="text-gray-700 dark:text-slate-300 text-sm leading-relaxed">
                GooseBot is here to make your day-to-day easier. It can:
              </p>

              <div class="space-y-2.5">
                <div class="flex items-start gap-2.5">
                  <span class="text-orange-500 mt-0.5 font-bold text-sm">1.</span>
                  <p class="text-sm text-gray-700 dark:text-slate-300"><strong class="text-gray-900 dark:text-white">Look up anything</strong> — references, offers, tenancies, landlords, properties, and agreements</p>
                </div>
                <div class="flex items-start gap-2.5">
                  <span class="text-orange-500 mt-0.5 font-bold text-sm">2.</span>
                  <p class="text-sm text-gray-700 dark:text-slate-300"><strong class="text-gray-900 dark:text-white">Guide you through the app</strong> — ask it how to do anything and it'll walk you through step by step</p>
                </div>
                <div class="flex items-start gap-2.5">
                  <span class="text-orange-500 mt-0.5 font-bold text-sm">3.</span>
                  <p class="text-sm text-gray-700 dark:text-slate-300"><strong class="text-gray-900 dark:text-white">Connect you to our team</strong> — if it can't help, it'll get a real person on the line</p>
                </div>
              </div>

              <p class="text-gray-500 dark:text-slate-400 text-xs pt-1">
                Click the goose icon in the bottom-right corner any time. Ask it anything!
              </p>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-100 dark:border-slate-700">
              <button
                @click="dismiss"
                class="w-full px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md shadow-orange-500/30 hover:shadow-lg hover:shadow-orange-500/40 hover:-translate-y-0.5 transition-all duration-200"
              >
                Got it, let's go!
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { X } from 'lucide-vue-next'

const SEEN_KEY = 'pg_goosebot_announcement_seen'

const show = ref(false)

onMounted(() => {
  if (!localStorage.getItem(SEEN_KEY)) {
    setTimeout(() => { show.value = true }, 800)
  }
})

const dismiss = () => {
  show.value = false
  localStorage.setItem(SEEN_KEY, '1')
}
</script>
