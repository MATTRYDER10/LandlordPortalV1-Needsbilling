<template>
    <div class="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-4xl mx-auto">
            <!-- Header -->
            <div class="text-center mb-8">
                <div class="flex justify-center items-center gap-3 mb-4">
                    <img src="/PropertyGooseIcon.webp" alt="PropertyGoose" class="h-12 w-12" />
                    <span class="text-2xl font-bold">
                        <span class="text-gray-900">Property</span><span class="text-primary">Goose</span>
                    </span>
                </div>
                <h1 class="text-3xl font-bold text-gray-900">Create Tenant Reference</h1>
                <p class="mt-2 text-gray-600">Please complete all sections to create a reference</p>
            </div>

            <!-- Form -->
            <form @submit.prevent="handleSubmit" class="space-y-6">
                <div class="bg-white rounded-lg shadow p-6">
                    <!-- Tenant Count - Fixed to 1 for tenant-side applications -->
                    <!-- Multi-tenant references are created by agents only -->

                    <!-- Property Information -->
                    <div class="mb-6">
                        <h4 class="text-md font-semibold text-gray-700 mb-3">Property Information</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <AddressAutocomplete v-model="formData.property_address" label="Property Address"
                                    :required="true" id="address" placeholder="Start typing address..."
                                    @addressSelected="handlePropertyAddressSelected" />
                            </div>
                            <div>
                                <label for="city" class="block text-sm font-medium text-gray-700">City *</label>
                                <input id="city" v-model="formData.property_city" type="text" required
                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <label for="postcode" class="block text-sm font-medium text-gray-700">Postcode *</label>
                                <input id="postcode" v-model="formData.property_postcode" type="text" required
                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <label for="rent" class="block text-sm font-medium text-gray-700">Total Monthly Rent (£)
                                    *</label>
                                <input id="rent" v-model.number="formData.monthly_rent" type="number" step="1" required
                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                        </div>
                    </div>

                    <!-- Single Tenant Information -->
                    <div v-if="tenantCount === 1" class="mb-6">
                        <h4 class="text-md font-semibold text-gray-700 mb-3">Tenant Information</h4>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label for="first-name" class="block text-sm font-medium text-gray-700">First Name
                                    *</label>
                                <input id="first-name" v-model="formData.tenant_first_name" type="text" required
                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <label for="last-name" class="block text-sm font-medium text-gray-700">Last Name
                                    *</label>
                                <input id="last-name" v-model="formData.tenant_last_name" type="text" required
                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <label for="email" class="block text-sm font-medium text-gray-700">Email *</label>
                                <input id="email" v-model="formData.tenant_email" type="email" required
                                    class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                            </div>
                            <div>
                                <PhoneInput v-model="formData.tenant_phone" label="Phone" id="phone" :required="true" />
                            </div>
                        </div>

                        <!-- Guarantor for single tenant -->
                        <div class="mt-4 pt-4 border-t border-gray-200">
                            <div class="flex items-center justify-between mb-3">
                                <h5 class="text-sm font-semibold text-gray-700">Add Guarantor (Optional)</h5>
                                <button type="button" @click="showGuarantorFields = !showGuarantorFields"
                                    class="text-sm text-primary hover:underline">
                                    {{ showGuarantorFields ? 'Hide' : 'Show' }}
                                </button>
                            </div>

                            <div v-if="showGuarantorFields"
                                class="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <p class="text-sm text-gray-600">Add guarantor details. They will receive an email to
                                    complete the reference form.</p>

                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label for="guarantor-first-name"
                                            class="block text-sm font-medium text-gray-700">First Name</label>
                                        <input id="guarantor-first-name" v-model="formData.guarantor_first_name"
                                            type="text"
                                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div>
                                        <label for="guarantor-last-name"
                                            class="block text-sm font-medium text-gray-700">Last Name</label>
                                        <input id="guarantor-last-name" v-model="formData.guarantor_last_name"
                                            type="text"
                                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div>
                                        <label for="guarantor-email"
                                            class="block text-sm font-medium text-gray-700">Email</label>
                                        <input id="guarantor-email" v-model="formData.guarantor_email" type="email"
                                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                    </div>
                                    <div>
                                        <PhoneInput v-model="formData.guarantor_phone" label="Phone"
                                            id="guarantor-phone" :required="false" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Multiple Tenants -->
                    <div v-if="tenantCount > 1" class="mb-6">
                        <h4 class="text-md font-semibold text-gray-700 mb-3">Tenants</h4>
                        <div v-for="(tenant, index) in tenants" :key="index"
                            class="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <h5 class="text-sm font-semibold text-gray-700 mb-3">Tenant {{ index + 1 }}</h5>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label :for="`tenant-${index}-first-name`"
                                        class="block text-sm font-medium text-gray-700">First Name *</label>
                                    <input :id="`tenant-${index}-first-name`" v-model="tenant.first_name" type="text"
                                        required
                                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                    <label :for="`tenant-${index}-last-name`"
                                        class="block text-sm font-medium text-gray-700">Last Name *</label>
                                    <input :id="`tenant-${index}-last-name`" v-model="tenant.last_name" type="text"
                                        required
                                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                    <label :for="`tenant-${index}-email`"
                                        class="block text-sm font-medium text-gray-700">Email *</label>
                                    <input :id="`tenant-${index}-email`" v-model="tenant.email" type="email" required
                                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                </div>
                                <div>
                                    <PhoneInput v-model="tenant.phone" :label="`Phone`" :id="`tenant-${index}-phone`"
                                        :required="true" />
                                </div>
                                <div class="col-span-2">
                                    <label :for="`tenant-${index}-rent-share`"
                                        class="block text-sm font-medium text-gray-700">Rent Share (£) *</label>
                                    <input :id="`tenant-${index}-rent-share`" v-model.number="tenant.rent_share"
                                        type="number" step="0.01" required
                                        class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                                        placeholder="0.00" />
                                </div>
                            </div>

                            <!-- Guarantor for this tenant -->
                            <div class="mt-3 pt-3 border-t border-gray-300">
                                <div class="flex items-center justify-between mb-2">
                                    <h6 class="text-sm font-medium text-gray-700">Add Guarantor (Optional)</h6>
                                    <button type="button"
                                        @click="tenant.showGuarantorFields = !tenant.showGuarantorFields"
                                        class="text-xs text-primary hover:underline">
                                        {{ tenant.showGuarantorFields ? 'Hide' : 'Show' }}
                                    </button>
                                </div>

                                <div v-if="tenant.showGuarantorFields"
                                    class="space-y-3 p-3 bg-white rounded-lg border border-gray-200">
                                    <p class="text-xs text-gray-600">Add guarantor details for this tenant. They will
                                        receive an email to complete the reference form.</p>

                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label :for="`tenant-${index}-guarantor-first-name`"
                                                class="block text-xs font-medium text-gray-700">First Name</label>
                                            <input :id="`tenant-${index}-guarantor-first-name`"
                                                :value="tenant.guarantor?.first_name || ''"
                                                @input="(e) => { if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.first_name = (e.target as HTMLInputElement).value }"
                                                type="text"
                                                class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                        </div>
                                        <div>
                                            <label :for="`tenant-${index}-guarantor-last-name`"
                                                class="block text-xs font-medium text-gray-700">Last Name</label>
                                            <input :id="`tenant-${index}-guarantor-last-name`"
                                                :value="tenant.guarantor?.last_name || ''"
                                                @input="(e) => { if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.last_name = (e.target as HTMLInputElement).value }"
                                                type="text"
                                                class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                        </div>
                                        <div>
                                            <label :for="`tenant-${index}-guarantor-email`"
                                                class="block text-xs font-medium text-gray-700">Email</label>
                                            <input :id="`tenant-${index}-guarantor-email`"
                                                :value="tenant.guarantor?.email || ''"
                                                @input="(e) => { if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.email = (e.target as HTMLInputElement).value }"
                                                type="email"
                                                class="mt-1 block w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                        </div>
                                        <div>
                                            <label :for="`tenant-${index}-guarantor-phone`"
                                                class="block text-xs font-medium text-gray-700">Phone</label>
                                            <PhoneInput :modelValue="tenant.guarantor?.phone || ''"
                                                @update:modelValue="(val) => { if (!tenant.guarantor) tenant.guarantor = { first_name: '', last_name: '', email: '', phone: '' }; tenant.guarantor.phone = val }"
                                                :id="`tenant-${index}-guarantor-phone`" :required="false"
                                                input-class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                                                select-class="px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-primary focus:border-primary" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Rent Calculator -->
                        <div class="p-4 rounded-lg"
                            :class="rentSharesValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
                            <div class="flex justify-between items-center">
                                <span class="text-sm font-medium"
                                    :class="rentSharesValid ? 'text-green-900' : 'text-red-900'">
                                    Total Rent Shares:
                                </span>
                                <span class="text-lg font-bold"
                                    :class="rentSharesValid ? 'text-green-900' : 'text-red-900'">
                                    £{{ totalRentShare.toFixed(2) }} / £{{ Number(formData.monthly_rent || 0).toFixed(2)
                                    }}
                                </span>
                            </div>
                            <p v-if="!rentSharesValid" class="text-xs text-red-700 mt-2">
                                Rent shares must sum exactly to the total monthly rent
                            </p>
                            <p v-else class="text-xs text-green-700 mt-2">
                                ✓ Rent shares match total rent
                            </p>
                        </div>
                    </div>

                    <!-- Move-in Date & Term Length -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <DatePicker v-model="formData.move_in_date" label="Move-in Date" :required="true"
                                year-range-type="move-in" />
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Term Length</label>
                            <div class="grid grid-cols-2 gap-3">
                                <div class="flex items-center gap-2">
                                    <label for="term-years"
                                        class="text-sm text-gray-600 whitespace-nowrap">Years</label>
                                    <input id="term-years" v-model.number="formData.term_years" type="number" min="0"
                                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                                        placeholder="0" />
                                </div>
                                <div class="flex items-center gap-2">
                                    <label for="term-months"
                                        class="text-sm text-gray-600 whitespace-nowrap">Months</label>
                                    <input id="term-months" v-model.number="formData.term_months" type="number" min="0"
                                        max="11"
                                        class="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                                        placeholder="0" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Notes -->
                    <div class="mb-6">
                        <label for="notes" class="block text-sm font-medium text-gray-700">Notes</label>
                        <textarea id="notes" v-model="formData.notes" rows="2"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                            placeholder="Optional notes about this reference..."></textarea>
                    </div>

                    <!-- Error Message -->
                    <div v-if="submitError" class="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
                        {{ submitError }}
                    </div>

                    <!-- Submit Button -->
                    <div class="flex justify-end">
                        <button type="submit" :disabled="submitting || !rentSharesValid"
                            class="px-6 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-md disabled:opacity-50">
                            <span v-if="submitting">Creating Reference...</span>
                            <span v-else>Create Reference</span>
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import PhoneInput from '../components/PhoneInput.vue'
import DatePicker from '../components/DatePicker.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import { isValidEmail } from '../utils/validation'

const router = useRouter()
const authStore = useAuthStore()
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const tenantCount = ref(1)
const submitting = ref(false)
const submitError = ref<string | null>(null)
const showGuarantorFields = ref(false)

const tenants = ref<Array<{
    first_name: string
    last_name: string
    email: string
    phone: string
    rent_share: number | null
    guarantor?: {
        first_name: string
        last_name: string
        email: string
        phone: string
    } | null
    showGuarantorFields?: boolean
}>>([{
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    rent_share: null,
    guarantor: null,
    showGuarantorFields: false
}])

const formData = ref({
    tenant_first_name: '',
    tenant_last_name: '',
    tenant_email: '',
    tenant_phone: '',
    property_address: '',
    property_city: '',
    property_postcode: '',
    monthly_rent: null as number | null,
    move_in_date: '',
    term_years: 0,
    term_months: 0,
    notes: '',
    guarantor_first_name: '',
    guarantor_last_name: '',
    guarantor_email: '',
    guarantor_phone: ''
})

const totalRentShare = computed(() => {
    return tenants.value.reduce((sum, t) => sum + (Number(t.rent_share) || 0), 0)
})

const rentSharesValid = computed(() => {
    if (tenantCount.value === 1) return true
    const total = totalRentShare.value
    const monthlyRent = Number(formData.value.monthly_rent) || 0
    return Math.abs(total - monthlyRent) < 0.01 && monthlyRent > 0
})

const handlePropertyAddressSelected = (addressData: any) => {
    formData.value.property_address = addressData.addressLine1
    formData.value.property_city = addressData.city
    formData.value.property_postcode = addressData.postcode
}

const handleSubmit = async () => {
    submitting.value = true
    submitError.value = null

    try {
        const token = authStore.session?.access_token
        if (!token) {
            submitError.value = 'You must be logged in to create a reference'
            submitting.value = false
            return
        }

        // Validate move-in date is provided
        if (!formData.value.move_in_date) {
            submitError.value = 'Move-in date is required'
            submitting.value = false
            return
        }

        // Validate email addresses
        if (tenantCount.value === 1) {
            if (!isValidEmail(formData.value.tenant_email)) {
                submitError.value = 'Please enter a valid tenant email address'
                submitting.value = false
                return
            }
            if (formData.value.guarantor_email && !isValidEmail(formData.value.guarantor_email)) {
                submitError.value = 'Please enter a valid guarantor email address'
                submitting.value = false
                return
            }
        } else {
            // Validate all tenant emails
            for (let i = 0; i < tenants.value.length; i++) {
                const tenant = tenants.value[i]
                if (!isValidEmail(tenant?.email || '')) {
                    submitError.value = `Please enter a valid email address for tenant ${i + 1}`
                    submitting.value = false
                    return
                }
                if (tenant?.guarantor?.email && !isValidEmail(tenant.guarantor.email)) {
                    submitError.value = `Please enter a valid email address for guarantor of tenant ${i + 1}`
                    submitting.value = false
                    return
                }
            }
        }

        let payload: any

        if (tenantCount.value === 1) {
            // Single tenant flow
            payload = {
                ...formData.value
            }
        } else {
            // Multi-tenant flow
            if (!rentSharesValid.value) {
                submitError.value = 'Rent shares must sum to the total monthly rent'
                submitting.value = false
                return
            }

            payload = {
                tenants: tenants.value,
                property_address: formData.value.property_address,
                property_city: formData.value.property_city,
                property_postcode: formData.value.property_postcode,
                monthly_rent: formData.value.monthly_rent,
                move_in_date: formData.value.move_in_date,
                term_years: formData.value.term_years,
                term_months: formData.value.term_months,
                notes: formData.value.notes
            }
        }

        const response = await fetch(`${API_URL}/api/references`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || 'Failed to create reference')
        }

        const data = await response.json()

        // Extract token from response
        let referenceToken: string | null = null

        if (tenantCount.value === 1) {
            // Single tenant - token is in tenantUrl
            if (data.tenantUrl) {
                const urlParts = data.tenantUrl.split('/submit-reference/')
                if (urlParts.length > 1) {
                    referenceToken = urlParts[1]
                }
            }
        } else {
            // Multi-tenant - get token from childTokens array (first tenant)
            if (data.childTokens && data.childTokens.length > 0) {
                referenceToken = data.childTokens[0]
            }
        }

        if (referenceToken) {
            // Redirect to submit reference page
            router.push(`/submit-reference/${referenceToken}`)
        } else {
            // Fallback: redirect to references page
            router.push('/references')
        }
    } catch (error: any) {
        submitError.value = error.message || 'Failed to create reference'
    } finally {
        submitting.value = false
    }
}
</script>
