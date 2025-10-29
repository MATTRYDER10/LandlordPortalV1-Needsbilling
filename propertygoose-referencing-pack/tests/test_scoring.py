# tests/test_scoring.py
from src.propertygoose_scoring import score_propertygoose

def base():
    return {
        "monthly_rent_total": 1500,
        "rent_share_fraction": 0.5,
        "tenancy_months": 12,
        "tas_score": 690,
        "credit_events": {"declared_ccjs": [], "declared_iva": False, "declared_bankruptcy": False, "undeclared_adverse_found": False, "has_score": True},
        "id_check": {"passed": True, "document_fraud": False, "proof_of_residency_received": True},
        "aml_pep_sanctions": {"sanctions_match": False, "pep": False, "aml_adverse": False},
        "income": {"type": "employed", "gross_annual": 48000, "start_in_days": 0, "contract": "permanent", "professional_role": False, "self_employed_years": 0, "independent_means": {"has_proof": False, "funds_for_term": 0}},
        "landlord_ref": {"received": True, "arrears": "none", "property_care": "good", "notes": ""},
        "bank_validation_present": True,
        "needs_rent_protection_underwriting": False
    }

def test_pass_high_ratio():
    a = base()
    a["tas_score"] = 720
    a["income"]["gross_annual"] = 60000
    r = score_propertygoose(a)
    assert r["decision"] == "PASS"

def test_decline_low_affordability():
    a = base()
    a["income"]["gross_annual"] = 20000
    r = score_propertygoose(a)
    assert r["decision"] == "DECLINE"

def test_pass_with_guarantor_mid_ratio():
    a = base()
    a["income"]["gross_annual"] = 36000
    r = score_propertygoose(a)
    assert r["decision"] == "PASS_WITH_GUARANTOR"

def test_manual_review_no_score_no_residency_proof():
    a = base()
    a["credit_events"]["has_score"] = False
    a["id_check"]["proof_of_residency_received"] = False
    r = score_propertygoose(a)
    assert r["decision"] == "MANUAL_REVIEW"
