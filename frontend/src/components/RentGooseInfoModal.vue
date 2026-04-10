<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60" @click="$emit('close')"></div>
      <div :class="['relative w-full max-w-lg rounded-2xl shadow-2xl', isDark ? 'bg-slate-900' : 'bg-white']">
        <!-- Header -->
        <div :class="['px-6 py-5 border-b', isDark ? 'border-slate-700' : 'border-gray-200']">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                RG
              </div>
              <div>
                <h2 :class="['text-xl font-bold', isDark ? 'text-white' : 'text-gray-900']">RentGoose</h2>
                <p :class="['text-xs', isDark ? 'text-slate-400' : 'text-gray-500']">Rent &amp; invoice management</p>
              </div>
            </div>
            <button @click="$emit('close')" :class="['p-1 rounded-lg', isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-gray-100 text-gray-500']">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <!-- Body -->
        <div class="px-6 py-5 space-y-4">
          <div :class="['rounded-xl p-4 border', isDark ? 'bg-orange-950/30 border-orange-800/50' : 'bg-orange-50 border-orange-200']">
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-bold text-primary">£28</span>
              <span :class="['text-sm', isDark ? 'text-slate-300' : 'text-gray-600']">per month + VAT</span>
            </div>
            <p :class="['text-xs mt-1', isDark ? 'text-slate-400' : 'text-gray-500']">Per company subscription</p>
          </div>

          <p :class="['text-sm leading-relaxed', isDark ? 'text-slate-200' : 'text-gray-700']">
            RentGoose is a rent and invoice management system designed to work with agents
            who run their own client accounts. RentGoose sends rent reminders, remittances
            to contractors, and statements to landlords, as well as keeping track of all
            agency fees.
          </p>

          <ul class="space-y-2 text-sm">
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span :class="isDark ? 'text-slate-200' : 'text-gray-700'">Automated rent reminders &amp; arrears chasing</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span :class="isDark ? 'text-slate-200' : 'text-gray-700'">Landlord statements &amp; payouts</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span :class="isDark ? 'text-slate-200' : 'text-gray-700'">Contractor invoices &amp; remittances</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span :class="isDark ? 'text-slate-200' : 'text-gray-700'">Agency fee tracking &amp; client account ledger</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span :class="isDark ? 'text-slate-200' : 'text-gray-700'">Held rents &amp; rent credit handling</span>
            </li>
          </ul>

          <div v-if="submitted" :class="['rounded-xl p-4 border text-center', isDark ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700']">
            <p class="font-medium text-sm">Thanks — we'll be in touch shortly!</p>
            <p class="text-xs mt-1 opacity-75">Our team will reach out to arrange a call.</p>
          </div>
          <div v-else-if="error" :class="['rounded-xl p-3 border text-center text-sm', isDark ? 'bg-red-950/30 border-red-800/50 text-red-300' : 'bg-red-50 border-red-200 text-red-700']">
            {{ error }}
          </div>
        </div>

        <!-- Footer -->
        <div :class="['px-6 py-4 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-gray-200']">
          <button
            @click="$emit('close')"
            :class="['px-4 py-2 text-sm font-medium rounded-lg', isDark ? 'bg-slate-800 hover:bg-slate-700 text-slate-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-700']"
          >
            Close
          </button>
          <button
            v-if="!submitted"
            @click="submitInterest"
            :disabled="submitting"
            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-orange-600 rounded-lg disabled:opacity-50 transition-colors"
          >
            {{ submitting ? 'Sending...' : "I'm Interested" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDarkMode } from '../composables/useDarkMode'
import { useApi } from '../composables/useApi'

defineEmits<{ close: [] }>()

const { isDark } = useDarkMode()
const { post } = useApi()

const submitting = ref(false)
const submitted = ref(false)
const error = ref('')

async function submitInterest() {
  if (submitting.value) return
  submitting.value = true
  error.value = ''
  try {
    await post('/api/company/rentgoose-interest', {})
    submitted.value = true
  } catch (err: any) {
    error.value = err?.message || 'Failed to send interest. Please contact info@propertygoose.co.uk directly.'
  } finally {
    submitting.value = false
  }
}
</script>
