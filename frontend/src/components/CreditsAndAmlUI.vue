<template>
    <div class="space-y-6">

        <!-- Verification Result (Unified Card Including Compliance) -->
        <section class="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">

            <!-- Header -->
            <header class="mb-6 border-b border-gray-100 pb-6">
                <h2 class="text-lg font-semibold text-gray-900 mb-1">Verification Result</h2>
            </header>

            <!-- Failure Reason Banner -->
            <div v-if="failureReasonMessage"
                class="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <svg class="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd"
                        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                        clip-rule="evenodd" />
                </svg>
                <div>
                    <p class="text-sm font-semibold text-amber-800">{{ failureReasonMessage }}</p>
                    <p v-if="isIdentityNotMatched" class="text-xs text-amber-700 mt-1">
                        The checks below could not be performed as identity verification failed.
                    </p>
                </div>
            </div>

            <!-- Top Summary (Status + Identity Match + Risk Level + Score) -->
            <div class="flex flex-wrap justify-between gap-6">

                <!-- Left Side Labels -->
                <div class="flex flex-col gap-4 min-w-[240px]">
                    <!-- <div v-if="props.caller === 'Agent'" class="flex items-center gap-3">
                        <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Status</span>
                        <span :class="badgeClass(statusLabel)">
                            {{ statusLabel }}
                        </span>
                    </div> -->

                    <!-- <div class="flex items-center gap-3">
                        <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Identity Match</span>
                        <span :class="identityMatchBadgeClass">
                            {{ identityMatchLabel }}
                        </span>
                    </div> -->

                    <div class="flex items-center gap-3">
                        <span class="text-sm font-medium text-gray-500 uppercase tracking-wide">Risk Level</span>
                        <span :class="badgeClass(riskLevelLabel)">
                            {{ riskLevelLabel }}
                        </span>
                    </div>
                </div>

                <!-- Risk Score -->
                <div v-if="props.caller === 'Staff'" class="flex flex-col justify-center text-right min-w-[180px]">
                    <span class="text-sm font-semibold uppercase tracking-wide text-gray-500">
                        Risk Score
                    </span>
                    <span class="text-5xl font-bold leading-none" :class="riskScoreColorClass">
                        {{ riskScore }}/999
                    </span>
                </div>
            </div>

            <!-- Verification Flags -->
            <div class="mt-8">
                <h3 class="text-base font-semibold text-gray-800">Verification Flags</h3>

                <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <!-- Electoral Roll -->
                    <div v-if="props.caller === 'Staff'" :class="[
                        'flex items-center gap-3 rounded-xl border px-4 py-3',
                        isIdentityNotMatched ? 'border-gray-200 bg-gray-50' :
                        verificationFlags.electoralRollMatch ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'
                    ]">
                        <span :class="[
                            'flex h-8 w-8 items-center justify-center rounded-full bg-white shadow',
                            isIdentityNotMatched ? 'text-gray-400' :
                            verificationFlags.electoralRollMatch ? 'text-emerald-500' : 'text-rose-500'
                        ]">
                            <!-- Question mark icon for not verified -->
                            <svg v-if="isIdentityNotMatched" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                            </svg>
                            <svg v-else-if="verificationFlags.electoralRollMatch" class="h-5 w-5" viewBox="0 0 20 20"
                                fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                            <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clip-rule="evenodd" />
                            </svg>
                        </span>
                        <span class="text-sm font-semibold text-gray-800">
                            Electoral Roll
                            <span v-if="isIdentityNotMatched" class="text-xs text-gray-500 font-normal">(Not verified)</span>
                        </span>
                    </div>

                    <!-- No CCJs -->
                    <div :class="[
                        'flex items-center gap-3 rounded-xl border px-4 py-3',
                        isIdentityNotMatched ? 'border-gray-200 bg-gray-50' :
                        !verificationFlags.ccjMatch ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'
                    ]">
                        <span :class="[
                            'flex h-8 w-8 items-center justify-center rounded-full bg-white shadow',
                            isIdentityNotMatched ? 'text-gray-400' :
                            !verificationFlags.ccjMatch ? 'text-emerald-500' : 'text-rose-500'
                        ]">
                            <!-- Question mark icon for not verified -->
                            <svg v-if="isIdentityNotMatched" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                            </svg>
                            <svg v-else-if="!verificationFlags.ccjMatch" class="h-5 w-5" viewBox="0 0 20 20"
                                fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                            <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clip-rule="evenodd" />
                            </svg>
                        </span>
                        <span class="text-sm font-semibold text-gray-800">
                            No CCJs
                            <span v-if="isIdentityNotMatched" class="text-xs text-gray-500 font-normal">(Not verified)</span>
                        </span>
                    </div>

                    <!-- No Insolvency -->
                    <div :class="[
                        'flex items-center gap-3 rounded-xl border px-4 py-3',
                        isIdentityNotMatched ? 'border-gray-200 bg-gray-50' :
                        !verificationFlags.insolvencyMatch ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'
                    ]">
                        <span :class="[
                            'flex h-8 w-8 items-center justify-center rounded-full bg-white shadow',
                            isIdentityNotMatched ? 'text-gray-400' :
                            !verificationFlags.insolvencyMatch ? 'text-emerald-500' : 'text-rose-500'
                        ]">
                            <!-- Question mark icon for not verified -->
                            <svg v-if="isIdentityNotMatched" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                            </svg>
                            <svg v-else-if="!verificationFlags.insolvencyMatch" class="h-5 w-5" viewBox="0 0 20 20"
                                fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                            <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clip-rule="evenodd" />
                            </svg>
                        </span>
                        <span class="text-sm font-semibold text-gray-800">
                            No Insolvency
                            <span v-if="isIdentityNotMatched" class="text-xs text-gray-500 font-normal">(Not verified)</span>
                        </span>
                    </div>

                    <!-- Not Deceased -->
                    <div :class="[
                        'flex items-center gap-3 rounded-xl border px-4 py-3',
                        isIdentityNotMatched ? 'border-gray-200 bg-gray-50' :
                        !verificationFlags.deceasedMatch ? 'border-emerald-100 bg-emerald-50/60' : 'border-rose-100 bg-rose-50/60'
                    ]">
                        <span :class="[
                            'flex h-8 w-8 items-center justify-center rounded-full bg-white shadow',
                            isIdentityNotMatched ? 'text-gray-400' :
                            !verificationFlags.deceasedMatch ? 'text-emerald-500' : 'text-rose-500'
                        ]">
                            <!-- Question mark icon for not verified -->
                            <svg v-if="isIdentityNotMatched" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM8.94 6.94a.75.75 0 11-1.061-1.061 3 3 0 112.871 5.026v.345a.75.75 0 01-1.5 0v-.5c0-.72.57-1.172 1.081-1.287A1.5 1.5 0 108.94 6.94zM10 15a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                            </svg>
                            <svg v-else-if="!verificationFlags.deceasedMatch" class="h-5 w-5" viewBox="0 0 20 20"
                                fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                            <svg v-else class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clip-rule="evenodd" />
                            </svg>
                        </span>
                        <span class="text-sm font-semibold text-gray-800">
                            Not Deceased
                            <span v-if="isIdentityNotMatched" class="text-xs text-gray-500 font-normal">(Not verified)</span>
                        </span>
                    </div>
                </div>
            </div>

            <!-- Compliance Screening (NOW MERGED INTO THIS CARD) -->
            <div class="mt-10">
                <h3 class="text-base font-semibold text-gray-800">Compliance Screening</h3>
                <div class="mt-4 divide-y divide-gray-100">
                    <!-- PEP Check -->
                    <div class="flex items-center justify-between py-4">
                        <div>
                            <p class="text-sm font-semibold text-gray-800">Politically Exposed Person (PEP)</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span :class="statusClass(complianceChecks.pep ? 'clear' : 'failed')">
                                {{ complianceChecks.pep ? 'Clear' : 'Failed' }}
                            </span>
                            <span :class="statusIconWrapper(complianceChecks.pep ? 'clear' : 'failed')">
                                <svg v-if="complianceChecks.pep" class="h-4 w-4 text-emerald-600" viewBox="0 0 20 20"
                                    fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                        clip-rule="evenodd" />
                                </svg>
                                <svg v-else class="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clip-rule="evenodd" />
                                </svg>
                            </span>
                        </div>
                    </div>

                    <!-- Sanctions Check -->
                    <div class="flex items-center justify-between py-4">
                        <div>
                            <p class="text-sm font-semibold text-gray-800">Sanctions Screening</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span :class="statusClass(complianceChecks.sanctions ? 'clear' : 'failed')">
                                {{ complianceChecks.sanctions ? 'Clear' : 'Failed' }}
                            </span>
                            <span :class="statusIconWrapper(complianceChecks.sanctions ? 'clear' : 'failed')">
                                <svg v-if="complianceChecks.sanctions" class="h-4 w-4 text-emerald-600"
                                    viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                        clip-rule="evenodd" />
                                </svg>
                                <svg v-else class="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                        clip-rule="evenodd" />
                                </svg>
                            </span>
                        </div>
                    </div>

                    <!-- Adverse Media Check -->
                    <div class="flex items-center justify-between py-4">
                        <div>
                            <p class="text-sm font-semibold text-gray-800">Adverse Media</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <span :class="statusClass(complianceChecks.adverseMedia ? 'clear' : 'failed')">
                                {{ complianceChecks.adverseMedia ? 'Clear' : 'Failed' }}
                            </span>
                            <span :class="statusIconWrapper(complianceChecks.adverseMedia ? 'clear' : 'failed')">
                                <svg v-if="complianceChecks.adverseMedia" class="h-4 w-4 text-emerald-600"
                                    viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586 4.707 9.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"
                                        clip-rule="evenodd" />
                                </svg>
                                <svg v-else class="h-4 w-4 text-rose-500" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd"
                                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
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


interface VerificationFlags {
    ccjMatch: boolean;
    insolvencyMatch: boolean;
    deceasedMatch: boolean;
    electoralRollMatch: boolean;
}

interface VerificationData {
    name_match_score: number | 'yet_to_be_assessed';
    application_status: 'Failed' | 'Passed' | 'Yet to be assessed' | 'PASS_WITH_GUARANTOR';
    risk_level: 'low' | 'medium' | 'high' | 'very_high' | 'yet_to_be_assessed';
    risk_score: number;
    verification_flags: VerificationFlags;
    // New fields to detect "not matched" state
    verification_status?: 'pending' | 'passed' | 'failed' | 'refer' | 'error';
    verify_match?: boolean;
}

interface ComplianceChecks {
    pep?: boolean
    sanctions?: boolean
    adverseMedia?: boolean
}

export interface Props {
    verification?: VerificationData
    complianceChecks?: ComplianceChecks
    caller : "Agent"| "Staff"
}

const props = defineProps<Props>()

// Default failed verification data when no props
const failedVerification: VerificationData = {
    name_match_score: 0,
    application_status: 'Failed',
    risk_level: 'yet_to_be_assessed',
    risk_score: 0,
    verification_flags: {
        ccjMatch: true, // true means CCJ found (bad)
        insolvencyMatch: true, // true means insolvency found (bad)
        deceasedMatch: true, // true means deceased (bad)
        electoralRollMatch: false // false means not found (bad)
    }
}

const verificationData = computed(() => props.verification ?? failedVerification)

// Extract status label from application_status
// const statusLabel = computed(() => {
//     if (!verificationData.value) return 'Failed'
//     const status = verificationData.value.application_status
//     switch (status) {
//         case 'Passed':
//             return 'Passed'
//         case 'Failed':
//             return 'Failed'
//         case 'Yet to be assessed':
//             return 'Yet to be assessed'
//         case 'PASS_WITH_GUARANTOR':
//             return 'Passed with Guarantor'
//         default:
//             return 'Failed'
//     }
// })

// Extract identity match label from name_match_score
// const identityMatchLabel = computed(() => {
//     if (!verificationData.value) return 'No Match'
//     const score = verificationData.value.name_match_score ?? 0
//     if (typeof score === 'number') {
//         if (score >= 80) return 'Match Found'
//         if (score >= 60) return 'Partial Match'
//         return 'No Match'
//     }
//     return 'Yet to be assessed'
// })

// Risk score color based on ranges: 0-350 red, 350-649 yellow, 650+ green
const riskScoreColorClass = computed(() => {
    const score = riskScore.value
    if (score >= 650) return 'text-emerald-500'
    if (score >= 350) return 'text-yellow-500'
    return 'text-rose-500'
})

// Identity match badge color - red if "No Match"
// const identityMatchBadgeClass = computed(() => {
//     const label = identityMatchLabel.value
//     if (label === 'No Match') return badgeClass('failed')
//     return badgeClass(label)
// })

// Extract risk level label
const riskLevelLabel = computed(() => {
    if (!verificationData.value) return 'Yet to be assessed'
    const level = verificationData.value.risk_level
    switch (level) {
        case 'low':
            return 'Low'
        case 'medium':
            return 'Medium'
        case 'high':
            return 'High'
        case 'very_high':
            return 'Very High'
        case 'yet_to_be_assessed':
            return 'Yet to be assessed'
        default:
            return 'Yet to be assessed'
    }
})

// Extract risk score
const riskScore = computed(() => {
    if (!verificationData.value) return 0
    return verificationData.value.risk_score ?? 0
})

// Detect if verification failed because identity couldn't be matched
const isIdentityNotMatched = computed(() => {
    const v = verificationData.value
    return v?.verification_status === 'failed' && v?.verify_match === false
})

// Get failure reason message
const failureReasonMessage = computed(() => {
    const v = verificationData.value
    if (!v) return null

    if (v.verification_status === 'failed') {
        // Check if verify_match is explicitly false (identity not found)
        if (v.verify_match === false) {
            return 'Identity could not be verified - person not found in credit records'
        }
        // If high/very_high risk, that's the failure reason
        if (v.risk_level === 'high' || v.risk_level === 'very_high') {
            return 'Verification failed due to high risk indicators'
        }
        // Check fraud indicators to determine specific failure reason
        const flags = v.verification_flags
        if (flags) {
            const issues: string[] = []
            if (flags.ccjMatch) issues.push('CCJ records found')
            if (flags.insolvencyMatch) issues.push('Insolvency records found')
            if (flags.deceasedMatch) issues.push('Deceased register match')
            if (flags.electoralRollMatch === false) issues.push('Not found on Electoral Roll')

            if (issues.length > 0) {
                return `Verification failed: ${issues.join(', ')}`
            }
        }
        // If all flags are clear but still failed, it may be a staff decision or identity match issue
        return 'Credit verification failed - review required'
    }
    if (v.verification_status === 'refer') {
        return 'Manual review required'
    }
    if (v.verification_status === 'error') {
        return 'Verification error occurred - please retry'
    }
    return null
})

// Verification flags - extract from verification_flags, default to false (failed) if not provided
const verificationFlags = computed(() => {
    const flags = verificationData.value?.verification_flags
    return {
        electoralRollMatch: flags?.electoralRollMatch ?? false,
        ccjMatch: flags?.ccjMatch ?? true, // Default to true (bad) if not provided
        insolvencyMatch: flags?.insolvencyMatch ?? true, // Default to true (bad) if not provided
        deceasedMatch: flags?.deceasedMatch ?? true // Default to true (bad) if not provided
    }
})

// Compliance checks - default to false (failed) if not provided
const complianceChecks = computed(() => ({
    pep: props.complianceChecks?.pep ?? false,
    sanctions: props.complianceChecks?.sanctions ?? false,
    adverseMedia: props.complianceChecks?.adverseMedia ?? false
}))

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
    if (['pass', 'passed', 'match', 'low', 'clear', 'success', 'no', 'found'].some((word) => normalized.includes(word))) {
        return 'success'
    }
    if (['fail', 'failed', 'high', 'risk', 'alert', 'adverse'].some((word) => normalized.includes(word))) {
        return 'danger'
    }
    if (['pending', 'medium', 'review', 'assessed', 'partial'].some((word) => normalized.includes(word))) {
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

</script>
