<template>
    <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div class="px-6 py-6 sm:px-10 sm:py-8 space-y-6">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div class="flex items-center gap-3">
                    <img v-if="companyLogo" :src="companyLogo" alt="Company Logo"
                        class="h-14 w-14 object-contain rounded" />
                    <div>
                        <p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Secure Request From</p>
                        <p class="text-xl font-bold text-gray-900">{{ companyName || 'Your letting agent' }}</p>
                    </div>
                </div>
                <span class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                    :style="{ backgroundColor: `${primaryColor}15`, color: primaryColor }">
                    <Info class="w-4 h-4" />
                    Camera Required
                </span>
            </div>

            <div class="space-y-2">
                <h2 class="text-2xl font-bold text-gray-900">
                    {{ title }}
                </h2>
                <p class="text-gray-600">
                    {{ description }}
                </p>
            </div>

            <div class="grid gap-6 md:grid-cols-2">
                <div class="bg-gray-50 rounded-xl p-5 space-y-4">
                    <div>
                        <p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Request Details</p>
                        <ul class="mt-3 space-y-3">
                            <li v-for="(item, index) in filteredRequestDetails" :key="index"
                                class="flex items-start gap-3">
                                <div class="w-1 h-1 rounded-full mt-2" :style="{ backgroundColor: primaryColor }"></div>
                                <div>
                                    <p class="text-xs font-medium text-gray-500 uppercase tracking-wide">{{ item.label
                                        }}</p>
                                    <p class="text-sm text-gray-900">{{ item.value }}</p>
                                </div>
                            </li>
                        </ul>
                    </div>

                    <div class="border-t border-gray-200 pt-4 space-y-1">
                        <p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Agent Contact</p>
                        <p class="text-sm text-gray-900">{{ companyName }}</p>
                        <p v-if="companyContactEmail" class="text-sm text-gray-600">
                            <a class="hover:underline" :href="`mailto:${companyContactEmail}`">{{ companyContactEmail
                                }}</a>
                        </p>
                        <p v-if="companyContactPhone" class="text-sm text-gray-600">
                            <a class="hover:underline" :href="`tel:${companyContactPhone}`">{{ companyContactPhone
                                }}</a>
                        </p>
                        <p v-if="companyContactAddress" class="text-sm text-gray-600">
                            {{ companyContactAddress }}
                        </p>
                        <p v-if="companyWebsite" class="text-sm text-gray-600">
                            <a class="hover:underline" :href="companyWebsite" target="_blank" rel="noopener noreferrer">
                                {{ companyWebsite }}
                            </a>
                        </p>
                    </div>
                </div>

                <div class="bg-gray-50 rounded-xl p-5 flex flex-col items-center text-center gap-4">
                    <p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Open On Another Device</p>
                    <div class="bg-white p-4 rounded-2xl shadow-inner">
                        <img v-if="qrCodeDataUrl" :src="qrCodeDataUrl" alt="QR Code" class="w-48 h-48 object-contain" />
                        <div v-else class="w-48 h-48 flex items-center justify-center text-gray-400">
                            <QrCode class="w-12 h-12" />
                        </div>
                    </div>
                    <p class="text-sm text-gray-600">
                        Scan this QR code with your phone camera to continue on a mobile device. You'll need to take
                        live photos and upload documents.
                    </p>
                    <button type="button"
                        class="inline-flex items-center justify-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-100 transition-colors"
                        @click="copyLink">
                        <Copy class="w-4 h-4" />
                        <span>{{ copied ? 'Link copied!' : 'Copy secure link' }}</span>
                    </button>
                </div>
            </div>

            <div class="border-t border-gray-200 pt-6">
                <p class="text-sm text-gray-600 mb-3">
                    Prefer to continue here? Make sure you're on a device with a working camera before proceeding.
                </p>
                <div class="flex flex-col sm:flex-row gap-3">
                    <button type="button"
                        class="px-6 py-3 rounded-lg font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                        :style="{ backgroundColor: buttonColor || primaryColor }" @click="handleProceed">
                        {{ proceedLabel }}
                    </button>
                    <div class="flex items-center text-sm text-gray-500 gap-2">
                        <Video class="w-4 h-4 text-gray-400" />
                        You can come back to this screen at any time.
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { PropType } from 'vue'
import QRCode from 'qrcode'
import { Info, QrCode, Copy, Video } from 'lucide-vue-next'
import { defaultBranding } from '../config/colors'

type Detail = {
    label: string
    value?: string | null
}

const props = defineProps({
    title: {
        type: String,
        default: 'Proceed on the best device'
    },
    description: {
        type: String,
        default: ''
    },
    companyName: {
        type: String,
        default: ''
    },
    companyLogo: {
        type: String,
        default: ''
    },
    companyContactEmail: {
        type: String,
        default: ''
    },
    companyContactPhone: {
        type: String,
        default: ''
    },
    companyContactAddress: {
        type: String,
        default: ''
    },
    companyWebsite: {
        type: String,
        default: ''
    },
    requestDetails: {
        type: Array as PropType<Detail[]>,
        default: () => []
    },
    link: {
        type: String,
        default: ''
    },
    primaryColor: {
        type: String,
        default: '#111827'
    },
    buttonColor: {
        type: String,
        default: defaultBranding.buttonColor
    },
    proceedLabel: {
        type: String,
        default: 'Proceed on this device (Camera required)'
    }
})

const emit = defineEmits<{
    (e: 'proceed'): void
}>()

const qrCodeDataUrl = ref('')
const copied = ref(false)

const linkToUse = computed(() => {
    if (props.link) return props.link
    if (typeof window !== 'undefined') {
        return window.location.href
    }
    return ''
})

const filteredRequestDetails = computed(() => props.requestDetails.filter(detail => detail.value))

const generateQrCode = async () => {
    const target = linkToUse.value
    if (!target) {
        qrCodeDataUrl.value = ''
        return
    }

    try {
        qrCodeDataUrl.value = await QRCode.toDataURL(target, {
            width: 256,
            margin: 1,
            color: {
                dark: '#1f2937',
                light: '#ffffff'
            }
        })
    } catch (error) {
        console.error('Failed to generate QR code', error)
        qrCodeDataUrl.value = ''
    }
}

const copyLink = async () => {
    try {
        if (linkToUse.value && navigator.clipboard) {
            await navigator.clipboard.writeText(linkToUse.value)
            copied.value = true
            setTimeout(() => (copied.value = false), 3000)
        }
    } catch (error) {
        console.error('Failed to copy link', error)
    }
}

const handleProceed = () => {
    emit('proceed')
}

watch(linkToUse, () => {
    generateQrCode()
})

onMounted(() => {
    generateQrCode()
})
</script>
