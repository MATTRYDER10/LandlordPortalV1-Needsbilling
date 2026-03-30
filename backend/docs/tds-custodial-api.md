# TDS Custodial Deposit Management API v1.13

Reference: `/Users/matthewryder/Desktop/TDS Custodial - Deposit Management API (v1.13) (2).pdf`

## URLs
- Live: `https://api.custodial.tenancydepositscheme.com`
- Sandbox: `https://sandbox.api.custodial.tenancydepositscheme.com`
- API version: v1.2 (prefix all endpoints)

## Authentication
All endpoints use URL path params: `/<member_id>/<branch_id>/<api_key>/`
- `member_id`: 1-6 alphanumeric chars
- `branch_id`: 1-6 alphanumeric chars (0 for single-branch members)
- `api_key`: secret key from TDS

## 3. Deposit Creation (CreateDeposit)
`POST /v1.2/CreateDeposit`

### Auth/Meta Fields
| Key | Required | Description |
|-----|----------|-------------|
| member_id | Yes | Member ID from TDS |
| branch_id | Yes | Branch ID (0 for single branch) |
| api_key | Yes | Secret API key |
| scheme_type | Yes | `Custodial` or `TPFG` |
| region | Yes | `EW` (England/Wales) or `NI` |
| invoice | No | Boolean, default false |

### Tenancy Object
| Key | Required | Format |
|-----|----------|--------|
| user_tenancy_reference | Yes | **Must be unique per request** or validation error |
| property_id | No | If exists in TDS, links to existing property |
| property_paon | Yes | 1-100 alphanumeric (house number/name) |
| property_saon | No | 1-100 alphanumeric |
| property_street | Yes | 1-100 alphanumeric |
| property_locality | No | 3-100 alphanumeric |
| property_town | Yes | 3-100 alphanumeric |
| property_administrative_area | Yes | 3-100 alphanumeric, period, hyphen |
| property_postcode | Yes | 1-8 alphanumeric |
| tenancy_start_date | Yes | DD/MM/YYYY |
| tenancy_expected_end_date | Yes | DD/MM/YYYY |
| deposit_amount | Yes | 0.00 - 999999.99 |
| deposit_amount_to_protect | Yes | 0.00 - 999999.99 |
| deposit_received_date | Yes | DD/MM/YYYY |
| number_of_tenants | Yes | 1-99 (includes related parties) |
| number_of_landlords | Yes | 1-9 |
| members_own_reference | No | 1-30 alphanumeric |
| furnished_status | No | `furnished`, `part furnished`, `unfurnished` |
| product_type | No | `let only`, `Managed`, `non-managed` (default: managed) |

### Person Object
| Key | Required | Format |
|-----|----------|--------|
| person_classification | Yes | `Lead Tenant`, `Joint Tenant`, `Primary Landlord`, `Joint Landlord`, `Related Party` |
| **person_id** | **No** | **If person already exists in TDS, provide their ID here. All other details must match existing record.** |
| person_reference | No | 1-30 alphanumeric (landlord only) |
| person_title | Yes | 1-30 chars (e.g. Mr, Mrs, Miss) |
| person_firstname | Yes | 1-255 chars |
| person_surname | Yes | 1-255 chars |
| is_business | Yes (NI) | Y or N |
| business_name | if is_business=Y | 1-100 alphanumeric |
| person_email | Yes | 1-255 valid email. **Must be unique - 2 parties cannot share email. Landlord cannot use same email as existing tenant in TDS system.** |
| person_mobile | Yes | Starts with 0 or +, 1-30 chars. **For tenants: either mobile OR email mandatory, not both.** |
| person_phone | No | Starts with 0 or +, 1-30 chars |

#### Landlord-only address fields (all required for landlords):
| Key | Required | Format |
|-----|----------|--------|
| person_paon | Yes (landlords) | 1-100 alphanumeric |
| person_saon | No | 1-100 alphanumeric |
| person_street | Yes (landlords) | 1-100 alphanumeric |
| person_locality | No | 3-100 alphanumeric |
| person_town | Yes (landlords) | 3-100 alphanumeric |
| person_administrative_area | Yes (landlords) | 3-100 alphanumeric |
| person_postcode | Yes (landlords) | 1-8 chars |
| person_country | Yes (landlords) | 1-100 alphanumeric |

### Response
| Key | Description |
|-----|-------------|
| success | true = submitted to processing queue (NOT created yet) |
| batch_id | Unique ID for polling status |
| error | Error message if success=false |

## 3.1 Creation Status (CreateDepositStatus)
`GET /v1.2/CreateDepositStatus/<member_id>/<branch_id>/<api_key>/<batch_id>`

### Response
| Key | Description |
|-----|-------------|
| success | true = request was valid |
| status | `pending`, `created`, `failed` |
| dan | Deposit Account Number (only when status=created) |
| warnings | Array of warnings (info only, don't block creation) |
| errors | Array of errors (only when status=failed) |

## 4. Tenancy Information
`GET /v1.2/TenancyInformation/<member_id>/<branch_id>/<api_key>/<dan>`

Returns deposit status, DAN, protected amount, case status.

## 5. Landlords (Search)
`GET /v1.2/landlord/<member_id>/<branch_id>/<api_key>/?<filter_params>`

### Filter Parameters
| Key | Description |
|-----|-------------|
| id | Search by landlord ID (nonmemberlandlordid) |
| email | Search by email address |
| limit | Max results (default 50) |
| after_id | Pagination cursor |

### Landlord Entity Response
Key field: `nonmemberlandlordid` (Int) - **use this as `person_id` in CreateDeposit**

Other fields: `first_name`, `last_name`, `email`, `telephone`, `addresslines`, `addresscity`, `addresspostcode`, etc.

## 6. Properties (Search)
`GET /v1.2/property/<member_id>/<branch_id>/<api_key>/?<filter_params>`

### Filter Parameters
| Key | Description |
|-----|-------------|
| id | Search by property ID |
| postcode | Search by postcode |
| limit | Max results (default 50) |
| after_id | Pagination cursor |

### Property Entity Response
Key field: `propertyid` (Int) - use as `property_id` in CreateDeposit

## 7. Repayment Request
`POST /v1.2/RaiseRepaymentRequest/`

## 8. DPC (Deposit Protection Certificate)
`GET /v1.2/dpc/<member_id>/<branch_id>/<api_key>/<tenancy_dan>`

Returns PDF file directly.

## 9. Create Head Office Branch
`PUT /v1.2/headOffices/<head_office_member_id>/branches`

## 10. Create Head Office Branch User
`PUT /v1.2/headOffices/<head_office_member_id>/branches/<branch_member_id>/users`

## Key Rules
1. **Email uniqueness**: Emails must be globally unique in TDS. A landlord cannot reuse an email already in the system. **Solution: search for existing landlord by email first, use their `person_id`.**
2. **user_tenancy_reference**: Must be unique per request. Reusing causes silent validation error.
3. **person_title**: 1-30 chars (Mr is valid per docs, min is 1 not 3).
4. **Async processing**: CreateDeposit only queues. Must poll CreateDepositStatus for result.
5. **property_id**: If provided and exists in TDS, deposit links to existing property record.
