<template>
  <div class="space-y-6">
    <!-- TDS Branded Header -->
    <div class="rounded-lg border-2 border-[#3DDBB3] bg-gradient-to-br from-[#3DDBB3]/5 to-[#1E3A8A]/10 dark:from-[#3DDBB3]/10 dark:to-[#1E3A8A]/20 overflow-hidden">
      <div class="px-6 py-4 bg-white dark:bg-slate-800 border-b border-[#3DDBB3]/30 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-10 h-10 rounded-full bg-[#3DDBB3]">
            <div class="w-3 h-3 rounded-full bg-[#1E3A8A]"></div>
          </div>
          <div>
            <h3 class="text-lg font-bold text-[#1E3A8A] dark:text-white">TDS</h3>
            <p class="text-xs text-gray-500 dark:text-slate-400">Tenancy Deposit Scheme</p>
          </div>
        </div>
        <a
          href="https://www.tenancydepositscheme.com/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-[#1E3A8A] hover:text-[#3DDBB3] dark:text-slate-300 dark:hover:text-[#3DDBB3] transition-colors flex items-center gap-1"
        >
          Learn more
          <ExternalLink class="w-3 h-3" />
        </a>
      </div>
      <div class="p-4">
        <p class="text-sm text-gray-600 dark:text-slate-400">
          Connect your TDS account to register deposits directly from tenancy records.
        </p>
      </div>
    </div>

    <!-- Scheme Tabs -->
    <div class="border-b border-[#3DDBB3]/30 dark:border-[#3DDBB3]/20">
      <nav class="-mb-px flex space-x-8">
        <button
          @click="activeScheme = 'custodial'"
          :class="[
            activeScheme === 'custodial'
              ? 'border-[#3DDBB3] text-[#1E3A8A] dark:text-[#3DDBB3]'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-[#1E3A8A] dark:hover:text-[#3DDBB3] hover:border-[#3DDBB3]/50',
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2'
          ]"
        >
          <Shield class="w-4 h-4" />
          TDS Custodial
          <span
            v-if="custodialStatus?.configured"
            class="ml-1 flex h-2 w-2 rounded-full"
            :class="custodialStatus.lastTestStatus === 'success' ? 'bg-[#3DDBB3]' : 'bg-amber-500'"
          ></span>
        </button>
        <button
          @click="activeScheme = 'insured'"
          :class="[
            activeScheme === 'insured'
              ? 'border-[#3DDBB3] text-[#1E3A8A] dark:text-[#3DDBB3]'
              : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-[#1E3A8A] dark:hover:text-[#3DDBB3] hover:border-[#3DDBB3]/50',
            'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2'
          ]"
        >
          <ShieldCheck class="w-4 h-4" />
          TDS Insured
          <span
            v-if="insuredStatus?.configured && insuredStatus?.authorized"
            class="ml-1 flex h-2 w-2 rounded-full"
            :class="insuredStatus.lastTestStatus === 'success' ? 'bg-[#3DDBB3]' : 'bg-amber-500'"
          ></span>
        </button>
      </nav>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex items-center justify-center py-12">
      <Loader2 class="w-8 h-8 animate-spin text-[#3DDBB3]" />
    </div>

    <!-- TDS Custodial Panel -->
    <div v-else-if="activeScheme === 'custodial'" class="bg-white dark:bg-slate-800 rounded-lg border border-[#3DDBB3]/30 shadow p-6">
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-[#3DDBB3]/20">
            <Shield class="w-4 h-4 text-[#1E3A8A] dark:text-[#3DDBB3]" />
          </div>
          <div>
            <h4 class="text-md font-semibold text-[#1E3A8A] dark:text-white">TDS Custodial</h4>
            <p class="text-sm text-gray-500 dark:text-slate-400">
              The Custodial scheme holds the deposit in a secure TDS account.
            </p>
          </div>
        </div>
        <div v-if="custodialStatus?.configured" class="flex items-center gap-2">
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="custodialStatus.lastTestStatus === 'success'
              ? 'bg-[#3DDBB3]/20 text-[#1E3A8A] dark:bg-[#3DDBB3]/30 dark:text-[#3DDBB3]'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'"
          >
            {{ custodialStatus.lastTestStatus === 'success' ? 'Connected' : 'Needs Testing' }}
          </span>
        </div>
      </div>

      <!-- Saved Credentials Display (read-only, can't be autofilled) -->
      <div v-if="custodialStatus?.configured && !custodialEditMode" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Member ID</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
              <span class="text-gray-900 dark:text-white font-mono">{{ custodialStatus.memberId }}</span>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Branch ID</label>
            <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
              <span class="text-gray-900 dark:text-white font-mono">{{ custodialStatus.branchId || '0' }}</span>
            </div>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
          <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
            <span class="text-gray-900 dark:text-white font-mono">{{ custodialStatus.maskedApiKey || '••••••••••••••••••••' }}</span>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-slate-300">Environment</label>
          <div class="mt-1 px-3 py-2 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-md">
            <span class="text-gray-900 dark:text-white">{{ custodialStatus.environment === 'live' ? 'Live (Production)' : 'Sandbox (Testing)' }}</span>
          </div>
        </div>

        <div class="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <div class="flex gap-3">
            <button
              type="button"
              @click="custodialEditMode = true"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Edit Credentials
            </button>
            <button
              type="button"
              @click="testCustodialConnection"
              :disabled="custodialTesting"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              <span v-if="custodialTesting" class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Testing...
              </span>
              <span v-else>Test Connection</span>
            </button>
          </div>
          <button
            type="button"
            @click="removeCustodialIntegration"
            :disabled="custodialRemoving"
            class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            {{ custodialRemoving ? 'Removing...' : 'Remove Integration' }}
          </button>
        </div>

        <div v-if="custodialError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ custodialError }}
        </div>
        <div v-if="custodialSuccess" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
          {{ custodialSuccess }}
        </div>
      </div>

      <!-- Edit Form (shown when not configured or in edit mode) -->
      <form v-else @submit.prevent="saveCustodialCredentials" class="space-y-4" data-form-type="other">
        <!-- Hidden fields to trap browser autofill -->
        <input type="text" name="trap-username" style="display:none" tabindex="-1" autocomplete="username" />
        <input type="password" name="trap-password" style="display:none" tabindex="-1" autocomplete="current-password" />

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="custodial-member-id" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Member ID</label>
            <input
              id="custodial-member-id"
              v-model="custodialForm.memberId"
              name="tds-custodial-member"
              type="text"
              maxlength="10"
              required
              autocomplete="off"
              data-lpignore="true"
              data-1p-ignore
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              placeholder="e.g. EW12345"
            />
          </div>
          <div>
            <label for="custodial-branch-id" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Branch ID</label>
            <input
              id="custodial-branch-id"
              v-model="custodialForm.branchId"
              name="tds-custodial-branch"
              type="text"
              maxlength="10"
              autocomplete="off"
              data-lpignore="true"
              data-1p-ignore
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              placeholder="0"
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-slate-400">Enter 0 for single-branch members</p>
          </div>
        </div>

        <div>
          <label for="custodial-api-key" class="block text-sm font-medium text-gray-700 dark:text-slate-300">API Key</label>
          <div class="mt-1 relative">
            <input
              id="custodial-api-key"
              v-model="custodialForm.apiKey"
              name="tds-custodial-apikey"
              :type="showCustodialApiKey ? 'text' : 'password'"
              :required="!custodialStatus?.configured"
              autocomplete="off"
              data-lpignore="true"
              data-1p-ignore
              class="block w-full px-3 py-2 pr-20 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              :placeholder="custodialStatus?.configured ? '••••••••••••••••••••' : 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXX'"
            />
            <button
              type="button"
              @click="showCustodialApiKey = !showCustodialApiKey"
              class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
            >
              <Eye v-if="!showCustodialApiKey" class="w-4 h-4" />
              <EyeOff v-else class="w-4 h-4" />
            </button>
          </div>
          <p v-if="custodialStatus?.configured" class="mt-1 text-xs text-gray-500 dark:text-slate-400">
            Leave blank to keep existing API key
          </p>
        </div>

        <div>
          <input type="hidden" v-model="custodialForm.environment" />
          <div class="px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
            <span class="text-sm font-medium text-green-700 dark:text-green-400">Live (Production)</span>
          </div>
        </div>

        <div v-if="custodialError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ custodialError }}
        </div>

        <div v-if="custodialSuccess" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
          {{ custodialSuccess }}
        </div>

        <div class="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <div class="flex gap-3">
            <button
              type="submit"
              :disabled="custodialSaving"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ custodialSaving ? 'Saving...' : 'Save Credentials' }}
            </button>
            <button
              v-if="custodialEditMode"
              type="button"
              @click="cancelCustodialEdit"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md"
            >
              Cancel
            </button>
          </div>
          <button
            v-if="custodialStatus?.configured && !custodialEditMode"
            type="button"
            @click="removeCustodialIntegration"
            :disabled="custodialRemoving"
            class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            {{ custodialRemoving ? 'Removing...' : 'Remove Integration' }}
          </button>
        </div>
      </form>

      <!-- Last tested info -->
      <div v-if="custodialStatus?.lastTestedAt" class="mt-4 pt-4 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
        Last tested: {{ formatDateTime(custodialStatus.lastTestedAt) }}
        <span :class="custodialStatus.lastTestStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
          ({{ custodialStatus.lastTestStatus === 'success' ? 'Passed' : 'Failed' }})
        </span>
      </div>
    </div>

    <!-- TDS Insured Panel -->
    <div v-else-if="activeScheme === 'insured'" class="bg-white dark:bg-slate-800 rounded-lg border border-[#3DDBB3]/30 shadow p-6">
      <div class="flex items-start justify-between mb-6">
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full bg-[#3DDBB3]/20">
            <ShieldCheck class="w-4 h-4 text-[#1E3A8A] dark:text-[#3DDBB3]" />
          </div>
          <div>
            <h4 class="text-md font-semibold text-[#1E3A8A] dark:text-white">TDS Insured</h4>
            <p class="text-sm text-gray-500 dark:text-slate-400">
              The Insured scheme allows you to hold the deposit while TDS provides insurance protection.
            </p>
          </div>
        </div>
        <div v-if="insuredStatus?.configured && insuredStatus?.authorized" class="flex items-center gap-2">
          <span
            class="px-2 py-1 rounded-full text-xs font-medium"
            :class="insuredStatus.lastTestStatus === 'success'
              ? 'bg-[#3DDBB3]/20 text-[#1E3A8A] dark:bg-[#3DDBB3]/30 dark:text-[#3DDBB3]'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'"
          >
            {{ insuredStatus.lastTestStatus === 'success' ? 'Connected' : 'Needs Testing' }}
          </span>
        </div>
        <div v-else-if="insuredStatus?.configured && !insuredStatus?.authorized" class="flex items-center gap-2">
          <span class="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
            Needs Authorization
          </span>
        </div>
      </div>

      <form @submit.prevent="saveInsuredCredentials" class="space-y-4" data-form-type="other">
        <!-- Hidden fields to trap browser autofill -->
        <input type="text" name="trap-username-2" style="display:none" tabindex="-1" autocomplete="username" />
        <input type="password" name="trap-password-2" style="display:none" tabindex="-1" autocomplete="current-password" />

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="insured-member-id" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Member ID</label>
            <input
              id="insured-member-id"
              v-model="insuredForm.memberId"
              name="tds-insured-member"
              type="text"
              maxlength="10"
              required
              autocomplete="off"
              data-lpignore="true"
              data-1p-ignore
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              placeholder="e.g. 123456"
            />
          </div>
          <div>
            <label for="insured-branch-id" class="block text-sm font-medium text-gray-700 dark:text-slate-300">Branch ID</label>
            <input
              id="insured-branch-id"
              v-model="insuredForm.branchId"
              name="tds-insured-branch"
              type="text"
              maxlength="10"
              autocomplete="off"
              data-lpignore="true"
              data-1p-ignore
              class="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white"
              placeholder="Optional"
            />
          </div>
        </div>

        <div class="px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md">
          <span class="text-sm font-medium text-green-700 dark:text-green-400">Live (Production)</span>
        </div>

        <div v-if="insuredError" class="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded text-sm">
          {{ insuredError }}
        </div>

        <div v-if="insuredSuccess" class="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 px-4 py-3 rounded text-sm">
          {{ insuredSuccess }}
        </div>

        <div class="flex items-center justify-between pt-4 border-t dark:border-slate-700">
          <div class="flex gap-3">
            <button
              type="submit"
              :disabled="insuredSaving"
              class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50"
            >
              {{ insuredSaving ? 'Saving...' : 'Save Configuration' }}
            </button>

            <!-- Authorize Button -->
            <button
              v-if="insuredStatus?.configured && !insuredStatus?.authorized"
              type="button"
              @click="authorizeInsured"
              :disabled="insuredAuthorizing"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center gap-2"
            >
              <ExternalLink class="w-4 h-4" />
              {{ insuredAuthorizing ? 'Redirecting...' : 'Authorize with TDS' }}
            </button>

            <!-- Test Button -->
            <button
              v-if="insuredStatus?.configured && insuredStatus?.authorized"
              type="button"
              @click="testInsuredConnection"
              :disabled="insuredTesting"
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-md disabled:opacity-50"
            >
              <span v-if="insuredTesting" class="flex items-center gap-2">
                <Loader2 class="w-4 h-4 animate-spin" />
                Testing...
              </span>
              <span v-else>Test Connection</span>
            </button>
          </div>
          <button
            v-if="insuredStatus?.configured"
            type="button"
            @click="removeInsuredIntegration"
            :disabled="insuredRemoving"
            class="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
          >
            {{ insuredRemoving ? 'Removing...' : 'Remove Integration' }}
          </button>
        </div>
      </form>

      <!-- Authorization status info -->
      <div v-if="insuredStatus?.configured && !insuredStatus?.authorized" class="mt-4 pt-4 border-t dark:border-slate-700">
        <div class="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
          <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h5 class="text-sm font-medium text-yellow-800 dark:text-yellow-400">Authorization Required</h5>
            <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
              Click "Authorize with TDS" to complete the OAuth connection. You'll be redirected to TDS to grant access.
            </p>
          </div>
        </div>
      </div>

      <!-- Last tested info -->
      <div v-if="insuredStatus?.lastTestedAt" class="mt-4 pt-4 border-t dark:border-slate-700 text-xs text-gray-500 dark:text-slate-400">
        Last tested: {{ formatDateTime(insuredStatus.lastTestedAt) }}
        <span :class="insuredStatus.lastTestStatus === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'">
          ({{ insuredStatus.lastTestStatus === 'success' ? 'Passed' : 'Failed' }})
        </span>
      </div>
    </div>

    <!-- Connected Schemes Summary -->
    <div v-if="!loading && (custodialStatus?.configured || (insuredStatus?.configured && insuredStatus?.authorized))" class="bg-[#3DDBB3]/10 dark:bg-[#3DDBB3]/5 rounded-lg border border-[#3DDBB3]/30 p-4">
      <h4 class="text-sm font-medium text-[#1E3A8A] dark:text-[#3DDBB3] mb-3">Connected Schemes</h4>
      <div class="flex gap-4">
        <div
          v-if="custodialStatus?.configured"
          class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-[#3DDBB3]/30 rounded-md shadow-sm"
        >
          <Shield class="w-4 h-4 text-[#1E3A8A] dark:text-[#3DDBB3]" />
          <span class="text-sm font-medium text-[#1E3A8A] dark:text-white">TDS Custodial</span>
          <span
            class="w-2 h-2 rounded-full"
            :class="custodialStatus.lastTestStatus === 'success' ? 'bg-[#3DDBB3]' : 'bg-amber-500'"
          ></span>
        </div>
        <div
          v-if="insuredStatus?.configured && insuredStatus?.authorized"
          class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-[#3DDBB3]/30 rounded-md shadow-sm"
        >
          <ShieldCheck class="w-4 h-4 text-[#1E3A8A] dark:text-[#3DDBB3]" />
          <span class="text-sm font-medium text-[#1E3A8A] dark:text-white">TDS Insured</span>
          <span
            class="w-2 h-2 rounded-full"
            :class="insuredStatus.lastTestStatus === 'success' ? 'bg-[#3DDBB3]' : 'bg-amber-500'"
          ></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import {
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  AlertTriangle
} from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const authStore = useAuthStore()
const route = useRoute()
// Active scheme tab
const activeScheme = ref<'custodial' | 'insured'>('custodial')

// Loading state
const loading = ref(true)

// Custodial state
interface CustodialStatus {
  configured: boolean
  memberId: string | null
  branchId: string | null
  environment: string
  maskedApiKey: string | null
  connectedAt: string | null
  lastTestedAt: string | null
  lastTestStatus: string | null
}

const custodialStatus = ref<CustodialStatus | null>(null)
const custodialForm = ref({
  memberId: '',
  branchId: '0',
  apiKey: '',
  environment: 'sandbox'
})
const showCustodialApiKey = ref(false)
const custodialSaving = ref(false)
const custodialTesting = ref(false)
const custodialRemoving = ref(false)
const custodialEditMode = ref(false)
const custodialError = ref('')
const custodialSuccess = ref('')

// Insured state
interface InsuredStatus {
  configured: boolean
  authorized: boolean
  clientId: string | null
  memberId: string | null
  branchId: string | null
  environment: string
  connectedAt: string | null
  lastTestedAt: string | null
  lastTestStatus: string | null
}

const insuredStatus = ref<InsuredStatus | null>(null)
const insuredForm = ref({
  memberId: '',
  branchId: '',
  clientId: '',
  clientSecret: '',
  environment: 'sandbox'
})
const showInsuredSecret = ref(false)
const insuredSaving = ref(false)
const insuredTesting = ref(false)
const insuredRemoving = ref(false)
const insuredAuthorizing = ref(false)
const insuredError = ref('')
const insuredSuccess = ref('')

// Format datetime
const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

// Fetch TDS settings
const fetchTDSSettings = async () => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // Add branch header for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    console.log('[TDS Settings] Fetching - activeBranchId from localStorage:', activeBranchId)
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/tds`, {
      headers
    })

    if (response.ok) {
      const data = await response.json()
      console.log('[TDS Settings] Fetch response:', data)

      // Set custodial status
      custodialStatus.value = data.custodial
      console.log('[TDS Settings] custodialStatus set to:', custodialStatus.value)
      if (data.custodial?.configured) {
        custodialForm.value.memberId = data.custodial.memberId || ''
        custodialForm.value.branchId = data.custodial.branchId || '0'
        custodialForm.value.environment = 'live'
        console.log('[TDS Settings] Form values set:', custodialForm.value)
      }

      // Set insured status
      insuredStatus.value = data.insured
      if (data.insured?.configured) {
        insuredForm.value.memberId = data.insured.memberId || ''
        insuredForm.value.branchId = data.insured.branchId || ''
        insuredForm.value.clientId = data.insured.clientId || ''
        insuredForm.value.environment = 'live'
      }
    }
  } catch (error) {
    console.error('Failed to fetch TDS settings:', error)
  } finally {
    loading.value = false
  }
}

// Handle OAuth callback
const handleOAuthCallback = async () => {
  const code = route.query.code as string
  const state = route.query.state as string

  if (code && state) {
    insuredAuthorizing.value = true
    insuredError.value = ''

    try {
      const token = authStore.session?.access_token
      if (!token) throw new Error('Not authenticated')

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }

      // Add branch header for multi-branch support
      const activeBranchId = localStorage.getItem('activeBranchId')
      if (activeBranchId) {
        headers['X-Branch-Id'] = activeBranchId
      }

      const response = await fetch(`${API_URL}/api/settings/tds/insured/callback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code,
          state,
          redirect_uri: `${window.location.origin}/settings/tds`
        })
      })

      if (response.ok) {
        insuredSuccess.value = 'TDS Insured authorized successfully!'
        activeScheme.value = 'insured'
        await fetchTDSSettings()

        // Clear URL params
        window.history.replaceState({}, document.title, '/settings/tds')
      } else {
        const data = await response.json()
        insuredError.value = data.error || 'Authorization failed'
      }
    } catch (error: any) {
      insuredError.value = error.message || 'Authorization failed'
    } finally {
      insuredAuthorizing.value = false
    }
  }
}

// Custodial methods
const saveCustodialCredentials = async () => {
  custodialSaving.value = true
  custodialError.value = ''
  custodialSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const payload: any = {
      memberId: custodialForm.value.memberId,
      branchId: custodialForm.value.branchId || '0',
      environment: custodialForm.value.environment
    }

    // Only include API key if provided
    if (custodialForm.value.apiKey) {
      payload.apiKey = custodialForm.value.apiKey
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // Add branch header for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    console.log('[TDS Settings] Saving custodial credentials:', payload)

    const response = await fetch(`${API_URL}/api/settings/tds/custodial`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    const responseData = await response.json()
    console.log('[TDS Settings] Save response:', response.ok, responseData)

    if (response.ok) {
      custodialSuccess.value = 'Credentials saved successfully'
      custodialForm.value.apiKey = ''
      custodialEditMode.value = false
      await fetchTDSSettings()
    } else {
      custodialError.value = responseData.error || 'Failed to save credentials'
    }
  } catch (error: any) {
    custodialError.value = error.message || 'Failed to save credentials'
  } finally {
    custodialSaving.value = false
  }
}

const cancelCustodialEdit = () => {
  custodialEditMode.value = false
  custodialError.value = ''
  custodialSuccess.value = ''
  // Reset form to saved values
  if (custodialStatus.value) {
    custodialForm.value.memberId = custodialStatus.value.memberId || ''
    custodialForm.value.branchId = custodialStatus.value.branchId || '0'
    custodialForm.value.environment = custodialStatus.value.environment || 'sandbox'
  }
  custodialForm.value.apiKey = ''
}

const testCustodialConnection = async () => {
  custodialTesting.value = true
  custodialError.value = ''
  custodialSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // Add branch header for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/tds/custodial/test`, {
      method: 'POST',
      headers
    })

    const data = await response.json()

    if (response.ok && data.success) {
      custodialSuccess.value = data.message || 'Connection successful!'
      await fetchTDSSettings()
    } else {
      custodialError.value = data.error || 'Connection test failed'
    }
  } catch (error: any) {
    custodialError.value = error.message || 'Connection test failed'
  } finally {
    custodialTesting.value = false
  }
}

const removeCustodialIntegration = async () => {
  if (!confirm('Are you sure you want to remove the TDS Custodial integration?')) return

  custodialRemoving.value = true
  custodialError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }

    // Add branch header for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/tds/custodial`, {
      method: 'DELETE',
      headers
    })

    if (response.ok) {
      custodialStatus.value = null
      custodialForm.value = {
        memberId: '',
        branchId: '0',
        apiKey: '',
        environment: 'sandbox'
      }
      custodialSuccess.value = 'Integration removed successfully'
    } else {
      const data = await response.json()
      custodialError.value = data.error || 'Failed to remove integration'
    }
  } catch (error: any) {
    custodialError.value = error.message || 'Failed to remove integration'
  } finally {
    custodialRemoving.value = false
  }
}

// Insured methods
const saveInsuredCredentials = async () => {
  insuredSaving.value = true
  insuredError.value = ''
  insuredSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const payload: any = {
      memberId: insuredForm.value.memberId,
      branchId: insuredForm.value.branchId,
      environment: insuredForm.value.environment
    }

    // Only include credentials if provided
    if (insuredForm.value.clientId) {
      payload.clientId = insuredForm.value.clientId
    }
    if (insuredForm.value.clientSecret) {
      payload.clientSecret = insuredForm.value.clientSecret
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // Add branch header for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/tds/insured`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    if (response.ok) {
      insuredSuccess.value = 'Configuration saved. Click "Authorize with TDS" to complete setup.'
      insuredForm.value.clientSecret = ''
      await fetchTDSSettings()
    } else {
      const data = await response.json()
      insuredError.value = data.error || 'Failed to save configuration'
    }
  } catch (error: any) {
    insuredError.value = error.message || 'Failed to save configuration'
  } finally {
    insuredSaving.value = false
  }
}

const authorizeInsured = async () => {
  insuredAuthorizing.value = true
  insuredError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    // Use ngrok URL for local testing, production URL otherwise
    const redirectUri = import.meta.env.VITE_TDS_REDIRECT_URI
      || (import.meta.env.PROD
        ? `${window.location.origin}/settings/tds`
        : 'https://propertygoosedev.ngrok.app/settings/tds')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }

    // Add branch header for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/tds/insured/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`, {
      headers
    })

    if (response.ok) {
      const data = await response.json()
      // Redirect to TDS authorization URL
      window.location.href = data.authUrl
    } else {
      const data = await response.json()
      insuredError.value = data.error || 'Failed to get authorization URL'
      insuredAuthorizing.value = false
    }
  } catch (error: any) {
    insuredError.value = error.message || 'Failed to initiate authorization'
    insuredAuthorizing.value = false
  }
}

const testInsuredConnection = async () => {
  insuredTesting.value = true
  insuredError.value = ''
  insuredSuccess.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }

    // Add branch header for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/tds/insured/test`, {
      method: 'POST',
      headers
    })

    const data = await response.json()

    if (response.ok && data.success) {
      insuredSuccess.value = data.message || 'Connection successful!'
      await fetchTDSSettings()
    } else {
      insuredError.value = data.error || 'Connection test failed'
    }
  } catch (error: any) {
    insuredError.value = error.message || 'Connection test failed'
  } finally {
    insuredTesting.value = false
  }
}

const removeInsuredIntegration = async () => {
  if (!confirm('Are you sure you want to remove the TDS Insured integration?')) return

  insuredRemoving.value = true
  insuredError.value = ''

  try {
    const token = authStore.session?.access_token
    if (!token) throw new Error('Not authenticated')

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    }

    // Add branch header for multi-branch support
    const activeBranchId = localStorage.getItem('activeBranchId')
    if (activeBranchId) {
      headers['X-Branch-Id'] = activeBranchId
    }

    const response = await fetch(`${API_URL}/api/settings/tds/insured`, {
      method: 'DELETE',
      headers
    })

    if (response.ok) {
      insuredStatus.value = null
      insuredForm.value = {
        memberId: '',
        branchId: '',
        clientId: '',
        clientSecret: '',
        environment: 'sandbox'
      }
      insuredSuccess.value = 'Integration removed successfully'
    } else {
      const data = await response.json()
      insuredError.value = data.error || 'Failed to remove integration'
    }
  } catch (error: any) {
    insuredError.value = error.message || 'Failed to remove integration'
  } finally {
    insuredRemoving.value = false
  }
}

onMounted(async () => {
  await fetchTDSSettings()
  // Check for OAuth callback
  handleOAuthCallback()
})
</script>
