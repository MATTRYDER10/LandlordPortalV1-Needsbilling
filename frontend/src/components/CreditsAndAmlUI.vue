<template>
    <div class="space-y-6">

        <!-- Verification Result (Unified Card Including Compliance) -->
        <section class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">

            <!-- Header -->
            <header class="mb-6 border-b border-gray-100 pb-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-1">Verification Result</h2>
            </header>

            <!-- Top Summary (Status + Identity Match + Risk Level + Score) -->
            <div class="flex flex-wrap justify-between gap-6">

                <!-- Left Side Labels -->
                <div class="flex flex-col gap-4 min-w-[240px]">
                    <div class="flex items-center gap-3">
                        <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</span>
                        <span :class="badgeClass(verificationData.statusLabel)">
                            {{ verificationData.statusLabel }}
                        </span>
                    </div>

                    <div class="flex items-center gap-3">
                        <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Identity Match</span>
                        <span :class="badgeClass(verificationData.identityMatchLabel)">
                            {{ verificationData.identityMatchLabel }}
                        </span>
                    </div>

                    <div class="flex items-center gap-3">
                        <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Risk Level</span>
                        <span :class="badgeClass(verificationData.riskLevelLabel)">
                            {{ verificationData.riskLevelLabel }}
                        </span>
                    </div>
                </div>

                <!-- Risk Score -->
                <div class="flex flex-col justify-center text-right min-w-[180px]">
                    <span class="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Risk Score
                    </span>
                    <span class="text-5xl font-bold text-emerald-500 leading-none">
                        {{ verificationData.riskScore }}/{{ verificationData.riskScoreMax ?? 100 }}
                    </span>
                </div>
            </div>

            <!-- Verification Flags -->
            <div class="mt-8">
                <h3 class="text-base font-semibold text-gray-800">Verification Flags</h3>

                <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div v-for="flag in verificationFlags" :key="flag.id ?? flag.label"
                        class="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                        <span
                            class="flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-500 shadow">
                            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                        </span>
                        <span class="text-sm font-semibold text-gray-800">{{ flag.label }}</span>
                    </div>
                </div>
            </div>

            <!-- Compliance Screening (NOW MERGED INTO THIS CARD) -->
            <div class="mt-10">
                <h3 class="text-base font-semibold text-gray-800">Compliance Screening</h3>
                <div class="mt-4 divide-y divide-gray-100">
                    <div v-for="check in complianceList" :key="check.id ?? check.label"
                        class="flex items-center justify-between py-4">
                        <div>
                            <p class="text-sm font-semibold text-gray-800">{{ check.label }}</p>
                            <p v-if="check.description" class="text-xs text-gray-500">{{ check.description }}</p>
                        </div>

                        <div class="flex items-center gap-2">
                            <span :class="statusClass(check.status)">
                                {{ formatStatus(check.status) }}
                            </span>

                            <span :class="statusIconWrapper(check.status)">
                                <svg v-if="isPositive(check.status)" class="h-4 w-4 text-emerald-600"
                                    viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                        clip-rule="evenodd" />
                                </svg>

                                <svg v-else class="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm-.75-11.5a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 7a1 1 0 110-2 1 1 0 010 2z"
                                        clip-rule="evenodd" />
                                </svg>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

        </section>

    </div>
</template>


<script setup lang="ts">
import { computed } from 'vue'

type Tone = 'success' | 'warning' | 'danger' | 'info'

interface VerificationFlag {
    id?: string | number
    label: string
}

interface VerificationData {
    statusLabel: string
    identityMatchLabel: string
    riskLevelLabel: string
    riskScore: number
    riskScoreMax?: number
    flags?: VerificationFlag[]
}

interface ComplianceCheck {
    id?: string | number
    label: string
    status: string
    description?: string
}

interface Props {
    verification?: VerificationData
    complianceChecks?: ComplianceCheck[]
}

const defaultVerification: VerificationData = {
    statusLabel: 'Passed',
    identityMatchLabel: 'Match Found',
    riskLevelLabel: 'Low',
    riskScore: 100,
    riskScoreMax: 100,
    flags: [
        { label: 'Electoral Roll' },
        { label: 'No CCJs' },
        { label: 'No Insolvency' },
        { label: 'Not Deceased' }
    ]
}

const defaultCompliance: ComplianceCheck[] = [
    { label: 'Politically Exposed Person (PEP)', status: 'clear' },
    { label: 'Sanctions Screening', status: 'clear' },
    { label: 'Adverse Media', status: 'clear' }
]

const props = defineProps<Props>()

const verificationData = computed(() => props.verification ?? defaultVerification)
const verificationFlags = computed(() => verificationData.value.flags ?? [])
const complianceList = computed(
    () => (props.complianceChecks && props.complianceChecks.length > 0 ? props.complianceChecks : defaultCompliance)
)

const toneClasses: Record<Tone, string> = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
    info: 'border-slate-200 bg-slate-50 text-slate-700'
}

const subtleToneClasses: Record<Tone, string> = {
    success: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-rose-600',
    info: 'text-slate-600'
}

const detectTone = (value?: string): Tone => {
    const normalized = (value ?? '').toLowerCase()
    if (['pass', 'match', 'low', 'clear', 'success', 'no'].some((word) => normalized.includes(word))) {
        return 'success'
    }
    if (['fail', 'high', 'risk', 'alert', 'adverse'].some((word) => normalized.includes(word))) {
        return 'danger'
    }
    if (['pending', 'medium', 'review'].some((word) => normalized.includes(word))) {
        return 'warning'
    }
    return 'info'
}

const badgeClass = (value?: string) =>
    `inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${toneClasses[detectTone(value)]}`

const statusClass = (value?: string) =>
    `text-sm font-semibold ${subtleToneClasses[detectTone(value)]}`

const statusIconWrapper = (value?: string) =>
    `flex h-8 w-8 items-center justify-center rounded-full border ${toneClasses[detectTone(value)]}`

const isPositive = (value?: string) => detectTone(value) === 'success'

const formatStatus = (value?: string) => {
    if (!value) return 'Unknown'
    return value.charAt(0).toUpperCase() + value.slice(1)
}
</script>
