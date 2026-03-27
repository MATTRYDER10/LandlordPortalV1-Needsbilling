<template>
    <div class="min-h-screen bg-gray-50 dark:bg-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div class="max-w-4xl mx-auto">
            <!-- Header with Branding -->
            <div v-if="brandingLoaded" class="text-center mb-8">
                <div class="flex justify-center items-center gap-3 mb-4">
                    <template v-if="companyLogo">
                        <img :src="companyLogo" alt="Company Logo" class="h-20 object-contain" />
                    </template>
                    <template v-else>
                        <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-12 dark:hidden" />
                        <img src="/PropertyGooseLogoDark.png" alt="PropertyGoose" class="h-12 hidden dark:block" />
                    </template>
                </div>
                <h1 class="text-3xl font-bold" :style="{ color: primaryColor }">Tenant Offer Form</h1>
                <p class="mt-2 text-gray-600 dark:text-slate-400">Please complete all sections to submit your offer</p>
            </div>

            <!-- Loading State -->
            <div v-if="loading" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
                <div class="text-gray-600 dark:text-slate-400">Loading...</div>
            </div>

            <!-- Already Submitted State -->
            <div v-else-if="alreadySubmitted" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
                <CheckCircle2 class="mx-auto h-12 w-12 text-blue-500" />
                <h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Application Already Submitted</h3>
                <p class="mt-2 text-gray-600 dark:text-slate-400">You have already filled the form. We will mail you once the agent approves
                    or disapproves your application.</p>
            </div>

            <!-- Success State -->
            <div v-else-if="submitted" class="bg-white dark:bg-slate-800 rounded-lg shadow p-8 text-center">
                <CheckCircle2 class="mx-auto h-12 w-12 text-green-500" />
                <h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Offer Submitted Successfully!</h3>
                <p class="mt-2 text-gray-600 dark:text-slate-400">Your offer has been submitted and will be reviewed by the agent.</p>
            </div>

            <!-- Form -->
            <form v-else @submit.prevent="handleSubmit" class="space-y-6">
                <!-- Property Information -->
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
                    <div class="relative overflow-visible">
                        <AddressAutocomplete v-model="formData.property_address" label="Property Address *"
                            :required="true" id="property-address" placeholder="Start typing the property address..."
                            @addressSelected="handlePropertyAddressSelected" :allowManualEntry="true" />
                        <p v-if="formData.property_city || formData.property_postcode" class="mt-1.5 text-sm text-gray-600 dark:text-slate-400">
                            {{ [formData.property_city, formData.property_postcode].filter(Boolean).join(', ') }}
                        </p>
                    </div>
                    <input type="hidden" v-model="formData.property_city" />
                    <input type="hidden" v-model="formData.property_postcode" />
                </div>

                <!-- Offer Details -->
                <div class="bg-orange-500 rounded-lg shadow p-5">
                    <h2 class="text-lg font-semibold text-white mb-3">Offer Details</h2>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                            <label for="offered-rent" class="block text-xs font-medium text-white/80 mb-1">
                                Rent (£/month) *
                            </label>
                            <input id="offered-rent" v-model.number="formData.offered_rent_amount" type="number"
                                step="0.01" required min="0" :max="originalOfferRent || undefined"
                                class="block w-full px-3 py-2 border-0 rounded-md focus:ring-2 focus:ring-white/50 bg-white/90 text-gray-900 text-sm font-medium" />
                            <p v-if="originalOfferRent" class="mt-1 text-xs text-white/70">
                                Agent's offer: £{{ originalOfferRent }}/month
                            </p>
                        </div>
                        <div>
                            <label for="move-in-date" class="block text-xs font-medium text-white/80 mb-1">
                                Move-in Date *
                            </label>
                            <input id="move-in-date" v-model="formData.proposed_move_in_date" type="date" required
                                class="block w-full px-3 py-2 border-0 rounded-md focus:ring-2 focus:ring-white/50 bg-white/90 text-gray-900 text-sm font-medium" />
                        </div>
                        <div>
                            <label for="tenancy-length" class="block text-xs font-medium text-white/80 mb-1">
                                Term (months) *
                            </label>
                            <input id="tenancy-length" v-model.number="formData.proposed_tenancy_length_months"
                                type="number" required min="1" max="12"
                                class="block w-full px-3 py-2 border-0 rounded-md focus:ring-2 focus:ring-white/50 bg-white/90 text-gray-900 text-sm font-medium" />
                            <p class="mt-1 text-xs text-white/70">1-12 months</p>
                        </div>
                    </div>
                </div>

                <!-- Special Conditions -->
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-5">
                    <label for="special-conditions" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Special Conditions for Landlord to Consider
                    </label>
                    <textarea id="special-conditions" v-model="formData.special_conditions" rows="3"
                        placeholder="Any special conditions or requests..."
                        class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white text-sm"></textarea>
                </div>

                <!-- Tenants -->
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <div class="mb-4">
                        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Tenants</h2>
                    </div>

                    <div v-for="(tenant, index) in formData.tenants" :key="index"
                        class="mb-6 p-4 border border-gray-200 dark:border-slate-700 rounded-lg overflow-visible">
                        <div class="flex justify-between items-center mb-3">
                            <h3 class="text-lg font-medium text-gray-900 dark:text-white">Tenant {{ index + 1 }}</h3>
                            <button v-if="formData.tenants.length > 1" type="button" @click="removeTenant(index)"
                                class="text-sm text-red-600 hover:text-red-700">
                                Remove
                            </button>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label :for="`tenant-${index}-name`"
                                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                                    Full Name *
                                </label>
                                <input :id="`tenant-${index}-name`" v-model="tenant.name" type="text" required
                                    class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white" />
                            </div>
                            <div class="relative overflow-visible">
                                <AddressAutocomplete v-model="tenant.address" :label="`Current Address`"
                                    :required="true" :id="`tenant-${index}-address`"
                                    placeholder="Start typing your address..."
                                    @addressSelected="(address) => handleTenantAddressSelected(index, address)"
                                    :allowManualEntry="true" />
                                <p v-if="tenant.address_city || tenant.address_postcode" class="mt-1 text-sm text-gray-600 dark:text-slate-400">
                                    {{ [tenant.address_city, tenant.address_postcode].filter(Boolean).join(', ') }}
                                </p>
                            </div>
                            <div>
                                <PhoneInput v-model="tenant.phone" :label="`Phone Number`" :id="`tenant-${index}-phone`"
                                    :required="true" />
                            </div>
                            <div>
                                <label :for="`tenant-${index}-email`"
                                    class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                                    Email Address *
                                </label>
                                <input :id="`tenant-${index}-email`" v-model="tenant.email" type="email" required
                                    class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white" />
                            </div>

                            <!-- Student / Guarantor options -->
                            <div class="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <label :for="`tenant-${index}-student`"
                                    class="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                                    :class="tenant.is_student
                                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-500'
                                        : 'border-gray-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-600'">
                                    <input :id="`tenant-${index}-student`" v-model="tenant.is_student"
                                        type="checkbox"
                                        class="h-5 w-5 rounded border-gray-300 dark:border-slate-600 text-orange-500 focus:ring-orange-500 dark:bg-slate-900 shrink-0" />
                                    <span class="text-sm font-medium text-gray-700 dark:text-slate-300">I am a student</span>
                                </label>

                                <label :for="`tenant-${index}-guarantor`"
                                    class="flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all"
                                    :class="tenant.has_guarantor
                                        ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-500'
                                        : 'border-gray-200 dark:border-slate-700 hover:border-orange-300 dark:hover:border-orange-600'">
                                    <input :id="`tenant-${index}-guarantor`" v-model="tenant.has_guarantor"
                                        type="checkbox"
                                        class="h-5 w-5 rounded border-gray-300 dark:border-slate-600 text-orange-500 focus:ring-orange-500 dark:bg-slate-900 shrink-0" />
                                    <span class="text-sm font-medium text-gray-700 dark:text-slate-300">I have a guarantor</span>
                                </label>
                            </div>

                            <!-- Income fields (hidden for students) -->
                            <template v-if="!tenant.is_student">
                                <div>
                                    <label :for="`tenant-${index}-income`"
                                        class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                                        Yearly Income (£) *
                                    </label>
                                    <input :id="`tenant-${index}-income`" v-model="tenant.annual_income" type="text"
                                        placeholder="e.g., 30000"
                                        class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white" />
                                </div>
                                <div>
                                    <label :for="`tenant-${index}-job-title`"
                                        class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                                        Job Title / Income Source
                                    </label>
                                    <input :id="`tenant-${index}-job-title`" v-model="tenant.job_title" type="text"
                                        placeholder="e.g., Software Engineer, Self-Employed, etc."
                                        class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white" />
                                </div>
                            </template>

                            <!-- No CCJs Declaration - full width at bottom -->
                            <div class="md:col-span-2">
                                <label :for="`tenant-${index}-no-ccj`"
                                    class="flex items-center gap-3 w-full p-4 rounded-lg cursor-pointer transition-all"
                                    :class="tenant.no_ccj_bankruptcy_iva
                                        ? 'bg-orange-500 shadow-md'
                                        : 'bg-orange-400 hover:bg-orange-500 shadow-sm hover:shadow-md'">
                                    <input :id="`tenant-${index}-no-ccj`" v-model="tenant.no_ccj_bankruptcy_iva"
                                        type="checkbox" required
                                        class="h-5 w-5 rounded border-white/50 text-orange-700 focus:ring-white bg-white/20 shrink-0" />
                                    <div>
                                        <span class="text-sm font-semibold text-white">I confirm I have no CCJs, Bankruptcies or IVAs *</span>
                                    </div>
                                </label>
                                <button type="button" @click="tenant.showCcjHelp = !tenant.showCcjHelp" class="mt-1.5 text-xs text-gray-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 underline underline-offset-2">
                                    What does this mean?
                                </button>
                                <div v-if="tenant.showCcjHelp" class="mt-2 p-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-600 dark:text-slate-400 space-y-1.5">
                                    <p><strong>CCJ (County Court Judgment)</strong> — A court order that can be registered against you if you fail to repay money you owe. CCJs stay on your credit file for 6 years.</p>
                                    <p><strong>Bankruptcy</strong> — A legal process where your assets may be used to pay off debts you cannot afford. It severely impacts your ability to rent.</p>
                                    <p><strong>IVA (Individual Voluntary Arrangement)</strong> — A formal agreement with your creditors to pay back debts over a set period, usually 5-6 years.</p>
                                    <p class="pt-1 text-gray-500 dark:text-slate-500">If any of these apply to you, please speak to your letting agent before submitting this form.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Add Tenant section at the bottom -->
                    <div class="mt-4 p-4 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg text-center">
                        <p class="text-sm text-gray-600 dark:text-slate-400 mb-3">
                            Will anyone else aged 18 or over be living at the property? Add them here so we have everyone's details.
                        </p>
                        <button type="button" @click="addTenant"
                            class="px-6 py-2 text-sm font-medium text-white rounded-md hover:opacity-90"
                            :style="{ backgroundColor: buttonColor }">
                            + Add Another Tenant
                        </button>
                    </div>
                </div>

            <!-- Deposit Replacement Service (Reposit) -->
            <div v-if="depositReplacementOffered" class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                <!-- Reposit Header -->
                <div class="bg-white dark:bg-slate-800 px-6 py-4 border-b border-gray-200 dark:border-slate-600">
                    <div class="flex items-center gap-3">
                        <img src="/reposit-logo.png" alt="Reposit" class="h-7 w-auto" />
                        <span class="text-sm text-gray-500 dark:text-slate-400">Deposit Alternative</span>
                    </div>
                </div>

                <div class="p-6">
                    <!-- Savings Banner -->
                    <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 mb-5">
                        <p class="text-emerald-800 dark:text-emerald-300 font-semibold">
                            Save money on your upfront move-in costs
                        </p>
                        <p class="text-sm text-emerald-700 dark:text-emerald-400 mt-1">
                            Pay around one week's rent instead of a 5-week deposit
                        </p>
                    </div>

                    <!-- What is Reposit -->
                    <div class="mb-5">
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">What is Reposit?</h3>
                        <ul class="space-y-2 text-sm text-gray-600 dark:text-slate-400">
                            <li class="flex items-start gap-2">
                                <span class="text-blue-500 mt-0.5">•</span>
                                <span>Reposit is a <strong>no deposit</strong> option - pay a small fee instead of a large cash deposit</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="text-blue-500 mt-0.5">•</span>
                                <span>The fee is <strong>non-refundable</strong> but significantly lower than a traditional deposit</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="text-blue-500 mt-0.5">•</span>
                                <span>You remain responsible for any damages or unpaid rent at the end of your tenancy</span>
                            </li>
                            <li class="flex items-start gap-2">
                                <span class="text-blue-500 mt-0.5">•</span>
                                <span>Subject to eligibility - we'll confirm during the referencing process</span>
                            </li>
                        </ul>
                    </div>

                    <!-- Opt-in Checkbox -->
                    <div class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                        <div class="flex items-start gap-3">
                            <input
                                id="deposit-replacement-opt-in"
                                v-model="formData.deposit_replacement_requested"
                                type="checkbox"
                                class="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded dark:bg-slate-900"
                            />
                            <label for="deposit-replacement-opt-in" class="text-sm text-gray-700 dark:text-slate-300">
                                <span class="font-medium">Yes, I'm interested in using Reposit</span>
                                <p class="text-gray-500 dark:text-slate-400 mt-1">
                                    We'll review your eligibility during referencing and confirm the exact fee with you.
                                </p>
                            </label>
                        </div>
                    </div>

                    <!-- Learn More Link -->
                    <div class="mt-4 text-center">
                        <a
                            href="https://reposit.co.uk/tenants/"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                        >
                            Learn more about Reposit →
                        </a>
                    </div>
                </div>
            </div>

            <!-- UniHomes All-Inclusive Bills -->
            <div v-if="unihomesOffered" class="bg-white dark:bg-slate-800 rounded-lg shadow overflow-hidden">
                <div class="bg-white dark:bg-slate-800 px-6 py-4 border-b border-gray-200 dark:border-slate-600">
                    <div class="flex items-center gap-3">
                        <span class="text-xl">⚡</span>
                        <div>
                            <span class="font-semibold text-gray-900 dark:text-white">UniHomes</span>
                            <span class="text-sm text-gray-500 dark:text-slate-400 ml-2">All-Inclusive Bills</span>
                        </div>
                    </div>
                </div>

                <div class="p-6">
                    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-5">
                        <p class="text-blue-800 dark:text-blue-300 font-semibold">
                            One simple payment covers all your bills
                        </p>
                        <p class="text-sm text-blue-700 dark:text-blue-400 mt-1">
                            Electric, gas, water, broadband, TV licence — all included at a fixed weekly price per person.
                        </p>
                    </div>

                    <!-- Pricing Table -->
                    <div class="mb-5">
                        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Pricing (per person per week)</h3>
                        <div class="grid grid-cols-5 gap-2 text-center text-sm">
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">1</div><div class="text-gray-500">£66</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">2</div><div class="text-gray-500">£38</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">3</div><div class="text-gray-500">£30</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">4</div><div class="text-gray-500">£26</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">5</div><div class="text-gray-500">£24</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">6</div><div class="text-gray-500">£22</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">7</div><div class="text-gray-500">£21</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">8</div><div class="text-gray-500">£20</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">9</div><div class="text-gray-500">£19</div></div>
                            <div class="p-2 bg-gray-50 dark:bg-slate-700 rounded"><div class="font-semibold">10</div><div class="text-gray-500">£18</div></div>
                        </div>
                        <p class="text-xs text-gray-400 mt-2 text-center">Number of people / price per person per week</p>
                    </div>

                    <!-- Opt-in Checkbox -->
                    <div class="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-4">
                        <div class="flex items-start gap-3">
                            <input
                                id="unihomes-opt-in"
                                v-model="formData.unihomes_interested"
                                type="checkbox"
                                class="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-slate-600 rounded dark:bg-slate-900"
                            />
                            <label for="unihomes-opt-in" class="text-sm text-gray-700 dark:text-slate-300">
                                <span class="font-medium">Yes, I want UniHomes all-inclusive bills</span>
                                <p class="text-gray-500 dark:text-slate-400 mt-1">
                                    We'll set up your bills package before your move-in date.
                                </p>
                            </label>
                        </div>
                    </div>
                </div>
            </div>

                <!-- Terms and Conditions -->
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Holding Deposit Agreement</h2>
                    <div class="space-y-4 text-sm text-gray-700 dark:text-slate-300 mb-4">
                        <div>
                            <p class="font-semibold mb-2">Deposit Amount:</p>
                            <p>A holding deposit equivalent to <strong>one week's rent</strong> is payable upon
                                acceptance of your application. This sum will be deducted from your initial tenancy
                                deposit at the start of the tenancy.</p>
                        </div>
                        <div>
                            <p class="font-semibold mb-2">Privacy Policy Agreement:</p>
                            <p>By paying the holding deposit, you agree to our Privacy Policy
                                (rgproperty.co.uk/privacypolicy).</p>
                        </div>
                        <div>
                            <p class="font-semibold mb-2">Non-Refundable Clause:</p>
                            <p>Please note: the holding deposit is <strong>non-refundable</strong> in the following
                                circumstances:</p>
                            <ol class="list-decimal list-inside mt-2 space-y-1 ml-4">
                                <li>You provide false or misleading information during the application process,
                                    resulting in a failed reference.</li>
                                <li>You withdraw from the tenancy application voluntarily.</li>
                                <li>You fail to provide satisfactory Right to Rent documentation as required by law.
                                </li>
                                <li>You do not engage in reasonable communication with us and/or fail to take the
                                    necessary steps to progress and enter into the tenancy.</li>
                            </ol>
                        </div>
                        <div>
                            <p class="font-semibold mb-2">Refund Clause:</p>
                            <p>If the landlord or agent decides not to proceed with the tenancy for reasons other than
                                those listed above, the holding deposit will be refunded in full.</p>
                        </div>
                    </div>
                    <div class="flex items-start">
                        <input id="terms-agreement" v-model="formData.terms_agreed" type="checkbox" required
                            class="mt-1 h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-slate-600 rounded dark:bg-slate-900" />
                        <label for="terms-agreement" class="ml-2 block text-sm text-gray-700 dark:text-slate-300">
                            I agree to the terms and conditions *
                        </label>
                    </div>
                </div>

                <!-- Declaration and Signature -->
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
                    <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Declaration</h2>
                    <div class="bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 rounded-lg p-4 mb-4">
                        <p class="text-sm text-gray-700 dark:text-slate-300">
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
                            <label for="signature-name" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                                Full Name (as signature) *
                            </label>
                            <input id="signature-name" v-model="formData.signature_name" type="text" required
                                class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary dark:bg-slate-900 dark:text-white" />
                        </div>

                        <SignaturePad v-model="formData.signature" label="Signature" />
                    </div>
                </div>

                <!-- Error Message -->
                <div v-if="submitError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-6 py-4 rounded-lg">
                    {{ submitError }}
                </div>

                <!-- Submit Button -->
                <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
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
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute } from 'vue-router'
import SignaturePad from '../components/SignaturePad.vue'
import PhoneInput from '../components/PhoneInput.vue'
import AddressAutocomplete from '../components/AddressAutocomplete.vue'
import { isValidEmail } from '../utils/validation'
import { defaultBranding } from '../config/colors'
import { CheckCircle2 } from 'lucide-vue-next'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const route = useRoute()
const loading = ref(false)
const submitted = ref(false)
const alreadySubmitted = ref(false)
const submitting = ref(false)
const submitError = ref('')
const brandingLoaded = ref(false)

// Company branding
const companyLogo = ref('')
const primaryColor = ref(defaultBranding.primaryColor)
const buttonColor = ref(defaultBranding.buttonColor)

// Store original offer terms from agent (query params)
const originalOfferRent = ref<number | null>(null)

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
            address_line2: '',
            address_city: '',
            address_county: '',
            address_postcode: '',
            address_country: '',
            phone: '',
            email: '',
            annual_income: '',
            job_title: '',
            is_student: false,
            has_guarantor: false,
            no_ccj_bankruptcy_iva: false,
            showCcjHelp: false
        }
    ],
    signature: '',
    signature_name: '',
    terms_agreed: false,
    deposit_replacement_requested: false,
    unihomes_interested: false
})

const parseBooleanQueryParam = (value: string | string[] | undefined): boolean => {
    if (Array.isArray(value)) {
        return value.some(item => parseBooleanQueryParam(item))
    }
    if (typeof value !== 'string') {
        return false
    }
    const normalized = value.toLowerCase()
    return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const depositReplacementOffered = computed(() =>
    parseBooleanQueryParam(route.query.deposit_replacement_offered as string | string[] | undefined)
)

const unihomesOffered = computed(() =>
    parseBooleanQueryParam(route.query.unihomes as string | string[] | undefined)
)

const isV2Offer = computed(() =>
    parseBooleanQueryParam(route.query.v2 as string | string[] | undefined)
)

const addTenant = () => {
    formData.value.tenants.push({
        name: '',
        address: '',
        address_line2: '',
        address_city: '',
        address_county: '',
        address_postcode: '',
        address_country: '',
        phone: '',
        email: '',
        annual_income: '',
        job_title: '',
        is_student: false,
        has_guarantor: false,
        no_ccj_bankruptcy_iva: false,
        showCcjHelp: false
    })
}

const removeTenant = (index: number) => {
    if (formData.value.tenants.length > 1) {
        formData.value.tenants.splice(index, 1)
    }
}

const handlePropertyAddressSelected = (addressData: any) => {
    formData.value.property_address = addressData.addressLine1
    formData.value.property_city = addressData.city
    formData.value.property_postcode = addressData.postcode
}

const handleTenantAddressSelected = (index: number, addressData: any) => {
    const tenant = formData.value.tenants[index]
    if (tenant) {
        tenant.address = addressData.addressLine1 || ''
        tenant.address_line2 = addressData.addressLine2 || ''
        tenant.address_city = addressData.city || ''
        tenant.address_county = addressData.county || ''
        tenant.address_postcode = addressData.postcode || ''
        tenant.address_country = addressData.country || 'United Kingdom'
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

        // Validate rent is not higher than original offer (can only go down)
        if (originalOfferRent.value && formData.value.offered_rent_amount > originalOfferRent.value) {
            throw new Error(`Offered rent cannot exceed the original offer of £${originalOfferRent.value}`)
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
            if (!tenant?.name || !tenant.address || !tenant.phone || !tenant.email) {
                const missing = []
                if (!tenant?.name) missing.push('name')
                if (!tenant?.address) missing.push('address')
                if (!tenant?.phone) missing.push('phone')
                if (!tenant?.email) missing.push('email')
                throw new Error(`Tenant ${i + 1} is missing: ${missing.join(', ')}`)
            }
            if (!tenant.is_student && !tenant.annual_income) {
                throw new Error(`Tenant ${i + 1}: please provide yearly income or tick "I am a student"`)
            }
            if (!isValidEmail(tenant.email)) {
                throw new Error(`Please enter a valid email address for tenant ${i + 1}`)
            }
            if (!tenant.no_ccj_bankruptcy_iva) {
                throw new Error(`Tenant ${i + 1} must confirm they have no CCJs, Bankruptcies or IVAs`)
            }
        }

        if (!formData.value.signature || !formData.value.signature_name) {
            throw new Error('Signature and signature name are required')
        }

        if (!formData.value.terms_agreed) {
            throw new Error('You must agree to the terms and conditions')
        }

        // Get company ID and form_ref from query parameters
        const companyId = route.query.company_id as string
        const formRef = route.query.form_ref as string
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
                annual_income: tenant.is_student ? 'Student' : tenant.annual_income,
                job_title: tenant.is_student ? 'Student' : (tenant.job_title || null),
                is_student: tenant.is_student || false,
                has_guarantor: tenant.has_guarantor || false,
                no_ccj_bankruptcy_iva: tenant.no_ccj_bankruptcy_iva,
                signature: formData.value.signature,
                signature_name: formData.value.signature_name
            })),
            deposit_replacement_offered: depositReplacementOffered.value,
            deposit_replacement_requested: depositReplacementOffered.value ? formData.value.deposit_replacement_requested : false,
            unihomes_offered: unihomesOffered.value,
            unihomes_interested: unihomesOffered.value ? formData.value.unihomes_interested : false,
            is_v2: isV2Offer.value,
            form_ref: formRef || undefined
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

// Check if this specific offer form has already been submitted
const checkExistingSubmission = async () => {
    try {
        const formRef = route.query.form_ref as string

        // Skip check if URL has skip_check=1 (for testing)
        if (route.query.skip_check === '1') {
            console.log('[TenantOffer] Skipping submission check (skip_check=1)')
            return
        }

        // If we have a form_ref, check if this specific form was already submitted
        if (formRef) {
            console.log('[TenantOffer] Checking form_ref:', formRef)
            const response = await fetch(`${API_URL}/api/tenant-offers/check-submission?form_ref=${encodeURIComponent(formRef)}`)
            if (response.ok) {
                const data = await response.json()
                console.log('[TenantOffer] Form ref check response:', data)
                if (data.submitted) {
                    console.log('[TenantOffer] This form was already submitted')
                    alreadySubmitted.value = true
                    return
                }
            }
        } else {
            console.log('[TenantOffer] No form_ref in URL (legacy link)')
        }
    } catch (error) {
        console.error('Failed to check existing submission:', error)
        // Don't block the form if check fails
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

        // Pre-populate form data from query parameters
        const propertyAddress = route.query.property_address as string
        const propertyCity = route.query.property_city as string
        const propertyPostcode = route.query.property_postcode as string
        const rentAmount = route.query.rent_amount as string
        const moveInDate = route.query.move_in_date as string

        if (propertyAddress) {
            formData.value.property_address = decodeURIComponent(propertyAddress)
        }
        if (propertyCity) {
            formData.value.property_city = decodeURIComponent(propertyCity)
        }
        if (propertyPostcode) {
            formData.value.property_postcode = decodeURIComponent(propertyPostcode)
        }
        if (rentAmount) {
            const rent = parseFloat(rentAmount)
            if (!isNaN(rent)) {
                formData.value.offered_rent_amount = rent
                originalOfferRent.value = rent // Store original for validation
            }
        }
        if (moveInDate) {
            formData.value.proposed_move_in_date = decodeURIComponent(moveInDate)
        }

        // Check for existing submission first
        await checkExistingSubmission()

        // Load branding from company
        const response = await fetch(`${API_URL}/api/company/branding/${companyId}`)
        if (response.ok) {
            const data = await response.json()
            if (data.branding) {
                companyLogo.value = data.branding.logo_url || ''
                primaryColor.value = data.branding.primary_color || defaultBranding.primaryColor
                buttonColor.value = data.branding.button_color || defaultBranding.buttonColor
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
