<template>
  <Sidebar>
    <div class="p-8">
      <div v-if="loading" class="flex justify-center items-center h-64">
        <div class="text-gray-600 dark:text-slate-400">Loading offer...</div>
      </div>

      <div v-else-if="error" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded">
        {{ error }}
      </div>

      <div v-else-if="offer" class="space-y-6">
        <!-- Header -->
        <div class="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
          <div>
            <button @click="$router.push('/tenant-offers')"
              class="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-4 flex items-center">
              <ArrowLeft class="w-5 h-5 mr-2" />
              Back to Tenant Offers
            </button>
            <h2 class="text-3xl font-bold text-gray-900 dark:text-white">{{ offer.property_address }}</h2>
            <p class="mt-2 text-gray-600 dark:text-slate-400">Tenant Offer Details</p>
          </div>
          <div class="flex flex-col items-start md:items-end gap-2">
            <span class="px-3 py-1 text-sm font-semibold rounded-full flex items-center gap-2"
              :class="statusBadgeClass">
              <span>{{ statusDisplay }}</span>
              <Check v-if="showStatusTick" class="w-4 h-4 text-green-600" />
            </span>
            <!-- Landlord Decision Tag -->
            <span v-if="offer.landlord_decision === 'approved'"
              class="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1">
              Landlord Approved
              <span v-if="offer.status === 'pending' || offer.status === 'accepted_with_changes'" class="text-green-600/70 dark:text-green-400/70 text-xs">(tenant not informed yet)</span>
            </span>
            <span v-else-if="offer.landlord_decision === 'declined'"
              class="px-3 py-1 text-sm font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 flex items-center gap-1">
              Landlord Declined
              <span v-if="offer.status === 'pending' || offer.status === 'accepted_with_changes'" class="text-red-600/70 dark:text-red-400/70 text-xs">(tenant not informed yet)</span>
            </span>
            <span v-else-if="offer.landlord_sent_at && !offer.landlord_decision"
              class="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Sent to Landlord
            </span>
            <span v-if="offer.deposit_replacement_requested"
              class="px-3 py-1 text-sm font-semibold rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 whitespace-nowrap flex items-center gap-1.5">
              <span class="font-bold">Rep<span class="text-blue-500">o</span>sit</span> Selected
            </span>
            <button @click="confirmDelete"
              class="mt-2 px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md"
              :disabled="processing">
              Delete Offer
            </button>
          </div>
        </div>

        <!-- Action Buttons -->
        <div v-if="offer.status === 'pending' || offer.status === 'accepted_with_changes'"
          class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div class="flex gap-3">
            <button @click="showApproveModal = true"
              class="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700">
              Approve Offer
            </button>
            <button @click="showDeclineModal = true"
              class="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700">
              Decline Offer
            </button>
            <button @click="showEditModal = true"
              class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
              Accept with Changes
            </button>
          </div>
        </div>

        <div v-if="offer.status === 'approved' && !offer.holding_deposit_received"
          class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <button @click="markHoldingDepositReceived" :disabled="processing"
            class="w-full px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50">
            {{ processing ? 'Processing...' : 'Holding Deposit Received - Send References' }}
          </button>
        </div>

        <!-- Notes Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Notes</h3>

          <!-- Add Note Form -->
          <div class="mb-4">
            <textarea v-model="newNote" rows="3" placeholder="Add a note..."
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white"></textarea>
            <button @click="addNote" :disabled="!newNote.trim() || addingNote"
              class="mt-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50">
              {{ addingNote ? 'Adding...' : 'Add Note' }}
            </button>
          </div>

          <!-- Notes List -->
          <div v-if="notes.length === 0" class="text-sm text-gray-500 dark:text-slate-400 italic">
            No notes yet.
          </div>
          <div v-else class="space-y-3">
            <div v-for="note in notes" :key="note.id" class="border border-gray-200 dark:border-slate-700 rounded-lg p-3">
              <div class="flex justify-between items-start">
                <div class="flex-1">
                  <div v-if="editingNoteId === note.id">
                    <textarea v-model="editNoteText" rows="2"
                      class="block w-full px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-md text-sm focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white"></textarea>
                    <div class="mt-2 flex gap-2">
                      <button @click="saveNoteEdit(note.id)" :disabled="!editNoteText.trim()"
                        class="px-3 py-1 text-xs bg-primary text-white rounded-md hover:bg-primary/90">Save</button>
                      <button @click="cancelNoteEdit"
                        class="px-3 py-1 text-xs bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-400 dark:hover:bg-slate-500">Cancel</button>
                    </div>
                  </div>
                  <p v-else class="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{{ note.note }}</p>
                </div>
                <div v-if="!editingNoteId && note.created_by === authStore.user?.id" class="ml-2 flex gap-1">
                  <button @click="startEditNote(note)" class="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button @click="deleteNote(note.id)" class="text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div class="mt-2 text-xs text-gray-500 dark:text-slate-400">
                {{ note.created_by_user?.email || 'Unknown' }} - {{ formatDate(note.created_at) }}
                <span v-if="note.updated_at !== note.created_at" class="italic">(edited)</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Email History Section -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-semibold text-gray-900 dark:text-white">Email History</h3>
            <div v-if="offer.status === 'approved' || offer.status === 'declined'" class="flex gap-2">
              <button v-if="offer.status === 'approved'" @click="resendEmail('approval')" :disabled="resendingEmail"
                class="px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-md disabled:opacity-50">
                {{ resendingEmail ? 'Sending...' : 'Resend Approval Email' }}
              </button>
              <button v-if="offer.status === 'declined'" @click="resendEmail('decline')" :disabled="resendingEmail"
                class="px-3 py-1 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md disabled:opacity-50">
                {{ resendingEmail ? 'Sending...' : 'Resend Decline Email' }}
              </button>
            </div>
          </div>

          <div v-if="auditLog.length === 0" class="text-sm text-gray-500 dark:text-slate-400 italic">
            No email history yet.
          </div>
          <div v-else class="space-y-2">
            <div v-for="entry in emailAuditEntries" :key="entry.id"
              class="flex items-start gap-3 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
              <div class="flex-shrink-0 mt-1">
                <span v-if="entry.action.includes('EMAIL')" class="w-2 h-2 rounded-full inline-block"
                  :class="entry.action.includes('APPROVAL') ? 'bg-green-500' : entry.action.includes('DECLINE') ? 'bg-red-500' : 'bg-blue-500'"></span>
                <span v-else class="w-2 h-2 rounded-full inline-block bg-gray-400"></span>
              </div>
              <div class="flex-1">
                <p class="text-sm text-gray-900 dark:text-white">{{ entry.description }}</p>
                <p class="text-xs text-gray-500 dark:text-slate-400">
                  {{ entry.created_by_user?.email || 'System' }} - {{ formatDate(entry.created_at) }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Offer Details -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Offer Details</h3>
          <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Property Address</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ offer.property_address }}</dd>
            </div>
            <div v-if="offer.property_city">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">City</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ offer.property_city }}</dd>
            </div>
            <div v-if="offer.property_postcode">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Postcode</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ offer.property_postcode }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Offered Rent Amount</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">£{{ offer.offered_rent_amount }} per month</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Proposed Move-in Date</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(offer.proposed_move_in_date) }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Proposed Tenancy Length</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ offer.proposed_tenancy_length_months }} months</dd>
            </div>
            <div v-if="offer.deposit_amount">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Deposit Amount</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">£{{ offer.deposit_amount }}</dd>
            </div>
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Holding Deposit Amount</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">£{{ holdingDepositAmount.toFixed(2) }} (one week's rent)</dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Deposit Replacement Service</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                <span v-if="!offer.deposit_replacement_offered" class="text-gray-500 dark:text-slate-400">
                  Not offered
                </span>
                <span v-else-if="offer.deposit_replacement_requested" class="text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1">
                  <span class="font-bold">Rep<span class="text-blue-500">o</span>sit</span> Selected
                </span>
                <span v-else class="text-gray-600 dark:text-slate-400">Offered but not selected</span>
              </dd>
            </div>
            <div v-if="offer.holding_deposit_amount_paid">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Holding Deposit Paid</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">£{{ formatCurrency(offer.holding_deposit_amount_paid) }}</dd>
            </div>
            <div v-if="offer.special_conditions" class="sm:col-span-2">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Special Conditions</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{{ offer.special_conditions }}</dd>
            </div>
            <div v-if="offer.declined_reason" class="sm:col-span-2">
              <dt class="text-sm font-medium text-red-500 dark:text-red-400">Decline Reason</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ offer.declined_reason }}</dd>
            </div>
          </dl>
        </div>

        <!-- Tenants -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Tenants</h3>
          <div class="space-y-4">
            <div v-for="(tenant, index) in offer.tenants" :key="index" class="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
              <h4 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Tenant {{ index + 1 }}</h4>
              <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Name</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ tenant.name }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Email</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ tenant.email }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Phone</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ tenant.phone }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Address</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ tenant.address }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Annual Income</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">£{{ tenant.annual_income }}</dd>
                </div>
                <div v-if="tenant.job_title">
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Job Title</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ tenant.job_title }}</dd>
                </div>
                <div>
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">No CCJ/Bankruptcy/IVA</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">
                    <span :class="tenant.no_ccj_bankruptcy_iva ? 'text-green-600' : 'text-red-600'">
                      {{ tenant.no_ccj_bankruptcy_iva ? 'Confirmed' : 'Not Confirmed' }}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <!-- Timestamps -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Timeline</h3>
          <dl class="space-y-2">
            <div>
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Submitted</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(offer.created_at) }}</dd>
            </div>
            <div v-if="offer.approved_at">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Approved</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(offer.approved_at) }}</dd>
            </div>
            <div v-if="offer.declined_at">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Declined</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(offer.declined_at) }}</dd>
            </div>
            <div v-if="offer.holding_deposit_received_at">
              <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Holding Deposit Received</dt>
              <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(offer.holding_deposit_received_at) }}</dd>
            </div>
          </dl>
        </div>

        <!-- Terms & Conditions and Signatures -->
        <div class="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Terms & Conditions Agreement</h3>

          <!-- Holding Deposit Agreement -->
          <div class="mb-6">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Holding Deposit Agreement</h4>
            <div class="space-y-4 text-sm text-gray-700 dark:text-slate-300">
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
                  <li>You fail to provide satisfactory Right to Rent documentation as required by law.</li>
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
          </div>

          <!-- Declaration -->
          <div class="mb-6">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Declaration</h4>
            <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p class="text-sm text-gray-700 dark:text-slate-300">
                I agree that Propertygoose Ltd will use the information I provide on this application form
                and any information acquired from relevant sources to process my application for tenancy/to become a
                Guarantor for a tenancy. I understand that this application and the results of the findings will be
                forwarded to the instructing letting agent and/or landlord and that this information may be accessed
                again in the future should I default on my rental payments or payments due as a Guarantor, apply for a
                new tenancy or if there is a complaint or legal challenge with significance to this process.
              </p>
            </div>
          </div>

          <!-- Tenant Signatures -->
          <div class="space-y-6">
            <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Tenant Signatures</h4>
            <div v-for="(tenant, index) in offer.tenants" :key="index" class="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
              <h5 class="text-md font-medium text-gray-900 dark:text-white mb-3">Tenant {{ index + 1 }}: {{ tenant.name }}</h5>
              <dl class="space-y-3">
                <div v-if="tenant.signature_name">
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Signature Name</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ tenant.signature_name }}</dd>
                </div>
                <div v-if="tenant.signature">
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400 mb-2">Signature</dt>
                  <dd class="mt-1">
                    <img :src="tenant.signature" alt="Signature"
                      class="border border-gray-300 dark:border-slate-600 rounded bg-white p-2 max-w-md" style="max-height: 150px;" />
                  </dd>
                </div>
                <div v-if="tenant.signed_at">
                  <dt class="text-sm font-medium text-gray-500 dark:text-slate-400">Signed At</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white">{{ formatDate(tenant.signed_at) }}</dd>
                </div>
                <div v-if="!tenant.signature && !tenant.signature_name" class="text-sm text-gray-500 dark:text-slate-400 italic">
                  No signature provided
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Approve Modal -->
      <div v-if="showApproveModal" class="fixed inset-0 bg-gray-600 dark:bg-slate-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50"
        @click.self="showApproveModal = false">
        <div class="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-96 shadow-lg rounded-md bg-white dark:bg-slate-800">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Approve Offer</h3>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
            This will send an email to the tenant(s) with bank details and request for holding deposit payment.
          </p>
          <div class="flex gap-3">
            <button @click="approveOffer" :disabled="processing"
              class="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50">
              {{ processing ? 'Processing...' : 'Confirm Approve' }}
            </button>
            <button @click="showApproveModal = false"
              class="flex-1 px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-gray-400 dark:hover:bg-slate-500">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Decline Modal -->
      <div v-if="showDeclineModal" class="fixed inset-0 bg-gray-600 dark:bg-slate-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50"
        @click.self="showDeclineModal = false">
        <div class="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-96 shadow-lg rounded-md bg-white dark:bg-slate-800">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Decline Offer</h3>
          <div class="mb-4">
            <label for="decline-reason" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Reason for Decline *
            </label>
            <textarea id="decline-reason" v-model="declineReason" rows="4" required
              placeholder="Enter reason for declining this offer..."
              class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white"></textarea>
          </div>
          <div class="flex gap-3">
            <button @click="declineOffer" :disabled="processing || !declineReason"
              class="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50">
              {{ processing ? 'Processing...' : 'Confirm Decline' }}
            </button>
            <button @click="showDeclineModal = false"
              class="flex-1 px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-gray-400 dark:hover:bg-slate-500">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Edit Modal (Accept with Changes) -->
      <div v-if="showEditModal" class="fixed inset-0 bg-gray-600 dark:bg-slate-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50"
        @click.self="showEditModal = false">
        <div
          class="relative top-10 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-full max-w-2xl shadow-lg rounded-md bg-white dark:bg-slate-800 max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Accept with Changes</h3>
          <p class="text-sm text-gray-600 dark:text-slate-400 mb-1">Edit the offer details before accepting.</p>
          <p class="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2 mt-2">
            Please ensure these changes have been agreed with the tenant(s). After saving, you'll be asked if you want
            to send them an email with the updated terms and bank details.
          </p>

          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Property Address *</label>
              <input v-model="editForm.property_address" type="text" required
                class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">City</label>
                <input v-model="editForm.property_city" type="text"
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Postcode</label>
                <input v-model="editForm.property_postcode" type="text"
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Offered Rent (£) *</label>
                <input v-model.number="editForm.offered_rent_amount" type="number" step="0.01" required
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Move-in Date *</label>
                <input v-model="editForm.proposed_move_in_date" type="date" required
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Tenancy Length (months) *</label>
                <input v-model.number="editForm.proposed_tenancy_length_months" type="number" min="1" max="12" required
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Deposit Amount (£)</label>
                <input v-model.number="editForm.deposit_amount" type="number" step="0.01"
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Special Conditions</label>
              <textarea v-model="editForm.special_conditions" rows="3"
                class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white"></textarea>
            </div>
          </div>

          <div class="mt-6 flex gap-3">
            <button @click="acceptWithChanges" :disabled="processing"
              class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50">
              {{ processing ? 'Processing...' : 'Save Changes' }}
            </button>
            <button @click="showEditModal = false"
              class="flex-1 px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-gray-400 dark:hover:bg-slate-500">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Holding Deposit Modal -->
      <div v-if="showHoldingDepositModal" class="fixed inset-0 bg-gray-600 dark:bg-slate-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50"
        @click.self="closeHoldingDepositModal">
        <div class="relative top-20 mx-auto p-5 border border-gray-200 dark:border-slate-700 w-96 shadow-lg rounded-md bg-white dark:bg-slate-800">
          <!-- Step 1: Input Amount -->
          <template v-if="holdingDepositStep === 'input'">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Enter Holding Deposit Amount</h3>
            <div class="mb-4">
              <label for="holding-deposit-amount" class="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Amount Received (£)
              </label>
              <input id="holding-deposit-amount" v-model="holdingDepositInput" type="number" step="0.01" min="0"
                placeholder="Enter amount..."
                class="block w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md focus:ring-primary focus:border-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
              <p v-if="holdingDepositError" class="mt-2 text-sm text-red-600">{{ holdingDepositError }}</p>
            </div>
            <div class="flex gap-3">
              <button @click="proceedToConfirmHoldingDeposit"
                class="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                Continue
              </button>
              <button @click="closeHoldingDepositModal"
                class="flex-1 px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-gray-400 dark:hover:bg-slate-500">
                Cancel
              </button>
            </div>
          </template>

          <!-- Step 2: Confirm -->
          <template v-else-if="holdingDepositStep === 'confirm'">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Confirm Holding Deposit</h3>
            <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
              Mark holding deposit of <strong>£{{ parseFloat(holdingDepositInput).toFixed(2) }}</strong> as received and create references?
            </p>
            <p class="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2 mb-4">
              This will send reference forms to all tenants.
            </p>
            <div class="flex gap-3">
              <button @click="confirmHoldingDepositReceived" :disabled="processing"
                class="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50">
                {{ processing ? 'Processing...' : 'Confirm' }}
              </button>
              <button @click="holdingDepositStep = 'input'" :disabled="processing"
                class="flex-1 px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 text-sm font-medium rounded-md hover:bg-gray-400 dark:hover:bg-slate-500">
                Back
              </button>
            </div>
          </template>

          <!-- Step 3: Success -->
          <template v-else-if="holdingDepositStep === 'success'">
            <div class="text-center">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <CheckCircle class="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Success!</h3>
              <p class="text-sm text-gray-600 dark:text-slate-400 mb-4">
                Holding deposit of £{{ parseFloat(holdingDepositInput).toFixed(2) }} marked as received. References have been created and sent to tenants.
              </p>
              <button @click="closeHoldingDepositModal"
                class="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700">
                Close
              </button>
            </div>
          </template>
        </div>
      </div>

      <!-- Rent Share Modal -->
      <RentShareModal
        :is-open="showRentShareModal"
        :tenants="offer?.tenants || []"
        :total-rent="offer?.offered_rent_amount || 0"
        :saving="savingRentShares"
        @close="showRentShareModal = false"
        @confirm="handleRentSharesConfirm"
      />
    </div>
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { ArrowLeft, Check, Pencil, Trash2, CheckCircle } from 'lucide-vue-next'
import Sidebar from '../components/Sidebar.vue'
import RentShareModal from '../components/RentShareModal.vue'
import { formatDate as formatDateOnly, formatDateTime } from '../utils/date'
import { authFetch } from '@/lib/authFetch'

const API_URL = import.meta.env.VITE_API_URL ?? ''

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const offer = ref<any>(null)
const loading = ref(false)
const error = ref('')
const processing = ref(false)
const showApproveModal = ref(false)
const showDeclineModal = ref(false)
const showEditModal = ref(false)
const declineReason = ref('')

// Notes state
const notes = ref<any[]>([])
const newNote = ref('')
const addingNote = ref(false)
const editingNoteId = ref<string | null>(null)
const editNoteText = ref('')

// Audit log state
const auditLog = ref<any[]>([])
const resendingEmail = ref(false)

// Holding deposit modal state
const showHoldingDepositModal = ref(false)
const holdingDepositInput = ref('')
const holdingDepositStep = ref<'input' | 'confirm' | 'success'>('input')

// Rent share modal state
const showRentShareModal = ref(false)
const savingRentShares = ref(false)
const holdingDepositError = ref('')

const editForm = ref({
  property_address: '',
  property_city: '',
  property_postcode: '',
  offered_rent_amount: null as number | null,
  proposed_move_in_date: '',
  proposed_tenancy_length_months: 12,
  deposit_amount: null as number | null,
  special_conditions: ''
})

const holdingDepositAmount = computed(() => {
  if (!offer.value?.offered_rent_amount) return 0
  // Round down to nearest whole pound
  return Math.floor((offer.value.offered_rent_amount * 12) / 52)
})

const statusColorMap: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
  approved: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
  declined: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
  accepted_with_changes: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
}

const statusBadgeClass = computed(() => {
  if (!offer.value) return 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'

  const status = offer.value.status
  const depositReceived = offer.value.holding_deposit_received || status === 'holding_deposit_received' || status === 'reference_created'

  if ((status === 'approved' && depositReceived) || status === 'holding_deposit_received' || status === 'reference_created') {
    return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
  }

  return statusColorMap[status] || 'bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300'
})

const statusDisplay = computed(() => {
  if (!offer.value) return ''
  const status = offer.value.status
  if (status === 'holding_deposit_received' || status === 'reference_created') {
    return 'Approved'
  }
  return formatStatus(status)
})

const showStatusTick = computed(() =>
  !!offer.value?.holding_deposit_received ||
  offer.value?.status === 'holding_deposit_received' ||
  offer.value?.status === 'reference_created'
)

// Filter audit log for email-related entries
const emailAuditEntries = computed(() => {
  return auditLog.value.filter(entry =>
    entry.action.includes('EMAIL') ||
    entry.action.includes('APPROVED') ||
    entry.action.includes('DECLINED')
  )
})

const formatCurrency = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === '') return ''
  const numericValue = typeof value === 'string' ? parseFloat(value) : value
  if (Number.isNaN(numericValue)) return ''
  return numericValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatStatus = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    approved: 'Approved',
    declined: 'Declined',
    accepted_with_changes: 'Accepted with Changes',
    holding_deposit_received: 'Approved',
    reference_created: 'Approved'
  }
  return statusMap[status] || status
}

const formatDate = (dateString: string) => formatDateOnly(dateString)

const fetchOffer = async () => {
  loading.value = true
  error.value = ''
  try {
    const token = authStore.session?.access_token
    if (!token) {
      router.push('/login')
      return
    }

    const response = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}`, {
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error('Failed to fetch offer')
    }

    const data = await response.json()
    offer.value = data.offer

    // Initialize edit form
    editForm.value = {
      property_address: offer.value.property_address || '',
      property_city: offer.value.property_city || '',
      property_postcode: offer.value.property_postcode || '',
      offered_rent_amount: offer.value.offered_rent_amount || null,
      proposed_move_in_date: offer.value.proposed_move_in_date || '',
      proposed_tenancy_length_months: offer.value.proposed_tenancy_length_months || 12,
      deposit_amount: offer.value.deposit_amount || null,
      special_conditions: offer.value.special_conditions || ''
    }

    // Fetch notes and audit log
    await Promise.all([fetchNotes(), fetchAuditLog()])
  } catch (err: any) {
    error.value = err.message || 'Failed to load offer'
  } finally {
    loading.value = false
  }
}

const fetchNotes = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/offer-notes/${route.params.id}`, {
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      notes.value = data || []
    }
  } catch (err) {
    console.error('Failed to fetch notes:', err)
  }
}

const fetchAuditLog = async () => {
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/offer-audit-log/${route.params.id}`, {
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      auditLog.value = data || []
    }
  } catch (err) {
    console.error('Failed to fetch audit log:', err)
  }
}

const addNote = async () => {
  if (!newNote.value.trim()) return

  addingNote.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/offer-notes/${route.params.id}`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: newNote.value })
    })

    if (response.ok) {
      const data = await response.json()
      notes.value.unshift(data)
      newNote.value = ''
      await fetchAuditLog() // Refresh audit log to show note added
    }
  } catch (err) {
    console.error('Failed to add note:', err)
  } finally {
    addingNote.value = false
  }
}

const startEditNote = (note: any) => {
  editingNoteId.value = note.id
  editNoteText.value = note.note
}

const cancelNoteEdit = () => {
  editingNoteId.value = null
  editNoteText.value = ''
}

const saveNoteEdit = async (noteId: string) => {
  if (!editNoteText.value.trim()) return

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/offer-notes/${route.params.id}/${noteId}`, {
      method: 'PUT',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ note: editNoteText.value })
    })

    if (response.ok) {
      const data = await response.json()
      const index = notes.value.findIndex(n => n.id === noteId)
      if (index !== -1) {
        notes.value[index] = data
      }
      cancelNoteEdit()
    }
  } catch (err) {
    console.error('Failed to update note:', err)
  }
}

const deleteNote = async (noteId: string) => {
  if (!window.confirm('Are you sure you want to delete this note?')) return

  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/offer-notes/${route.params.id}/${noteId}`, {
      method: 'DELETE',
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      notes.value = notes.value.filter(n => n.id !== noteId)
      await fetchAuditLog() // Refresh audit log
    }
  } catch (err) {
    console.error('Failed to delete note:', err)
  }
}

const resendEmail = async (emailType: 'approval' | 'decline') => {
  resendingEmail.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}/resend-email`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email_type: emailType })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to resend email')
    }

    await fetchAuditLog() // Refresh audit log to show resend
    alert(data.message || 'Email resent successfully')
  } catch (err: any) {
    alert(err.message || 'Failed to resend email')
  } finally {
    resendingEmail.value = false
  }
}

const approveOffer = async () => {
  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}/approve`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to approve offer')
    }

    showApproveModal.value = false
    await fetchOffer()
    await fetchAuditLog()
  } catch (err: any) {
    error.value = err.message || 'Failed to approve offer'
  } finally {
    processing.value = false
  }
}

const declineOffer = async () => {
  if (!declineReason.value.trim()) return

  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}/decline`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason: declineReason.value })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to decline offer')
    }

    showDeclineModal.value = false
    declineReason.value = ''
    await fetchOffer()
    await fetchAuditLog()
  } catch (err: any) {
    error.value = err.message || 'Failed to decline offer'
  } finally {
    processing.value = false
  }
}

const acceptWithChanges = async () => {
  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}`, {
      method: 'PUT',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(editForm.value)
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to update offer')
    }

    // Ask agent whether the changes have been agreed and if we should approve & email tenants
    const shouldApprove = window.confirm(
      'Have these changes been agreed with the tenant(s)? Click OK to approve the offer and send them an email with the updated terms and bank details, or Cancel to just save the changes.'
    )

    if (shouldApprove) {
      const approveResponse = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}/approve`, {
        method: 'POST',
        token,
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const approveData = await approveResponse.json()

      if (!approveResponse.ok) {
        throw new Error(approveData.error || 'Failed to approve offer after changes')
      }
    }

    showEditModal.value = false
    await fetchOffer()
    await fetchAuditLog()
  } catch (err: any) {
    error.value = err.message || 'Failed to update offer'
  } finally {
    processing.value = false
  }
}

const openHoldingDepositModal = () => {
  holdingDepositInput.value = ''
  holdingDepositError.value = ''
  holdingDepositStep.value = 'input'
  showHoldingDepositModal.value = true
}

const closeHoldingDepositModal = () => {
  showHoldingDepositModal.value = false
  holdingDepositInput.value = ''
  holdingDepositError.value = ''
  holdingDepositStep.value = 'input'
}

const proceedToConfirmHoldingDeposit = () => {
  const parsedAmount = parseFloat(holdingDepositInput.value)
  if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    holdingDepositError.value = 'Please enter a valid amount greater than zero.'
    return
  }
  holdingDepositError.value = ''
  holdingDepositStep.value = 'confirm'
}

const confirmHoldingDepositReceived = async () => {
  const parsedAmount = parseFloat(holdingDepositInput.value)

  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      processing.value = false
      return
    }

    const response = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}/holding-deposit-received`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ amount_paid: parsedAmount })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to mark holding deposit as received')
    }

    await fetchOffer()
    holdingDepositStep.value = 'success'
  } catch (err: any) {
    error.value = err.message || 'Failed to mark holding deposit as received'
    closeHoldingDepositModal()
  } finally {
    processing.value = false
  }
}

// Check if rent shares need to be set before proceeding
const needsRentShareSetup = computed(() => {
  if (!offer.value?.tenants || offer.value.tenants.length <= 1) return false
  // Check if any tenant is missing rent_share
  return offer.value.tenants.some((t: any) => t.rent_share == null)
})

// Keep for backwards compatibility - now may open rent share modal first
const markHoldingDepositReceived = () => {
  // For multi-tenant offers without rent shares set, show rent share modal first
  if (offer.value?.tenants && offer.value.tenants.length > 1 && needsRentShareSetup.value) {
    showRentShareModal.value = true
  } else {
    openHoldingDepositModal()
  }
}

// Handle rent shares confirmation
const handleRentSharesConfirm = async (tenantShares: Array<{ tenantId: string; rentShare: number }>) => {
  savingRentShares.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) return

    const response = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}/set-rent-shares`, {
      method: 'POST',
      token,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tenantShares })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to set rent shares')
    }

    // Refresh offer data to get updated rent shares
    await fetchOffer()

    // Close rent share modal and open holding deposit modal
    showRentShareModal.value = false
    openHoldingDepositModal()
  } catch (err: any) {
    error.value = err.message || 'Failed to set rent shares'
  } finally {
    savingRentShares.value = false
  }
}

const confirmDelete = async () => {
  if (!window.confirm('Are you sure you want to delete this offer? This action cannot be undone.')) {
    return
  }

  processing.value = true
  try {
    const token = authStore.session?.access_token
    if (!token) {
      router.push('/login')
      return
    }

    const response = await authFetch(`${API_URL}/api/tenant-offers/${route.params.id}`, {
      method: 'DELETE',
      token,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Failed to delete offer')
    }

    router.push('/tenant-offers')
  } catch (err: any) {
    error.value = err.message || 'Failed to delete offer'
  } finally {
    processing.value = false
  }
}

onMounted(() => {
  fetchOffer()
})
</script>
