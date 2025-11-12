<template>
    <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-4xl mx-auto">
            <!-- Header with Branding -->
            <div v-if="brandingLoaded" class="text-center mb-8">
                <div class="flex justify-center items-center gap-3 mb-4">
                    <template v-if="companyLogo">
                        <img :src="companyLogo" alt="Company Logo" class="h-20 object-contain" />
                    </template>
                    <template v-else>
                        <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="h-12 w-12" />
                        <span class="text-2xl font-bold">
                            <span class="text-gray-900">Property</span><span
                                :style="{ color: primaryColor }">Goose</span>
                        </span>
                    </template>
                </div>
                <h1 class="text-3xl font-bold" :style="{ color: primaryColor }">Tenant Offer Form</h1>
                <p class="mt-2 text-gray-600">Please complete all sections to submit your offer</p>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="bg-white rounded-lg shadow p-8 text-center">
                <div class="text-gray-600">Loading...</div>
            </div>

            <!-- Success State -->
            <div v-else-if="submitted" class="bg-white rounded-lg shadow p-8 text-center">
                <svg class="mx-auto h-12 w-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="mt-4 text-lg font-semibold text-gray-900">Offer Submitted Successfully!</h3>
                <p class="mt-2 text-gray-600">Your offer has been submitted and will be reviewed by the agent.</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="handleSubmit" class="space-y-6">
                <!-- Property Information -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold text-gray-900 mb-4">Property Information</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="md:col-span-2">
                            <label for="property-address" class="block text-sm font-medium text-gray-700 mb-2">
                                Property Address *
                            </label>
                            <input id="property-address" v-model="formData.property_address" type="text" required
                                placeholder="Enter the full property address"
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                        </div>
                        <div>
                            <label for="property-city" class="block text-sm font-medium text-gray-700 mb-2">
                                City
                            </label>
                            <input id="property-city" v-model="formData.property_city" type="text" placeholder="City"
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                        </div>
                        <div>
                            <label for="property-postcode" class="block text-sm font-medium text-gray-700 mb-2">
                                Postcode
                            </label>
                            <input id="property-postcode" v-model="formData.property_postcode" type="text"
                                placeholder="Postcode"
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                        </div>
                    </div>
                </div>

                <!-- Offer Details -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold text-gray-900 mb-4">Offer Details</h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="offered-rent" class="block text-sm font-medium text-gray-700 mb-2">
                                Offered Rent Amount (£ per month) *
                            </label>
                            <input id="offered-rent" v-model.number="formData.offered_rent_amount" type="number"
                                step="0.01" required min="0"
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                        </div>
                        <div>
                            <label for="move-in-date" class="block text-sm font-medium text-gray-700 mb-2">
                                Proposed Move-in Date *
                            </label>
                            <input id="move-in-date" v-model="formData.proposed_move_in_date" type="date" required
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                        </div>
                        <div>
                            <label for="tenancy-length" class="block text-sm font-medium text-gray-700 mb-2">
                                Proposed Tenancy Length (months) *
                            </label>
                            <input id="tenancy-length" v-model.number="formData.proposed_tenancy_length_months"
                                type="number" required min="1" max="12"
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            <p class="mt-1 text-xs text-gray-500">Must be between 1 and 12 months</p>
                        </div>
                        <div>
                            <label for="deposit-amount" class="block text-sm font-medium text-gray-700 mb-2">
                                Deposit Amount (£) (Optional)
                            </label>
                            <input id="deposit-amount" v-model.number="formData.deposit_amount" type="number"
                                step="0.01" min="0"
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                        </div>
                        <div class="md:col-span-2">
                            <label for="special-conditions" class="block text-sm font-medium text-gray-700 mb-2">
                                Special Conditions for Landlord to Consider
                            </label>
                            <textarea id="special-conditions" v-model="formData.special_conditions" rows="4"
                                placeholder="Any special conditions or requests..."
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"></textarea>
                        </div>
                    </div>
                </div>

                <!-- Tenants -->
                <div class="bg-white rounded-lg shadow p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-semibold text-gray-900">Tenants</h2>
                        <button type="button" @click="addTenant"
                            class="px-4 py-2 text-sm font-medium text-white rounded-md hover:opacity-90"
                            :style="{ backgroundColor: buttonColor }">
                            Add Tenant
                        </button>
                    </div>

                    <div v-for="(tenant, index) in formData.tenants" :key="index"
                        class="mb-6 p-4 border border-gray-200 rounded-lg">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-lg font-medium text-gray-900">Tenant {{ index + 1 }}</h3>
                            <button v-if="formData.tenants.length > 1" type="button" @click="removeTenant(index)"
                                class="text-sm text-red-600 hover:text-red-700">
                                Remove
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label :for="`tenant-${index}-name`"
                                    class="block text-sm font-medium text-gray-700 mb-2">
                                    Full Name *
                                </label>
                                <input :id="`tenant-${index}-name`" v-model="tenant.name" type="text" required
                                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <label :for="`tenant-${index}-address`"
                                    class="block text-sm font-medium text-gray-700 mb-2">
                                    Current Address *
                                </label>
                                <input :id="`tenant-${index}-address`" v-model="tenant.address" type="text" required
                                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <PhoneInput v-model="tenant.phone" :label="`Phone Number`" :id="`tenant-${index}-phone`"
                                    :required="true" />
                            </div>
                            <div>
                                <label :for="`tenant-${index}-email`"
                                    class="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address *
                                </label>
                                <input :id="`tenant-${index}-email`" v-model="tenant.email" type="email" required
                                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <label :for="`tenant-${index}-income`"
                                    class="block text-sm font-medium text-gray-700 mb-2">
                                    Annual Income (£) *
                                </label>
                                <input :id="`tenant-${index}-income`" v-model="tenant.annual_income" type="text"
                                    required placeholder="e.g., 30000"
                                    class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div class="md:col-span-2">
                                <div class="flex items-start">
                                    <input :id="`tenant-${index}-no-ccj`" v-model="tenant.no_ccj_bankruptcy_iva"
                                        type="checkbox" required
                                        class="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded" />
                                    <label :for="`tenant-${index}-no-ccj`" class="ml-2 block text-sm text-gray-700">
                                        I confirm that I do not have any CCJs, Bankruptcies or IVAs *
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Declaration and Signature -->
                <div class="bg-white rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold text-gray-900 mb-4">Declaration</h2>
                    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <p class="text-sm text-gray-700">
                            I agree that Propertygoose Ltd will use the information I provide on this application form
                            and any
                            information acquired from relevant sources to process my application for tenancy/to become a
                            Guarantor
                            for a tenancy. I understand that this application and the results of the findings will be
                            forwarded to
                            the instructing letting agent and/or landlord and that this information may be accessed
                            again in the
                            future should I default on my rental payments or payments due as a Guarantor, apply for a
                            new tenancy or
                            if there is a complaint or legal challenge with significance to this process.
                        </p>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <label for="signature-name" class="block text-sm font-medium text-gray-700 mb-2">
                                Full Name (as signature) *
                            </label>
                            <input id="signature-name" v-model="formData.signature_name" type="text" required
                                class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                        </div>

                        <SignaturePad v-model="formData.signature" label="Signature" />
                    </div>
                </div>

                <!-- Error Message -->
                <div v-if="submitError" class="bg-red-50 border border-red-200 text-red-600 px-6 py-4 rounded-lg">
                    {{ submitError }}
                </div>

                <!-- Submit Button -->
                <div class="bg-white rounded-lg shadow p-6">
                    <button type="submit" :disabled="submitting"
                        class="w-full px-6 py-3 text-base font-medium text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                        :style="{ backgroundColor: buttonColor }">
                        {{ submitting ? 'Submitting...' : 'Submit Offer' }}
                    </button>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import SignaturePad from '../components/SignaturePad.vue'
import PhoneInput from '../components/PhoneInput.vue'

const route = useRoute()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loading = ref(false)
const submitted = ref(false)
const submitting = ref(false)
const submitError = ref('')
const brandingLoaded = ref(false)

// Company branding
const companyLogo = ref('')
const primaryColor = ref('#FF8C41')
const buttonColor = ref('#FF8C41')

const formData = ref({
    property_address: '',
    property_city: '',
    property_postcode: '',
    offered_rent_amount: null as number | null,
    proposed_move_in_date: '',
    proposed_tenancy_length_months: 12,
    deposit_amount: null as number | null,
    special_conditions: '',
    tenants: [
        {
            name: '',
            address: '',
            phone: '',
            email: '',
            annual_income: '',
            no_ccj_bankruptcy_iva: false
        }
    ],
    signature: '',
    signature_name: ''
})

const addTenant = () => {
    formData.value.tenants.push({
        name: '',
        address: '',
        phone: '',
        email: '',
        annual_income: '',
        no_ccj_bankruptcy_iva: false
    })
}

const removeTenant = (index: number) => {
    if (formData.value.tenants.length > 1) {
        formData.value.tenants.splice(index, 1)
    }
}

const handleSubmit = async () => {
    submitError.value = ''
    submitting.value = true

    try {
        // Validate form
        if (!formData.value.property_address || !formData.value.offered_rent_amount ||
            !formData.value.proposed_move_in_date || !formData.value.proposed_tenancy_length_months) {
            throw new Error('Please fill in all required fields')
        }

        if (formData.value.proposed_tenancy_length_months < 1 || formData.value.proposed_tenancy_length_months > 12) {
            throw new Error('Tenancy length must be between 1 and 12 months')
        }

        if (formData.value.tenants.length === 0) {
            throw new Error('At least one tenant is required')
        }

        // Validate each tenant
        for (let i = 0; i < formData.value.tenants.length; i++) {
            const tenant = formData.value.tenants[i]
            if (!tenant?.name || !tenant.address || !tenant.phone || !tenant.email || !tenant.annual_income) {
                throw new Error(`Tenant ${i + 1} is missing required fields`)
            }
            if (!tenant.no_ccj_bankruptcy_iva) {
                throw new Error(`Tenant ${i + 1} must confirm they have no CCJs, Bankruptcies or IVAs`)
            }
        }

        if (!formData.value.signature || !formData.value.signature_name) {
            throw new Error('Signature and signature name are required')
        }

        // Get company ID from query parameter
        const companyId = route.query.company_id as string
        if (!companyId) {
            throw new Error('Company ID is required. Please provide company_id as a query parameter.')
        }

        // Prepare payload
        const payload = {
            property_address: formData.value.property_address,
            property_city: formData.value.property_city || null,
            property_postcode: formData.value.property_postcode || null,
            offered_rent_amount: formData.value.offered_rent_amount,
            proposed_move_in_date: formData.value.proposed_move_in_date,
            proposed_tenancy_length_months: formData.value.proposed_tenancy_length_months,
            deposit_amount: formData.value.deposit_amount || null,
            special_conditions: formData.value.special_conditions || null,
            tenants: formData.value.tenants.map(tenant => ({
                name: tenant.name,
                address: tenant.address,
                phone: tenant.phone,
                email: tenant.email,
                annual_income: tenant.annual_income,
                no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
                signature: formData.value.signature,
                signature_name: formData.value.signature_name
            }))
        }

        // Submit offer
        const response = await fetch(`${API_URL}/api/tenant-offers/submit?company_id=${companyId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || 'Failed to submit offer')
        }

        submitted.value = true
    } catch (error: any) {
        submitError.value = error.message || 'An error occurred while submitting the offer'
    } finally {
        submitting.value = false
    }
}

// Fetch company branding on mount
onMounted(async () => {
    try {
        const companyId = route.query.company_id as string
        if (!companyId) {
            brandingLoaded.value = true
            return
        }

        // Load branding from company
        const response = await fetch(`${API_URL}/api/company/branding/${companyId}`)
        if (response.ok) {
            const data = await response.json()
            if (data.branding) {
                companyLogo.value = data.branding.logo_url || ''
                primaryColor.value = data.branding.primary_color || '#FF8C41'
                buttonColor.value = data.branding.button_color || '#FF8C41'
            }
        }
    } catch (err) {
        console.error('Failed to load branding:', err)
    } finally {
        brandingLoaded.value = true
    }
})
</script>

<style scoped>
/* Override focus colors with company branding */
input:focus,
textarea:focus,
select:focus {
    --tw-ring-color: v-bind(primaryColor);
    border-color: v-bind(primaryColor);
}
</style>
