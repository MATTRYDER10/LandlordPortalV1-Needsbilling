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
          <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <!-- Header -->
            <div class="relative px-6 py-5 bg-gradient-to-r from-primary to-orange-500 flex-shrink-0">
              <div class="flex items-center gap-3">
                <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-8 w-8" />
                <div>
                  <div class="flex items-center gap-2">
                    <h2 class="text-xl font-bold text-white">PropertyGoose V3 is here</h2>
                    <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-white/20 text-white">New</span>
                  </div>
                  <p class="text-sm text-white/80 mt-0.5">Here's everything that's changed — read before you dive in.</p>
                </div>
              </div>
              <button
                @click="dismiss"
                class="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
              >
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Scrollable content -->
            <div class="overflow-y-auto flex-1 px-6 py-5 space-y-4">

              <!-- Section 1: APTA -->
              <div class="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
                <div class="flex items-start gap-3">
                  <span class="text-xl flex-shrink-0 mt-0.5">📄</span>
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900 dark:text-white text-sm">Renters Rights Act — Periodic Tenancy Agreements</p>
                    <ul class="mt-2 space-y-1.5 text-sm text-gray-700 dark:text-slate-300 leading-snug">
                      <li class="flex gap-2"><span class="text-amber-500 flex-shrink-0">›</span><span>Move-in dates from 1 May 2026 onwards will automatically use the new monthly rolling Periodic Assured Tenancy Agreement — no fixed term, no break clauses.</span></li>
                      <li class="flex gap-2"><span class="text-amber-500 flex-shrink-0">›</span><span>Special clauses can still be added via the Properties tab. Break clauses are no longer permitted.</span></li>
                      <li class="flex gap-2"><span class="text-amber-500 flex-shrink-0">›</span><span>Tenancies starting before May 2026 will be covered by the compliance pack information sheet sent via the Tenancies tab.</span></li>
                      <li class="flex gap-2"><span class="text-amber-500 flex-shrink-0">›</span><span>Student tenancies already signed must have the compliance pack served before 30 May 2026 in line with the Renters Rights Act.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Section 2: Offers V2 -->
              <div class="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
                <div class="flex items-start gap-3">
                  <span class="text-xl flex-shrink-0 mt-0.5">🏷️</span>
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900 dark:text-white text-sm">Offers V2 — RRA 2025 Compliant</p>
                    <ul class="mt-2 space-y-1.5 text-sm text-gray-700 dark:text-slate-300 leading-snug">
                      <li class="flex gap-2"><span class="text-blue-500 flex-shrink-0">›</span><span>Max advertised rent is now enforced — tenants cannot offer more than the listed rent.</span></li>
                      <li class="flex gap-2"><span class="text-blue-500 flex-shrink-0">›</span><span>Offer wording updated for discrimination law compliance. "DSS, No kids, No Pets" type restrictions are prohibited in listings and contractor instructions.</span></li>
                      <li class="flex gap-2"><span class="text-blue-500 flex-shrink-0">›</span><span>Multi-select offers — send to your landlord for email approval, or decline multiple applicants in one click to keep tenants informed quickly.</span></li>
                      <li class="flex gap-2"><span class="text-blue-500 flex-shrink-0">›</span><span>Offer Reposit and Unithomes with a single click from Offers V2 — more sales, more income, less admin.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Section 3: References V2 -->
              <div class="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 p-4">
                <div class="flex items-start gap-3">
                  <span class="text-xl flex-shrink-0 mt-0.5">📋</span>
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900 dark:text-white text-sm">References V2 — Separate Work Queue</p>
                    <ul class="mt-2 space-y-1.5 text-sm text-gray-700 dark:text-slate-300 leading-snug">
                      <li class="flex gap-2"><span class="text-purple-500 flex-shrink-0">›</span><span>References V2 is a completely separate work queue from V1. Any references already sent or in progress will continue to complete under Legacy References in the left sidebar.</span></li>
                      <li class="flex gap-2"><span class="text-purple-500 flex-shrink-0">›</span><span>All new offers from today should use Offers V2, which automatically uses the new V2 reference platform.</span></li>
                      <li class="flex gap-2"><span class="text-purple-500 flex-shrink-0">›</span><span>Faster responses, detailed evidence view for agents, a brand-new reference report, and group referencing for HMOs.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Section 4: JMI -->
              <div class="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
                <div class="flex items-start gap-3">
                  <span class="text-xl flex-shrink-0 mt-0.5">⚡</span>
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900 dark:text-white text-sm">Just Move In — Automated Utility Notification</p>
                    <ul class="mt-2 space-y-1.5 text-sm text-gray-700 dark:text-slate-300 leading-snug">
                      <li class="flex gap-2"><span class="text-green-500 flex-shrink-0">›</span><span>JMI is our chosen partner for utility and council tax switching — automated notifications on move in, move out, and tenant changes.</span></li>
                      <li class="flex gap-2"><span class="text-green-500 flex-shrink-0">›</span><span>Managed directly within the Tenancies tab. Nothing extra to set up.</span></li>
                      <li class="flex gap-2"><span class="text-green-500 flex-shrink-0">›</span><span>Properties marked as Bills Included are automatically excluded from utility switching — no action needed.</span></li>
                      <li class="flex gap-2"><span class="text-green-500 flex-shrink-0">›</span><span>To opt out, go to Settings, then Company, then Management Info.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Section 5: Apex27 -->
              <div class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 p-4">
                <div class="flex items-start gap-3">
                  <span class="text-xl flex-shrink-0 mt-0.5">🔗</span>
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900 dark:text-white text-sm">Apex27 CRM — Full Document Push & Live Sync</p>
                    <ul class="mt-2 space-y-1.5 text-sm text-gray-700 dark:text-slate-300 leading-snug">
                      <li class="flex gap-2"><span class="text-gray-400 flex-shrink-0">›</span><span>Full document push, let agreed automations, landlords, tenants, and properties — all active and live synced with your Apex27 account.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Section 6: Reposit -->
              <div class="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4">
                <div class="flex items-start gap-3">
                  <span class="text-xl flex-shrink-0 mt-0.5">🏦</span>
                  <div class="min-w-0">
                    <p class="font-semibold text-gray-900 dark:text-white text-sm">Reposit — One-Click Deposit Replacement</p>
                    <ul class="mt-2 space-y-1.5 text-sm text-gray-700 dark:text-slate-300 leading-snug">
                      <li class="flex gap-2"><span class="text-orange-400 flex-shrink-0">›</span><span>Link your Reposit account in Settings under Deposits to unlock one-click deposit replacement sales from the Tenancies tab.</span></li>
                      <li class="flex gap-2"><span class="text-orange-400 flex-shrink-0">›</span><span>Offer Reposit and Unithomes with a single click from Offers V2 — more sales, more income from the platform.</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              <!-- Bug reporting note -->
              <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm text-gray-600 dark:text-slate-400">
                <span class="text-lg flex-shrink-0">🐛</span>
                <span>If you encounter any issues, use the <strong class="text-gray-900 dark:text-white">bug reporting button</strong> (bottom right of the screen). Most reports are resolved within hours — maximum 72 hours.</span>
              </div>

            </div>

            <!-- Footer -->
            <div class="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-4 flex-shrink-0">
              <label class="flex items-center gap-2 cursor-pointer select-none">
                <input
                  v-model="doNotShowAgain"
                  type="checkbox"
                  class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span class="text-xs text-gray-500 dark:text-slate-400">Don't show this again</span>
              </label>
              <button
                @click="dismiss"
                class="px-5 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-primary to-orange-500 text-white shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-200"
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

const SEEN_KEY = 'pg_whats_new_seen_v3'

const show = ref(false)
const doNotShowAgain = ref(false)

onMounted(() => {
  if (!localStorage.getItem(SEEN_KEY)) {
    setTimeout(() => { show.value = true }, 800)
  }
})

const dismiss = () => {
  show.value = false
  if (doNotShowAgain.value) {
    localStorage.setItem(SEEN_KEY, '1')
  }
}
</script>
