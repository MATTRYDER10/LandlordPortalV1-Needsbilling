<template>
  <SectionCard
    title="Residential History"
    :section-order="4"
    :decision="section.decision"
    :condition-text="section.conditionText"
    :fail-reason="section.failReason"
    :decision-by="section.decisionBy"
    :decision-at="section.decisionAt"
    :has-unreviewed-data="hasUnreviewedData"
    :read-only="readOnly"
    :loading="loading"
    :action-reason-codes="actionReasonCodes"
    @pass="$emit('pass', section.id)"
    @pass-with-condition="(c) => $emit('passWithCondition', section.id, c)"
    @action-required="(p) => $emit('actionRequired', section.id, p)"
    @fail="(r) => $emit('fail', section.id, r)"
    @reset="$emit('reset', section.id)"
  >
    <div class="section-content">
      <p class="section-description">
        Review the tenant's previous address history and landlord/agent references.
      </p>

      <!-- Confirmation Status Badge -->
      <div v-if="residentialConfirmedAt" class="confirmation-status">
        <CheckCircle class="check-icon" />
        <span>
          Residential confirmed as <strong>{{ formatConfirmedStatus(confirmedResidentialStatus) }}</strong>
          by {{ residentialConfirmedBy }} on {{ formatDateTime(residentialConfirmedAt) }}
        </span>
      </div>

      <!-- Current Address -->
      <div v-if="currentAddress" class="address-section current-address">
        <h4 class="subsection-title">Current Address</h4>
        <div class="address-card current">
          <div class="address-content">
            <p class="address-text">{{ currentAddress.line1 }}</p>
            <p v-if="currentAddress.line2" class="address-text">{{ currentAddress.line2 }}</p>
            <p class="address-text">{{ currentAddress.city }}, {{ currentAddress.postcode }}</p>
            <p v-if="currentAddress.country" class="address-country">{{ currentAddress.country }}</p>
          </div>
          <div v-if="currentAddress.timeYears !== undefined || currentAddress.timeMonths !== undefined" class="time-at-address">
            <span class="time-badge">
              {{ formatTimeAtAddress(currentAddress.timeYears, currentAddress.timeMonths) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Full Address History (3 Years) -->
      <div v-if="previousAddresses && previousAddresses.length > 0" class="address-section address-history">
        <h4 class="subsection-title">Address History (3 Years)</h4>
        <div class="address-history-list">
          <div v-for="(addr, index) in previousAddresses" :key="index" class="address-card history">
            <div class="address-order">#{{ index + 1 }}</div>
            <div class="address-content">
              <p class="address-text">{{ addr.line1 }}</p>
              <p v-if="addr.line2" class="address-text">{{ addr.line2 }}</p>
              <p class="address-text">{{ addr.city }}, {{ addr.postcode }}</p>
              <p v-if="addr.country" class="address-country">{{ addr.country }}</p>
              <p v-if="addr.movedIn" class="address-date">Moved in: {{ formatDate(addr.movedIn) }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Previous Rental Address (from form) -->
      <div class="address-section">
        <h4 class="subsection-title">Previous Address</h4>
        <div class="address-card">
          <div class="address-type">
            <span :class="['type-badge', previousAddressType?.toLowerCase() || 'unknown']">
              {{ formatAddressType(previousAddressType) }}
            </span>
          </div>
          <p class="address-text">{{ previousAddress || 'Not provided' }}</p>
          <div v-if="tenancyStartDate || tenancyEndDate" class="tenancy-dates">
            <div v-if="tenancyStartDate" class="date-row">
              <span class="date-label">Tenancy Start:</span>
              <span class="date-value">{{ formatDate(tenancyStartDate) }}</span>
            </div>
            <div class="date-row">
              <span class="date-label">Tenancy End:</span>
              <span class="date-value">{{ tenancyEndDate ? formatDate(tenancyEndDate) : 'Ongoing' }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Confirm Residential Button -->
      <button
        v-if="!readOnly"
        class="confirm-btn"
        @click="openConfirmModal"
      >
        <CheckCircle class="btn-icon" />
        {{ residentialConfirmedAt ? 'Review & Update Residential' : 'Confirm Residential Status' }}
      </button>

      <!-- Landlord/Agent Reference (from evidence data) -->
      <div v-if="evidenceLandlordRef" class="reference-section">
        <h4 class="subsection-title">
          {{ previousAddressType === 'AGENT' ? 'Agent' : 'Landlord' }} Reference
        </h4>

        <!-- Good Tenant Badge -->
        <div v-if="evidenceLandlordRef.goodTenant" class="good-tenant-badge-container">
          <div :class="['good-tenant-badge', getGoodTenantClass(evidenceLandlordRef.goodTenant)]">
            <CheckCircle v-if="evidenceLandlordRef.goodTenant === 'yes'" class="badge-icon" />
            <AlertTriangle v-else-if="evidenceLandlordRef.goodTenant === 'with_reservations'" class="badge-icon" />
            <X v-else class="badge-icon" />
            <span>{{ formatGoodTenant(evidenceLandlordRef.goodTenant) }}</span>
          </div>
        </div>

        <!-- Address Discrepancy Warning -->
        <div v-if="evidenceLandlordRef.addressCorrect === 'no'" class="address-discrepancy-warning">
          <div class="warning-header">
            <AlertTriangle class="warning-icon" />
            <span>Address Discrepancy</span>
          </div>
          <p class="warning-description">The referee indicated the address provided was incorrect.</p>
          <div class="address-comparison">
            <div class="address-box claimed">
              <span class="address-box-label">Claimed Address:</span>
              <p class="address-box-text">{{ previousAddress || 'Not provided' }}</p>
            </div>
            <div class="address-box corrected">
              <span class="address-box-label">Corrected Address:</span>
              <p class="address-box-text">
                {{ evidenceLandlordRef.correctedAddressLine1 }}<br v-if="evidenceLandlordRef.correctedAddressLine2" />
                {{ evidenceLandlordRef.correctedAddressLine2 }}<br v-if="evidenceLandlordRef.correctedCity || evidenceLandlordRef.correctedPostcode" />
                {{ [evidenceLandlordRef.correctedCity, evidenceLandlordRef.correctedPostcode].filter(Boolean).join(', ') }}
              </p>
            </div>
          </div>
        </div>

        <div class="reference-card">
          <div class="reference-header">
            <div class="reference-info">
              <span class="reference-name">{{ evidenceLandlordRef.landlordName }}</span>
              <span v-if="evidenceLandlordRef.landlordEmail" class="reference-contact">
                {{ evidenceLandlordRef.landlordEmail }}
              </span>
            </div>
            <span class="reference-status completed">Received</span>
          </div>

          <div class="reference-responses">
            <div v-if="evidenceLandlordRef.monthlyRent" class="response-item">
              <span class="response-label">Monthly Rent:</span>
              <span class="response-value">£{{ evidenceLandlordRef.monthlyRent.toLocaleString() }}</span>
            </div>
            <div v-if="evidenceLandlordRef.tenancyLengthMonths" class="response-item">
              <span class="response-label">Tenancy Length:</span>
              <span class="response-value">{{ evidenceLandlordRef.tenancyLengthMonths }} months</span>
            </div>
            <div v-if="evidenceLandlordRef.propertyCity || evidenceLandlordRef.propertyPostcode" class="response-item">
              <span class="response-label">Property Location:</span>
              <span class="response-value">{{ [evidenceLandlordRef.propertyCity, evidenceLandlordRef.propertyPostcode].filter(Boolean).join(', ') }}</span>
            </div>
            <div v-if="evidenceLandlordRef.rentPaidOnTime" class="response-item">
              <span class="response-label">Rent Paid on Time:</span>
              <span :class="['response-value', evidenceLandlordRef.rentPaidOnTime === 'yes' ? 'yes' : 'no']">
                {{ formatYesNo(evidenceLandlordRef.rentPaidOnTime) }}
              </span>
            </div>
            <div v-if="evidenceLandlordRef.wouldRentAgain" class="response-item">
              <span class="response-label">Would Rent Again:</span>
              <span :class="['response-value', evidenceLandlordRef.wouldRentAgain === 'yes' ? 'yes' : 'no']">
                {{ formatYesNo(evidenceLandlordRef.wouldRentAgain) }}
              </span>
            </div>
            <div v-if="evidenceLandlordRef.propertyCondition" class="response-item">
              <span class="response-label">Property Condition:</span>
              <span class="response-value">{{ evidenceLandlordRef.propertyCondition }}</span>
            </div>
          </div>

          <div v-if="evidenceLandlordRef.additionalComments" class="reference-comments">
            <p class="comments-label">Comments:</p>
            <p class="comments-text">{{ evidenceLandlordRef.additionalComments }}</p>
          </div>

          <!-- Signature -->
          <div v-if="evidenceLandlordRef.signatureName || evidenceLandlordRef.signatureDate" class="reference-signature-info">
            <p class="signature-label">Signed by:</p>
            <p class="signature-details">
              {{ evidenceLandlordRef.signatureName || 'Unknown' }}
              <span v-if="evidenceLandlordRef.signatureDate"> on {{ formatDate(evidenceLandlordRef.signatureDate) }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Agent Reference (from evidence data) -->
      <div v-else-if="evidenceAgentRef" class="reference-section">
        <h4 class="subsection-title">Agent Reference</h4>

        <!-- Good Tenant Badge -->
        <div v-if="evidenceAgentRef.goodTenant" class="good-tenant-badge-container">
          <div :class="['good-tenant-badge', getGoodTenantClass(evidenceAgentRef.goodTenant)]">
            <CheckCircle v-if="evidenceAgentRef.goodTenant === 'yes'" class="badge-icon" />
            <AlertTriangle v-else-if="evidenceAgentRef.goodTenant === 'with_reservations'" class="badge-icon" />
            <X v-else class="badge-icon" />
            <span>{{ formatGoodTenant(evidenceAgentRef.goodTenant) }}</span>
          </div>
        </div>

        <!-- Address Discrepancy Warning -->
        <div v-if="evidenceAgentRef.addressCorrect === 'no'" class="address-discrepancy-warning">
          <div class="warning-header">
            <AlertTriangle class="warning-icon" />
            <span>Address Discrepancy</span>
          </div>
          <p class="warning-description">The referee indicated the address provided was incorrect.</p>
          <div class="address-comparison">
            <div class="address-box claimed">
              <span class="address-box-label">Claimed Address:</span>
              <p class="address-box-text">{{ previousAddress || 'Not provided' }}</p>
            </div>
            <div class="address-box corrected">
              <span class="address-box-label">Corrected Address:</span>
              <p class="address-box-text">
                {{ evidenceAgentRef.correctedAddressLine1 }}<br v-if="evidenceAgentRef.correctedAddressLine2" />
                {{ evidenceAgentRef.correctedAddressLine2 }}<br v-if="evidenceAgentRef.correctedCity || evidenceAgentRef.correctedPostcode" />
                {{ [evidenceAgentRef.correctedCity, evidenceAgentRef.correctedPostcode].filter(Boolean).join(', ') }}
              </p>
            </div>
          </div>
        </div>

        <div class="reference-card">
          <div class="reference-header">
            <div class="reference-info">
              <span class="reference-name">{{ evidenceAgentRef.agentName }}{{ evidenceAgentRef.agencyName ? ` (${evidenceAgentRef.agencyName})` : '' }}</span>
              <span v-if="evidenceAgentRef.agentEmail" class="reference-contact">
                {{ evidenceAgentRef.agentEmail }}
              </span>
            </div>
            <span class="reference-status completed">Received</span>
          </div>

          <div class="reference-responses">
            <div v-if="evidenceAgentRef.monthlyRent" class="response-item">
              <span class="response-label">Monthly Rent:</span>
              <span class="response-value">£{{ evidenceAgentRef.monthlyRent.toLocaleString() }}</span>
            </div>
            <div v-if="evidenceAgentRef.propertyCity || evidenceAgentRef.propertyPostcode" class="response-item">
              <span class="response-label">Property Location:</span>
              <span class="response-value">{{ [evidenceAgentRef.propertyCity, evidenceAgentRef.propertyPostcode].filter(Boolean).join(', ') }}</span>
            </div>
            <div v-if="evidenceAgentRef.rentPaidOnTime" class="response-item">
              <span class="response-label">Rent Paid on Time:</span>
              <span :class="['response-value', evidenceAgentRef.rentPaidOnTime === 'yes' ? 'yes' : 'no']">
                {{ formatYesNo(evidenceAgentRef.rentPaidOnTime) }}
              </span>
            </div>
            <div v-if="evidenceAgentRef.wouldRentAgain" class="response-item">
              <span class="response-label">Would Rent Again:</span>
              <span :class="['response-value', evidenceAgentRef.wouldRentAgain === 'yes' ? 'yes' : 'no']">
                {{ formatYesNo(evidenceAgentRef.wouldRentAgain) }}
              </span>
            </div>
          </div>

          <div v-if="evidenceAgentRef.additionalComments" class="reference-comments">
            <p class="comments-label">Comments:</p>
            <p class="comments-text">{{ evidenceAgentRef.additionalComments }}</p>
          </div>

          <!-- Signature -->
          <div v-if="evidenceAgentRef.signatureName || evidenceAgentRef.signatureDate" class="reference-signature-info">
            <p class="signature-label">Signed by:</p>
            <p class="signature-details">
              {{ evidenceAgentRef.signatureName || 'Unknown' }}
              <span v-if="evidenceAgentRef.signatureDate"> on {{ formatDate(evidenceAgentRef.signatureDate) }}</span>
            </p>
          </div>
        </div>
      </div>

      <!-- Legacy Landlord Reference (fallback) -->
      <div v-else-if="landlordReference" class="reference-section">
        <h4 class="subsection-title">
          {{ previousAddressType === 'AGENT' ? 'Agent' : 'Landlord' }} Reference
        </h4>
        <div class="reference-card">
          <div class="reference-header">
            <div class="reference-info">
              <span class="reference-name">{{ landlordReference.name }}</span>
              <span v-if="landlordReference.email" class="reference-contact">
                {{ landlordReference.email }}
              </span>
            </div>
            <span :class="['reference-status', landlordReference.status?.toLowerCase() || 'pending']">
              {{ landlordReference.status || 'Pending' }}
            </span>
          </div>

          <div v-if="landlordReference.responses" class="reference-responses">
            <div v-if="landlordReference.responses.paymentOnTime !== undefined" class="response-item">
              <span class="response-label">Rent Paid on Time:</span>
              <span :class="['response-value', landlordReference.responses.paymentOnTime ? 'yes' : 'no']">
                {{ landlordReference.responses.paymentOnTime ? 'Yes' : 'No' }}
              </span>
            </div>
            <div v-if="landlordReference.responses.wouldRecommend !== undefined" class="response-item">
              <span class="response-label">Would Recommend:</span>
              <span :class="['response-value', landlordReference.responses.wouldRecommend ? 'yes' : 'no']">
                {{ landlordReference.responses.wouldRecommend ? 'Yes' : 'No' }}
              </span>
            </div>
            <div v-if="landlordReference.responses.arrears !== undefined" class="response-item">
              <span class="response-label">Any Arrears:</span>
              <span :class="['response-value', landlordReference.responses.arrears ? 'no' : 'yes']">
                {{ landlordReference.responses.arrears ? 'Yes' : 'No' }}
              </span>
            </div>
            <div v-if="landlordReference.responses.propertyCondition" class="response-item">
              <span class="response-label">Property Condition:</span>
              <span class="response-value">{{ landlordReference.responses.propertyCondition }}</span>
            </div>
          </div>

          <div v-if="landlordReference.comments" class="reference-comments">
            <p class="comments-label">Comments:</p>
            <p class="comments-text">{{ landlordReference.comments }}</p>
          </div>

          <div v-if="landlordReference.signatureUrl" class="reference-signature">
            <p class="signature-label">Signature</p>
            <img :src="landlordReference.signatureUrl" alt="Landlord Signature" class="signature-image" />
          </div>
        </div>
      </div>

      <!-- No Reference Warning -->
      <div v-else-if="!isLivingWithFamily && !isOwnerOccupier" class="no-reference-warning">
        <AlertTriangle class="warning-icon" />
        <p>No landlord/agent reference received yet</p>
      </div>

      <!-- Living with Family Notice -->
      <div v-else-if="isLivingWithFamily" class="family-notice">
        <Info class="info-icon" />
        <div class="notice-text">
          <p class="notice-title">Living with Family</p>
          <p class="notice-description">No landlord reference required. Confirm this status to proceed.</p>
        </div>
      </div>

      <!-- Owner Occupier Notice -->
      <div v-else-if="isOwnerOccupier" class="owner-notice">
        <Home class="info-icon" />
        <div class="notice-text">
          <p class="notice-title">Owner Occupier</p>
          <p class="notice-description">Applicant owns their current property. No landlord reference required.</p>
        </div>
      </div>

      <!-- Evidence files -->
      <div v-if="section.evidenceFiles && section.evidenceFiles.length > 0" class="evidence-section">
        <h4 class="subsection-title">Evidence Files</h4>
        <div class="evidence-list">
          <div v-for="file in section.evidenceFiles" :key="file.fileId" class="evidence-item">
            <FileText class="evidence-icon" />
            <span class="evidence-name">{{ file.fileName }}</span>
          </div>
        </div>
      </div>
    </div>
  </SectionCard>

  <!-- Residential Confirmation Modal -->
  <Teleport to="body">
    <div v-if="showConfirmModal" class="modal-overlay" @click="closeConfirmModal">
      <div class="modal-container" @click.stop>
        <div class="modal-header">
          <h2 class="modal-title">Confirm Residential History</h2>
          <button class="modal-close" @click="closeConfirmModal">
            <X />
          </button>
        </div>

        <div class="modal-body">
          <!-- Claimed Details -->
          <div class="modal-section">
            <h3 class="modal-section-title">Claimed Details</h3>
            <div class="claimed-details">
              <div class="detail-row">
                <span class="detail-label">Previous Address</span>
                <span class="detail-value">{{ previousAddress || 'Not provided' }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Address Type</span>
                <span class="detail-value">{{ formatAddressType(previousAddressType) }}</span>
              </div>
              <div v-if="tenancyStartDate" class="detail-row">
                <span class="detail-label">Tenancy Start Date</span>
                <span class="detail-value">{{ formatDate(tenancyStartDate) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tenancy End Date</span>
                <span class="detail-value">{{ tenancyEndDate ? formatDate(tenancyEndDate) : 'Ongoing / Not provided' }}</span>
              </div>
            </div>
          </div>

          <!-- Landlord/Agent Reference Details (if exists) -->
          <div v-if="evidenceLandlordRef" class="modal-section">
            <h3 class="modal-section-title">
              {{ previousAddressType === 'AGENT' ? 'Agent' : 'Landlord' }} Reference
            </h3>
            <div class="reference-details">
              <div class="detail-row">
                <span class="detail-label">Referee</span>
                <span class="detail-value">{{ evidenceLandlordRef.landlordName }}</span>
              </div>
              <div v-if="evidenceLandlordRef.propertyAddress" class="detail-row">
                <span class="detail-label">Property Address</span>
                <span class="detail-value">{{ evidenceLandlordRef.propertyAddress }}</span>
              </div>
              <div v-if="evidenceLandlordRef.monthlyRent" class="detail-row">
                <span class="detail-label">Monthly Rent</span>
                <span class="detail-value">£{{ evidenceLandlordRef.monthlyRent.toLocaleString() }}</span>
              </div>
              <div v-if="evidenceLandlordRef.tenancyStartDate" class="detail-row">
                <span class="detail-label">Tenancy Start Date</span>
                <span class="detail-value">{{ formatDate(evidenceLandlordRef.tenancyStartDate) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tenancy End Date</span>
                <span class="detail-value">{{ evidenceLandlordRef.tenancyStillInProgress ? 'Still in contract' : (evidenceLandlordRef.tenancyEndDate ? formatDate(evidenceLandlordRef.tenancyEndDate) : 'Not provided') }}</span>
              </div>
              <div class="detail-row highlight">
                <span class="detail-label">Rent Paid on Time</span>
                <span :class="['detail-value', evidenceLandlordRef.rentPaidOnTime === 'yes' ? 'positive' : 'negative']">
                  {{ formatYesNo(evidenceLandlordRef.rentPaidOnTime) }}
                </span>
              </div>
              <div v-if="evidenceLandlordRef.rentPaidOnTimeDetails" class="detail-row">
                <span class="detail-label">Rent Details</span>
                <span class="detail-value">{{ evidenceLandlordRef.rentPaidOnTimeDetails }}</span>
              </div>
              <div class="detail-row highlight">
                <span class="detail-label">Would Rent Again</span>
                <span :class="['detail-value', evidenceLandlordRef.wouldRentAgain === 'yes' ? 'positive' : 'negative']">
                  {{ formatYesNo(evidenceLandlordRef.wouldRentAgain) }}
                </span>
              </div>
              <div v-if="evidenceLandlordRef.wouldRentAgainDetails" class="detail-row">
                <span class="detail-label">Would Rent Again Details</span>
                <span class="detail-value">{{ evidenceLandlordRef.wouldRentAgainDetails }}</span>
              </div>
              <div v-if="evidenceLandlordRef.propertyCondition" class="detail-row">
                <span class="detail-label">Property Condition</span>
                <span class="detail-value">{{ evidenceLandlordRef.propertyCondition }}</span>
              </div>
              <div v-if="evidenceLandlordRef.propertyConditionDetails" class="detail-row">
                <span class="detail-label">Property Condition Details</span>
                <span class="detail-value">{{ evidenceLandlordRef.propertyConditionDetails }}</span>
              </div>
              <div v-if="evidenceLandlordRef.neighbourComplaints" class="detail-row">
                <span class="detail-label">Neighbour Complaints</span>
                <span :class="['detail-value', evidenceLandlordRef.neighbourComplaints === 'no' ? 'positive' : 'negative']">
                  {{ formatYesNo(evidenceLandlordRef.neighbourComplaints) }}
                </span>
              </div>
              <div v-if="evidenceLandlordRef.neighbourComplaintsDetails" class="detail-row">
                <span class="detail-label">Neighbour Complaints Details</span>
                <span class="detail-value">{{ evidenceLandlordRef.neighbourComplaintsDetails }}</span>
              </div>
              <div v-if="evidenceLandlordRef.breachOfTenancy" class="detail-row">
                <span class="detail-label">Breach of Tenancy</span>
                <span :class="['detail-value', evidenceLandlordRef.breachOfTenancy === 'no' ? 'positive' : 'negative']">
                  {{ formatYesNo(evidenceLandlordRef.breachOfTenancy) }}
                </span>
              </div>
              <div v-if="evidenceLandlordRef.breachOfTenancyDetails" class="detail-row">
                <span class="detail-label">Breach of Tenancy Details</span>
                <span class="detail-value">{{ evidenceLandlordRef.breachOfTenancyDetails }}</span>
              </div>
              <div v-if="evidenceLandlordRef.additionalComments" class="detail-row">
                <span class="detail-label">Comments</span>
                <span class="detail-value">{{ evidenceLandlordRef.additionalComments }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Submitted</span>
                <span class="detail-value">{{ formatDate(evidenceLandlordRef.submittedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Agent Reference Details (if exists) -->
          <div v-if="evidenceAgentRef" class="modal-section">
            <h3 class="modal-section-title">Agent Reference</h3>
            <div class="reference-details">
              <div class="detail-row">
                <span class="detail-label">Agent/Agency</span>
                <span class="detail-value">{{ evidenceAgentRef.agentName }}{{ evidenceAgentRef.agencyName ? ` (${evidenceAgentRef.agencyName})` : '' }}</span>
              </div>
              <div v-if="evidenceAgentRef.propertyAddress" class="detail-row">
                <span class="detail-label">Property Address</span>
                <span class="detail-value">{{ evidenceAgentRef.propertyAddress }}</span>
              </div>
              <div v-if="evidenceAgentRef.monthlyRent" class="detail-row">
                <span class="detail-label">Monthly Rent</span>
                <span class="detail-value">£{{ evidenceAgentRef.monthlyRent.toLocaleString() }}</span>
              </div>
              <div v-if="evidenceAgentRef.tenancyStartDate" class="detail-row">
                <span class="detail-label">Tenancy Start Date</span>
                <span class="detail-value">{{ formatDate(evidenceAgentRef.tenancyStartDate) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tenancy End Date</span>
                <span class="detail-value">{{ evidenceAgentRef.tenancyStillInProgress ? 'Still in contract' : (evidenceAgentRef.tenancyEndDate ? formatDate(evidenceAgentRef.tenancyEndDate) : 'Not provided') }}</span>
              </div>
              <div class="detail-row highlight">
                <span class="detail-label">Rent Paid on Time</span>
                <span :class="['detail-value', evidenceAgentRef.rentPaidOnTime === 'yes' ? 'positive' : 'negative']">
                  {{ formatYesNo(evidenceAgentRef.rentPaidOnTime) }}
                </span>
              </div>
              <div v-if="evidenceAgentRef.rentPaidOnTimeDetails" class="detail-row">
                <span class="detail-label">Rent Details</span>
                <span class="detail-value">{{ evidenceAgentRef.rentPaidOnTimeDetails }}</span>
              </div>
              <div class="detail-row highlight">
                <span class="detail-label">Would Rent Again</span>
                <span :class="['detail-value', evidenceAgentRef.wouldRentAgain === 'yes' ? 'positive' : 'negative']">
                  {{ formatYesNo(evidenceAgentRef.wouldRentAgain) }}
                </span>
              </div>
              <div v-if="evidenceAgentRef.wouldRentAgainDetails" class="detail-row">
                <span class="detail-label">Would Rent Again Details</span>
                <span class="detail-value">{{ evidenceAgentRef.wouldRentAgainDetails }}</span>
              </div>
              <div v-if="evidenceAgentRef.neighbourComplaints" class="detail-row">
                <span class="detail-label">Neighbour Complaints</span>
                <span :class="['detail-value', evidenceAgentRef.neighbourComplaints === 'no' ? 'positive' : 'negative']">
                  {{ formatYesNo(evidenceAgentRef.neighbourComplaints) }}
                </span>
              </div>
              <div v-if="evidenceAgentRef.neighbourComplaintsDetails" class="detail-row">
                <span class="detail-label">Neighbour Complaints Details</span>
                <span class="detail-value">{{ evidenceAgentRef.neighbourComplaintsDetails }}</span>
              </div>
              <div v-if="evidenceAgentRef.breachOfTenancy" class="detail-row">
                <span class="detail-label">Breach of Tenancy</span>
                <span :class="['detail-value', evidenceAgentRef.breachOfTenancy === 'no' ? 'positive' : 'negative']">
                  {{ formatYesNo(evidenceAgentRef.breachOfTenancy) }}
                </span>
              </div>
              <div v-if="evidenceAgentRef.breachOfTenancyDetails" class="detail-row">
                <span class="detail-label">Breach of Tenancy Details</span>
                <span class="detail-value">{{ evidenceAgentRef.breachOfTenancyDetails }}</span>
              </div>
              <div v-if="evidenceAgentRef.additionalComments" class="detail-row">
                <span class="detail-label">Comments</span>
                <span class="detail-value">{{ evidenceAgentRef.additionalComments }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Submitted</span>
                <span class="detail-value">{{ formatDate(evidenceAgentRef.submittedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- Family/Owner Notice -->
          <div v-if="isLivingWithFamily || isOwnerOccupier" class="modal-section">
            <div :class="['info-banner', isLivingWithFamily ? 'family' : 'owner']">
              <Info class="banner-icon" />
              <p v-if="isLivingWithFamily">
                Applicant is living with family. No landlord reference is required.
              </p>
              <p v-else>
                Applicant is an owner occupier. No landlord reference is required.
              </p>
            </div>
          </div>

          <!-- Confirmation Selection -->
          <div class="modal-section">
            <h3 class="modal-section-title">Confirm Status</h3>
            <p class="confirm-description">
              Select the verified residential status based on your review:
            </p>
            <div class="status-options">
              <label
                v-if="!isLivingWithFamily && !isOwnerOccupier"
                :class="['status-option', { selected: selectedStatus === 'VERIFIED' }]"
              >
                <input
                  v-model="selectedStatus"
                  type="radio"
                  value="VERIFIED"
                  name="residential-status"
                />
                <span class="option-content">
                  <span class="option-title">Verified</span>
                  <span class="option-description">Landlord/Agent reference confirms tenancy</span>
                </span>
              </label>

              <label :class="['status-option', { selected: selectedStatus === 'LIVING_WITH_FAMILY' }]">
                <input
                  v-model="selectedStatus"
                  type="radio"
                  value="LIVING_WITH_FAMILY"
                  name="residential-status"
                />
                <span class="option-content">
                  <span class="option-title">Living with Family</span>
                  <span class="option-description">Applicant is living with family members</span>
                </span>
              </label>

              <label :class="['status-option', { selected: selectedStatus === 'OWNER_OCCUPIER' }]">
                <input
                  v-model="selectedStatus"
                  type="radio"
                  value="OWNER_OCCUPIER"
                  name="residential-status"
                />
                <span class="option-content">
                  <span class="option-title">Owner Occupier</span>
                  <span class="option-description">Applicant owns their current property</span>
                </span>
              </label>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="closeConfirmModal">Cancel</button>
          <button
            class="btn-primary"
            :disabled="!selectedStatus || confirmLoading"
            @click="confirmResidential"
          >
            <span v-if="confirmLoading">Saving...</span>
            <span v-else>Confirm Residential</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { CheckCircle, AlertTriangle, Info, Home, FileText, X } from 'lucide-vue-next'
import type { VerificationSection, ActionReasonCode } from '@/types/staff'
import SectionCard from './SectionCard.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const token = computed(() => authStore.session?.access_token || '')

interface LandlordRef {
  name: string
  email?: string
  phone?: string
  status?: string
  responses?: {
    paymentOnTime?: boolean
    wouldRecommend?: boolean
    arrears?: boolean
    propertyCondition?: string
  }
  comments?: string
  signatureUrl?: string
}

interface EvidenceLandlordRef {
  landlordName: string
  landlordEmail?: string
  landlordPhone?: string
  propertyAddress?: string
  tenancyStartDate?: string
  tenancyEndDate?: string
  monthlyRent?: number
  rentPaidOnTime?: string
  rentPaidOnTimeDetails?: string
  wouldRentAgain?: string
  wouldRentAgainDetails?: string
  propertyCondition?: string
  propertyConditionDetails?: string
  neighbourComplaints?: string
  neighbourComplaintsDetails?: string
  breachOfTenancy?: string
  breachOfTenancyDetails?: string
  additionalComments?: string
  submittedAt?: string
  tenancyStillInProgress?: boolean
  // Additional fields from third-party reference
  propertyCity?: string
  propertyPostcode?: string
  tenancyLengthMonths?: number
  monthlyRentConfirm?: number
  goodTenant?: string
  addressCorrect?: string
  correctedAddressLine1?: string
  correctedAddressLine2?: string
  correctedCity?: string
  correctedPostcode?: string
  signatureName?: string
  signature?: string
  signatureDate?: string
}

interface EvidenceAgentRef {
  agentName: string
  agencyName?: string
  agentEmail?: string
  agentPhone?: string
  propertyAddress?: string
  tenancyStartDate?: string
  tenancyEndDate?: string
  monthlyRent?: number
  rentPaidOnTime?: string
  rentPaidOnTimeDetails?: string
  wouldRentAgain?: string
  wouldRentAgainDetails?: string
  neighbourComplaints?: string
  neighbourComplaintsDetails?: string
  breachOfTenancy?: string
  breachOfTenancyDetails?: string
  additionalComments?: string
  submittedAt?: string
  tenancyStillInProgress?: boolean
  // Additional fields from third-party reference
  propertyCity?: string
  propertyPostcode?: string
  goodTenant?: string
  addressCorrect?: string
  correctedAddressLine1?: string
  correctedAddressLine2?: string
  correctedCity?: string
  correctedPostcode?: string
  signatureName?: string
  signature?: string
  signatureDate?: string
}

interface CurrentAddress {
  line1?: string
  line2?: string
  city?: string
  postcode?: string
  country?: string
  timeYears?: number
  timeMonths?: number
}

interface PreviousAddress {
  line1?: string
  line2?: string
  city?: string
  postcode?: string
  country?: string
  movedIn?: string
}

const props = defineProps<{
  section: VerificationSection
  referenceId: string
  previousAddress?: string
  previousAddressType?: string
  tenancyDuration?: string
  tenancyStartDate?: string
  tenancyEndDate?: string
  landlordReference?: LandlordRef
  hasUnreviewedData?: boolean
  readOnly?: boolean
  loading?: boolean
  actionReasonCodes?: ActionReasonCode[]
  // Evidence data from parent
  evidenceLandlordRef?: EvidenceLandlordRef
  evidenceAgentRef?: EvidenceAgentRef
  confirmedResidentialStatus?: string
  residentialConfirmedAt?: string
  residentialConfirmedBy?: string
  // Current and previous addresses
  currentAddress?: CurrentAddress
  previousAddresses?: PreviousAddress[]
}>()

const emit = defineEmits<{
  (e: 'pass', sectionId: string): void
  (e: 'passWithCondition', sectionId: string, condition: string): void
  (e: 'actionRequired', sectionId: string, params: { reasonCode: string; agentNote: string; internalNote: string }): void
  (e: 'fail', sectionId: string, reason: string): void
  (e: 'reset', sectionId: string): void
  (e: 'residentialConfirmed', data: { confirmedStatus: string }): void
}>()

// Modal state
const showConfirmModal = ref(false)
const confirmLoading = ref(false)
const selectedStatus = ref<string>('')

const isLivingWithFamily = computed(() => {
  return props.previousAddressType === 'FAMILY'
})

const isOwnerOccupier = computed(() => {
  return props.previousAddressType === 'OWNER'
})

const initializeForm = () => {
  // Pre-select based on address type or existing confirmed status
  if (props.confirmedResidentialStatus) {
    selectedStatus.value = props.confirmedResidentialStatus
  } else if (isLivingWithFamily.value) {
    selectedStatus.value = 'LIVING_WITH_FAMILY'
  } else if (isOwnerOccupier.value) {
    selectedStatus.value = 'OWNER_OCCUPIER'
  } else if (props.landlordReference || props.evidenceLandlordRef || props.evidenceAgentRef) {
    selectedStatus.value = 'VERIFIED'
  } else {
    selectedStatus.value = ''
  }
}

const openConfirmModal = () => {
  initializeForm()
  showConfirmModal.value = true
  document.body.style.overflow = 'hidden'
}

const closeConfirmModal = () => {
  showConfirmModal.value = false
  document.body.style.overflow = ''
}

const API_BASE = import.meta.env.VITE_API_URL ?? ''

const confirmResidential = async () => {
  if (!selectedStatus.value) return

  confirmLoading.value = true

  try {
    const response = await fetch(`${API_BASE}/api/verify/confirm-residential/${props.referenceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      },
      body: JSON.stringify({
        status: selectedStatus.value
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to confirm residential status')
    }

    emit('residentialConfirmed', {
      confirmedStatus: selectedStatus.value
    })

    closeConfirmModal()
  } catch (error: any) {
    console.error('Error confirming residential:', error)
    alert(error.message || 'Failed to confirm residential status')
  } finally {
    confirmLoading.value = false
  }
}

const formatAddressType = (type?: string) => {
  if (!type) return 'Unknown'
  const types: Record<string, string> = {
    LANDLORD: 'Private Landlord',
    AGENT: 'Letting Agent',
    OWNER: 'Owner Occupier',
    FAMILY: 'Living with Family',
    OTHER: 'Other'
  }
  return types[type] || type
}

const formatConfirmedStatus = (status?: string) => {
  if (!status) return ''
  const statuses: Record<string, string> = {
    VERIFIED: 'Verified',
    LIVING_WITH_FAMILY: 'Living with Family',
    OWNER_OCCUPIER: 'Owner Occupier'
  }
  return statuses[status] || status
}

const formatDate = (dateString?: string) => {
  if (!dateString) return 'Not specified'
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })
}

const formatDateTime = (dateString?: string) => {
  if (!dateString) return ''
  return new Date(dateString).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatYesNo = (value?: string) => {
  if (!value) return 'Not provided'
  if (value.toLowerCase() === 'yes') return 'Yes'
  if (value.toLowerCase() === 'no') return 'No'
  return value
}

const formatTimeAtAddress = (years?: number, months?: number) => {
  const parts = []
  if (years && years > 0) {
    parts.push(`${years} year${years !== 1 ? 's' : ''}`)
  }
  if (months && months > 0) {
    parts.push(`${months} month${months !== 1 ? 's' : ''}`)
  }
  return parts.length > 0 ? parts.join(', ') : 'Not specified'
}

const getGoodTenantClass = (value?: string) => {
  if (!value) return ''
  if (value === 'yes') return 'good'
  if (value === 'with_reservations') return 'reservations'
  return 'bad'
}

const formatGoodTenant = (value?: string) => {
  if (!value) return 'Not specified'
  const labels: Record<string, string> = {
    'yes': 'Good Tenant',
    'with_reservations': 'Good Tenant (with reservations)',
    'no': 'Not Recommended'
  }
  return labels[value] || value
}
</script>

<style scoped>
.section-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section-description {
  color: #6b7280;
  font-size: 0.875rem;
}

.confirmation-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #d1fae5;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  color: #065f46;
}

.check-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #059669;
  flex-shrink: 0;
}

.confirm-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.confirm-btn:hover {
  background: #ea580c;
}

.btn-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.address-section,
.reference-section,
.evidence-section {
  padding: 1rem;
  background: #f9fafb;
  border-radius: 0.5rem;
}

.subsection-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem;
}

.address-card {
  padding: 0.75rem;
  background: white;
  border-radius: 0.25rem;
}

.address-card.current {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-left: 3px solid #10b981;
}

.address-card.history {
  display: flex;
  gap: 0.75rem;
  border-left: 2px solid #e5e7eb;
}

.address-content {
  flex: 1;
}

.address-country {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0;
}

.address-date {
  font-size: 0.75rem;
  color: #6b7280;
  margin: 0.5rem 0 0;
}

.address-order {
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  min-width: 1.5rem;
}

.time-at-address {
  flex-shrink: 0;
}

.time-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: #dbeafe;
  color: #1e40af;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 4px;
}

.address-history-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.address-type {
  margin-bottom: 0.5rem;
}

.type-badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.type-badge.landlord {
  background: #dbeafe;
  color: #1e40af;
}

.type-badge.agent {
  background: #f3e8ff;
  color: #6b21a8;
}

.type-badge.owner,
.type-badge.family {
  background: #dcfce7;
  color: #166534;
}

.type-badge.other,
.type-badge.unknown {
  background: #e5e7eb;
  color: #6b7280;
}

.address-text {
  font-size: 0.875rem;
  color: #1f2937;
  margin: 0 0 0.5rem;
}

.tenancy-dates {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid #e5e7eb;
}

.date-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
}

.date-label {
  color: #6b7280;
}

.date-value {
  color: #374151;
  font-weight: 500;
}

.reference-card {
  padding: 1rem;
  background: white;
  border-radius: 0.25rem;
  border-left: 3px solid #10b981;
}

.reference-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.reference-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.reference-name {
  font-weight: 600;
  color: #1f2937;
}

.reference-contact {
  font-size: 0.875rem;
  color: #6b7280;
}

.reference-status {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: capitalize;
}

.reference-status.received,
.reference-status.completed {
  background: #d1fae5;
  color: #065f46;
}

.reference-status.pending {
  background: #fef3c7;
  color: #92400e;
}

.reference-responses {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.response-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.response-label {
  color: #6b7280;
}

.response-value {
  font-weight: 500;
}

.response-value.yes {
  color: #059669;
}

.response-value.no {
  color: #dc2626;
}

.reference-comments {
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.comments-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 0.25rem;
}

.comments-text {
  font-size: 0.875rem;
  color: #374151;
  margin: 0;
  white-space: pre-line;
}

.reference-signature {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.signature-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 0.5rem;
}

.signature-image {
  max-height: 60px;
  object-fit: contain;
}

.no-reference-warning {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 0.5rem;
  color: #92400e;
}

.warning-icon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

.family-notice,
.owner-notice {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
}

.family-notice {
  background: #ede9fe;
  border: 1px solid #c4b5fd;
}

.owner-notice {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.info-icon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
  color: #6b7280;
}

.notice-text {
  flex: 1;
}

.notice-title {
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 0.25rem;
}

.notice-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0;
}

.evidence-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.evidence-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #4b5563;
}

.evidence-icon {
  width: 1rem;
  height: 1rem;
  color: #9ca3af;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 9998;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-container {
  background: white;
  border-radius: 0.75rem;
  width: 100%;
  max-width: 600px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e5e7eb;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  border-radius: 0.25rem;
  transition: background 0.2s;
}

.modal-close:hover {
  background: #f3f4f6;
}

.modal-close svg {
  width: 1.25rem;
  height: 1.25rem;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.modal-section {
  margin-bottom: 1.5rem;
}

.modal-section:last-child {
  margin-bottom: 0;
}

.modal-section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #374151;
  margin: 0 0 0.75rem;
}

.claimed-details,
.reference-details {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  background: #f9fafb;
  padding: 1rem;
  border-radius: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #e5e7eb;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-row.highlight {
  background: #f0fdf4;
  margin: 0 -0.5rem;
  padding: 0.5rem;
  border-radius: 0.25rem;
}

.detail-label {
  color: #6b7280;
  font-size: 0.875rem;
}

.detail-value {
  color: #1f2937;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: right;
  max-width: 60%;
}

.detail-value.positive {
  color: #059669;
}

.detail-value.negative {
  color: #dc2626;
}

.info-banner {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
}

.info-banner.family {
  background: #ede9fe;
  color: #5b21b6;
}

.info-banner.owner {
  background: #ecfdf5;
  color: #047857;
}

.banner-icon {
  width: 1.5rem;
  height: 1.5rem;
  flex-shrink: 0;
}

.info-banner p {
  margin: 0;
  font-size: 0.875rem;
}

.confirm-description {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0 0 1rem;
}

.status-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.status-option {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.status-option:hover {
  border-color: var(--color-primary);
}

.status-option.selected {
  border-color: var(--color-primary);
  background: #fff7ed;
}

.status-option input {
  margin-top: 0.25rem;
  accent-color: var(--color-primary);
}

.option-content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.option-title {
  font-weight: 600;
  color: #1f2937;
}

.option-description {
  font-size: 0.75rem;
  color: #6b7280;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.btn-secondary {
  padding: 0.625rem 1.25rem;
  background: white;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-secondary:hover {
  background: #f3f4f6;
}

.btn-primary {
  padding: 0.625rem 1.25rem;
  background: var(--color-primary);
  border: none;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #ea580c;
}

.btn-primary:disabled {
  background: #fdba74;
  cursor: not-allowed;
}

/* Good Tenant Badge */
.good-tenant-badge-container {
  margin-bottom: 1rem;
}

.good-tenant-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.good-tenant-badge.good {
  background: #d1fae5;
  color: #065f46;
  border: 1px solid #10b981;
}

.good-tenant-badge.reservations {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #f59e0b;
}

.good-tenant-badge.bad {
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #ef4444;
}

.good-tenant-badge .badge-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* Address Discrepancy Warning */
.address-discrepancy-warning {
  margin-bottom: 1rem;
  padding: 1rem;
  background: #fef3c7;
  border: 2px solid #f59e0b;
  border-radius: 0.5rem;
}

.address-discrepancy-warning .warning-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #92400e;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.address-discrepancy-warning .warning-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #d97706;
}

.address-discrepancy-warning .warning-description {
  font-size: 0.875rem;
  color: #78350f;
  margin: 0 0 0.75rem;
}

.address-comparison {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .address-comparison {
    grid-template-columns: 1fr;
  }
}

.address-box {
  padding: 0.75rem;
  border-radius: 0.375rem;
}

.address-box.claimed {
  background: white;
  border: 1px solid #e5e7eb;
}

.address-box.corrected {
  background: #fff7ed;
  border: 2px solid #f97316;
}

.address-box-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
}

.address-box-text {
  font-size: 0.875rem;
  color: #1f2937;
  margin: 0;
  line-height: 1.4;
}

/* Reference Signature Info */
.reference-signature-info {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #e5e7eb;
}

.reference-signature-info .signature-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6b7280;
  margin: 0 0 0.25rem;
}

.reference-signature-info .signature-details {
  font-size: 0.875rem;
  color: #374151;
  font-weight: 500;
  margin: 0;
}
</style>
