<template>
    <Sidebar>
        <div class="p-8">
            <div class="mb-8">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h2 class="text-3xl font-bold text-gray-900">Send Application Form</h2>
                        <p class="mt-2 text-gray-600">Send an offer form link to a tenant via email</p>
                    </div>
                </div>
            </div>

            <div class="max-w-2xl">
                <!-- Success State -->
                <div v-if="isSuccess" class="bg-white rounded-lg shadow p-8 text-center">
                    <div class="mb-6">
                        <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                            <svg class="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M5 13l4 4L19 7"></path>
                            </svg>
                        </div>
                        <h3 class="text-2xl font-bold text-gray-900 mb-2">Application Form Sent Successfully!</h3>
                        <p class="text-gray-600 mb-1">The offer form link has been sent to</p>
                        <p class="text-gray-900 font-medium mb-4">{{ submittedEmail }}</p>
                        <p class="text-sm text-gray-500">
                            The tenant will receive an email with a link to complete the offer form.
                        </p>
                    </div>
                    <div class="flex justify-center space-x-3">
                        <router-link to="/dashboard"
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                            Back to Dashboard
                        </router-link>
                        <button @click="createNewApplication"
                            class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md">
                            Create New Application
                        </button>
                    </div>
                </div>

                <!-- Form State -->
                <div v-else class="bg-white rounded-lg shadow p-6">
                    <form @submit.prevent="handleSubmit" class="space-y-6">
                        <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                            {{ errorMessage }}
                        </div>

                        <!-- Applicant Email -->
                        <div>
                            <label for="applicant-email" class="block text-sm font-medium text-gray-700 mb-2">
                                Tenant Email Address *
                            </label>
                            <input id="applicant-email" v-model="formData.applicant_email" type="email" required
                                placeholder="tenant@example.com"
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm" />
                            <p class="mt-1 text-sm text-gray-500">
                                The tenant will receive an email with a link to complete the offer form
                            </p>
                        </div>

                        <!-- Property Address -->
                        <div class="relative overflow-visible">
                            <AddressAutocomplete v-model="formData.property_address" label="Property Address to Rent"
                                :required="true" id="property-address" placeholder="Start typing address..."
                                @addressSelected="handlePropertyAddressSelected" />
                        </div>

                        <!-- Deposit Replacement Offer -->
                        <div class="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                            <input id="offer-deposit-replacement" type="checkbox"
                                v-model="formData.offer_deposit_replacement"
                                class="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
                            <div>
                                <label for="offer-deposit-replacement" class="text-sm font-medium text-gray-900">
                                    Offer Deposit Replacement
                                </label>
                                <p class="text-sm text-gray-600 mt-1">
                                    Include an option in the tenant application for them to request the deposit
                                    replacement service.
                                </p>
                            </div>
                        </div>

                        <!-- Submit Button -->
                        <div class="flex justify-end space-x-3">
                            <router-link to="/dashboard"
                                class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                                Cancel
                            </router-link>
                            <button type="submit" :disabled="loading"
                                class="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50 disabled:cursor-not-allowed">
                                <span v-if="loading">Sending...</span>
                                <span v-else>Send Application Form</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </Sidebar>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import Sidebar from '../components/Sidebar.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'

const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const formData = ref({
    applicant_email: '',
    property_address: '',
    offer_deposit_replacement: false
})

const errorMessage = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const loading = ref(false)
const isSuccess = ref(false)
const submittedEmail = ref<string>('')

const handlePropertyAddressSelected = (addressData: any) => {
    formData.value.property_address = addressData.addressLine1
    // Optionally store city and postcode if needed in the future
    // formData.value.property_city = addressData.city
    // formData.value.property_postcode = addressData.postcode
}

const handleSubmit = async () => {
    errorMessage.value = null
    successMessage.value = null

    if (!formData.value.applicant_email || !formData.value.property_address) {
        errorMessage.value = 'Please fill in all required fields'
        return
    }

    loading.value = true

    try {
        const token = authStore.session?.access_token
        if (!token) {
            errorMessage.value = 'You must be logged in to send the offer form'
            return
        }

        // Send offer form link
        const response = await fetch(`${API_URL}/api/tenant-offers/send-link`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tenant_email: formData.value.applicant_email,
                property_address: formData.value.property_address,
                offer_deposit_replacement: formData.value.offer_deposit_replacement
            })
        })

        const data = await response.json()

        if (!response.ok) {
            errorMessage.value = data.error || 'Failed to send offer form link'
            return
        }

        // Store submitted email and show success state
        submittedEmail.value = formData.value.applicant_email
        isSuccess.value = true

        // Clear form
        formData.value = {
            applicant_email: '',
            property_address: '',
            offer_deposit_replacement: false
        }
    } catch (err: any) {
        errorMessage.value = err.message || 'An error occurred while sending the offer form link'
    } finally {
        loading.value = false
    }
}

const createNewApplication = () => {
    isSuccess.value = false
    submittedEmail.value = ''
    errorMessage.value = null
    successMessage.value = null
    formData.value = {
        applicant_email: '',
        property_address: '',
        offer_deposit_replacement: false
    }
}
</script>
