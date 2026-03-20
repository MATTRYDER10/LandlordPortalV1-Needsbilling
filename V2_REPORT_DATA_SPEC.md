# V2 Reference Report — Available Data Endpoints

All data comes from the backend when generating the PDF. Here's every data point available per section, grouped by source.

---

## 1. HEADER / REFERENCE INFO
| Field | Source |
|-------|--------|
| Company Name | `companies.name` (or encrypted) |
| Company Logo URL | `companies.logo_url` |
| Reference Number | `tenant_references_v2.reference_number` (e.g. PG-2603-0001) |
| Report Generated Date | Now |
| Final Decision | `tenant_references_v2.status` (ACCEPTED / ACCEPTED_WITH_GUARANTOR / ACCEPTED_ON_CONDITION / REJECTED) |
| Decision Notes | `tenant_references_v2.final_decision_notes` |
| Reviewed By (staff name) | `staff_users` via `final_decision_by` |
| QR Code | Verification URL with reference ID |

---

## 2. PROPERTY DETAILS
| Field | Source |
|-------|--------|
| Property Address | `tenant_references_v2.property_address_encrypted` (decrypted) |
| City | `tenant_references_v2.property_city_encrypted` (decrypted) |
| Postcode | `tenant_references_v2.property_postcode_encrypted` (decrypted) |
| Monthly Rent (total) | `tenant_references_v2.monthly_rent` |
| Rent Share (this tenant) | `tenant_references_v2.rent_share` |
| Move-in Date | `tenant_references_v2.move_in_date` |
| Term | `tenant_references_v2.term_years` + `term_months` |

---

## 3. TENANT DETAILS (per tenant — repeated for groups)
| Field | Source |
|-------|--------|
| First Name | `tenant_references_v2.tenant_first_name_encrypted` (decrypted) |
| Last Name | `tenant_references_v2.tenant_last_name_encrypted` (decrypted) |
| Email | `tenant_references_v2.tenant_email_encrypted` (decrypted) |
| Phone | `tenant_references_v2.tenant_phone_encrypted` (decrypted) |
| Date of Birth | `tenant_references_v2.tenant_dob_encrypted` (decrypted) |
| Is Guarantor | `tenant_references_v2.is_guarantor` |

---

## 4. SECTION RESULTS (6 per tenant, 5 per guarantor)

### Per Section (from `reference_sections_v2`)
| Field | Source |
|-------|--------|
| Section Type | IDENTITY / RTR / INCOME / RESIDENTIAL / CREDIT / AML |
| Decision | PASS / PASS_WITH_CONDITION / FAIL |
| Condition Text | `condition_text` (if PASS_WITH_CONDITION) |
| Fail Reason | `fail_reason` (if FAIL) |
| Assessor Notes | `assessor_notes` |
| Checklist Results | `section_data.checklist_results` (JSON — e.g. rtr_type, annual_income, savings, monthly_income, total_effective_income) |
| Completed At | `completed_at` |

---

## 5. IDENTITY SECTION SPECIFICS
| Field | Source |
|-------|--------|
| Document Type | `form_data.identity.documentType` |
| Selfie URL | `evidence_v2` or `form_data.identity.selfieUrl` |
| ID Document URL | `evidence_v2` or `form_data.identity.idDocumentUrl` |
| Checklist: Document Type verified | `section_data.checklist_results.document_type` |
| Checklist: Expiry Date | `section_data.checklist_results.expiry_date` |

---

## 6. RIGHT TO RENT (RTR) SECTION SPECIFICS
| Field | Source |
|-------|--------|
| Citizenship Status | `form_data.rtr.citizenshipStatus` |
| Share Code | `form_data.rtr.shareCode` (decrypted) |
| Share Code Expiry | `form_data.rtr.shareCodeExpiry` |
| RTR Document URL | `evidence_v2` or `form_data.rtr.passportDocUrl` / `alternativeDocUrl` |
| Checklist: RTR Type | `section_data.checklist_results.rtr_type` (BRITISH_CITIZEN / EU_SETTLED / VISA etc.) |
| Checklist: RTR Expiry Date | `section_data.checklist_results.rtr_expiry_date` |

---

## 7. INCOME SECTION SPECIFICS
| Field | Source |
|-------|--------|
| Income Sources | `form_data.income.sources` (array: employed, self_employed, benefits, etc.) |
| Job Title | `form_data.income.jobTitle` |
| Employer Name | `form_data.income.employerName` |
| Annual Salary (declared) | `form_data.income.annualSalary` |
| Employment Start Date | `form_data.income.employmentStartDate` |
| Self-Employed Business Name | `form_data.income.selfEmployedBusinessName` |
| Self-Employed Annual Income | `form_data.income.selfEmployedAnnualIncome` |
| Benefits Monthly Amount | `form_data.income.benefitsMonthlyAmount` |
| Savings Amount | `form_data.income.savingsAmount` |
| Pension Monthly Amount | `form_data.income.pensionMonthlyAmount` |
| Payslips URL | `evidence_v2` or `form_data.income.payslipsUrl` |
| Tax Return URL | `evidence_v2` or `form_data.income.taxReturnUrl` |
| Checklist: Monthly Income Evidenced | `section_data.checklist_results.monthly_income` |
| Checklist: Annual Income (calculated) | `section_data.checklist_results.annual_income` |
| Checklist: Savings | `section_data.checklist_results.savings` |
| Checklist: Total Effective Income | `section_data.checklist_results.total_effective_income` |

### Employer Reference (from `referees_v2` where referee_type = EMPLOYER)
| Field | Source |
|-------|--------|
| Referee Name | `referees_v2.referee_name` |
| Confirms Employment | `form_data.confirmsEmployment` |
| Job Title | `form_data.jobTitle` |
| Employment Start Date | `form_data.employmentStartDate` |
| Annual Salary | `form_data.annualSalary` |
| Employment Type | `form_data.employmentType` (full-time / temporary) |
| In Probation | `form_data.inProbation` |
| Additional Comments | `form_data.additionalComments` |
| Submitted At | `form_data.submittedAt` |

### Accountant Reference (from `referees_v2` where referee_type = ACCOUNTANT)
| Field | Source |
|-------|--------|
| Accountant Name | `referees_v2.referee_name` |
| Confirms Client | `form_data.confirmsClient` |
| Business Name | `form_data.businessName` |
| Client Duration | `form_data.clientDuration` |
| Annual Income | `form_data.annualIncome` |
| Accounts Up To Date | `form_data.accountsUpToDate` |
| Financial Concerns | `form_data.financialConcerns` |
| Financial Concern Details | `form_data.financialConcernDetails` |

---

## 8. RESIDENTIAL SECTION SPECIFICS
| Field | Source |
|-------|--------|
| Current Living Situation | `form_data.residential.currentLivingSituation` (renting_landlord / renting_agent / living_with_family) |
| Current Address | `form_data.residential.currentAddress` (object: line1, line2, city, postcode) |
| Previous Addresses | `form_data.residential.previousAddresses` (array of address objects with landlord details) |
| Proof of Address URL | `evidence_v2` or `form_data.residential.proofOfAddressUrl` |
| Smoker | `form_data.residential.smoker` |
| Has Pets | `form_data.residential.hasPets` |
| Pet Details | `form_data.residential.petDetails` |

### Landlord Reference (from `referees_v2` where referee_type = LANDLORD)
| Field | Source |
|-------|--------|
| Referee Name | `referees_v2.referee_name` |
| Confirms Tenancy | `form_data.confirmsTenancy` |
| Tenancy Start Date | `form_data.tenancyStartDate` |
| Tenancy End Date | `form_data.tenancyEndDate` |
| Still Current Tenant | `form_data.stillCurrentTenant` |
| Monthly Rent Paid | `form_data.monthlyRent` |
| Rent Payment Timeliness | `form_data.rentPaymentTimeliness` (always / mostly / sometimes / rarely) |
| Property Condition | `form_data.propertyCondition` (excellent / good / fair / poor) |
| Property Damage | `form_data.propertyDamage` (bool) + `damageDetails` |
| Anti-Social Behaviour | `form_data.antiSocialBehaviour` (bool) + `antiSocialDetails` |
| Would Rent Again | `form_data.wouldRentAgain` |
| Additional Comments | `form_data.additionalComments` |

---

## 9. CREDIT CHECK SECTION SPECIFICS
| Field | Source |
|-------|--------|
| Risk Score | `creditsafe_verifications_v2.risk_score` (0-100) |
| Risk Level | `creditsafe_verifications_v2.risk_level` |
| Status | `creditsafe_verifications_v2.status` |
| Identity Verified | `responseData.verifyMatch` |
| Electoral Roll Match | `responseData.electoralRegisterMatch` |
| CCJ Match | `responseData.ccjMatch` (bool) |
| CCJ Details | `responseData.countyCourtJudgments[]` (courtName, amount, dateOfJudgment, caseStatus) |
| Insolvency Match | `responseData.insolvencyMatch` (bool) |
| Insolvency Details | `responseData.insolvencies[]` (type, date, status) |
| Deceased Register Match | `responseData.deceasedRegisterMatch` |
| Electoral Roll Records | `responseData.electoralRolls[]` (address, dateOfRegistration) |
| Checked At | `creditsafe_verifications_v2.created_at` |
| Transaction ID | `creditsafe_verifications_v2.transaction_id` |
| Adverse Credit Declared by Tenant | `form_data.personal.hasAdverseCredit` + `adverseCreditDetails` |

---

## 10. AML/SANCTIONS SECTION SPECIFICS
| Field | Source |
|-------|--------|
| Risk Level | `sanctions_screenings_v2.risk_level` (clear / low / medium / high) |
| Total Matches | `sanctions_screenings_v2.total_matches` |
| Sanctions Matches | `sanctions_screenings_v2.sanctions_matches` |
| Donation Matches | `sanctions_screenings_v2.donation_matches` |
| Summary | `sanctions_screenings_v2.summary` |

---

## 11. VERBAL REFERENCES (if any)
| Field | Source |
|-------|--------|
| Referee Type | `verbal_references_v2.referee_type` |
| Referee Name | `verbal_references_v2.referee_name` |
| Referee Phone | `verbal_references_v2.referee_phone` |
| Call Date | `verbal_references_v2.call_datetime` |
| Call Duration | `verbal_references_v2.call_duration_minutes` |
| Responses | `verbal_references_v2.responses` (JSON key/value pairs) |

---

## 12. AFFORDABILITY
| Field | Source |
|-------|--------|
| Annual Income | `tenant_references_v2.annual_income` |
| Monthly Rent Share | `tenant_references_v2.rent_share` |
| Affordability Ratio | `tenant_references_v2.affordability_ratio` |
| Affordability Pass | `tenant_references_v2.affordability_pass` |
| Rule | 30x monthly share for tenants, 32x for guarantors |

---

## 13. GROUP APPLICATION (if applicable)
- Parent reference contains property details
- Each child reference is a tenant with their own sections
- Each child may have a guarantor (another reference linked via `guarantor_for_reference_id`)
- Group affordability: sum of all tenant incomes vs total rent

---

## 14. GUARANTOR (if applicable, per tenant)
Same data as tenant (sections 3-10) but:
- 5 sections instead of 6 (IDENTITY, ADDRESS, INCOME, CREDIT, AML — no RTR or RESIDENTIAL)
- Affordability threshold is 32x instead of 30x
- Linked via `guarantor_for_reference_id`

---

## Notes for Design
- The current report is PDFKit-generated (programmatic). Consider switching to HTML→PDF (puppeteer/playwright) for better design control.
- Company logo should be in the header if available
- QR code for verification already exists
- Evidence document URLs can be embedded as links (not inline images) for security
- For groups: each tenant should have their own section in the report with their verification results
