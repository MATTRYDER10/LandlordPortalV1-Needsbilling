# src/propertygoose_scoring.py
from dataclasses import dataclass
from typing import Dict, Any, List

def clamp(x, lo, hi): 
    return max(lo, min(hi, x))

def score_propertygoose(a: Dict[str, Any]) -> Dict[str, Any]:
    def decline(reason: str) -> Dict[str, Any]:
        return {
            "decision": "DECLINE",
            "score_total": 0,
            "domain_scores": {"credit_tas":0,"affordability":0,"employment":0,"residential":0,"id_data":0},
            "ratio": 0.0, "caps": [], "review_flags": [], "decline_reasons": [reason],
            "guarantor_requirements": {"min_ratio": 3.0, "min_tas": 618, "min_tas_if_rent_protection": 710}
        }

    # Gates
    if a["aml_pep_sanctions"]["sanctions_match"]:
        return decline("Sanctions match")
    if a["aml_pep_sanctions"]["aml_adverse"]:
        return decline("Adverse AML")
    if (not a["id_check"]["passed"]) or a["id_check"]["document_fraud"]:
        return decline("ID failed")
    if a["credit_events"]["undeclared_adverse_found"]:
        return decline("Undeclared adverse credit")

    annual_rent_share = a["monthly_rent_total"] * 12 * a["rent_share_fraction"]
    ratio = (a["income"]["gross_annual"] / annual_rent_share) if annual_rent_share > 0 else 0.0
    if ratio < 1.5:
        return decline("Affordability < 1.5x")

    review_flags: List[str] = []
    caps: List[str] = []

    # A) Credit & TAS
    credit_pts = 0
    if not a["credit_events"]["has_score"]:
        credit_pts += 10
        if not a["id_check"]["proof_of_residency_received"]:
            review_flags.append("no_score_needs_residency_proof")
        tas_score = None
    else:
        tas_score = a.get("tas_score") or 0
        if tas_score >= 710: credit_pts += 30
        elif tas_score >= 618: credit_pts += 24
        elif tas_score >= 545: credit_pts += 16
        else: credit_pts += 6

    declared_ccjs = a["credit_events"]["declared_ccjs"]
    declared_count = len(declared_ccjs)
    max_amt = max([c["amount"] for c in declared_ccjs], default=0) if declared_ccjs else 0
    if declared_count == 1 and max_amt <= 300: credit_pts -= 6
    if declared_count >= 2 or max_amt > 300:
        credit_pts -= 12; caps.append("guarantor_required")
    if a["credit_events"]["declared_iva"] or a["credit_events"]["declared_bankruptcy"]:
        credit_pts -= 12; caps.append("guarantor_required")
    credit_pts = clamp(credit_pts, 0, 35)

    # B) Affordability
    if a["income"]["independent_means"]["has_proof"]:
        required = a["monthly_rent_total"] * a["tenancy_months"] * 3
        if a["income"]["independent_means"]["funds_for_term"] >= required:
            ratio = 3.0
    if ratio >= 3.0: aff_pts = 30
    elif ratio >= 2.5: aff_pts = 24
    else: aff_pts = 12; caps.append("affordability_<2.5x")

    # C) Employment
    emp = a["income"]
    emp_pts = 0
    if emp["type"] == "employed" and emp["contract"] == "permanent" and emp["start_in_days"] <= 31:
        emp_pts = 15
    elif emp["type"] == "employed" and emp["start_in_days"] <= 31:
        emp_pts = 12
    elif emp["type"] == "employed" and emp["start_in_days"] <= 62 and bool(emp.get("professional_role")):
        emp_pts = 12
    elif emp["type"] == "temp" or ("fixed" in emp["contract"].lower() if emp["contract"] else False):
        emp_pts = 8
    elif emp["type"] in ("benefits","pension"):
        emp_pts = 10  # upgrade to 12 if award spans full term
    elif emp["type"] == "self_employed" and emp["self_employed_years"] >= 1:
        emp_pts = 15
    elif emp["type"] == "self_employed" and emp["self_employed_years"] < 1:
        emp_pts = 6; caps.append("guarantor_required")

    # D) Residential
    if not a["landlord_ref"]["received"]:
        res_pts = 6; review_flags.append("missing_landlord_ref")
    else:
        if a["landlord_ref"]["arrears"] == "severe" or a["landlord_ref"]["property_care"] == "bad":
            return decline("Severe tenancy issues")
        elif a["landlord_ref"]["arrears"] == "minor_cleared":
            res_pts = 8
        else:
            res_pts = 15

    # E) ID/Data
    id_pts = 0
    if a["id_check"]["passed"]: id_pts += 3
    if a.get("bank_validation_present"): id_pts += 2

    total = credit_pts + aff_pts + emp_pts + res_pts + id_pts

    needs_rp = a["needs_rent_protection_underwriting"]
    min_tas = 710 if needs_rp else 618

    if review_flags:
        return {
            "decision": "MANUAL_REVIEW",
            "score_total": total,
            "domain_scores": {"credit_tas": credit_pts, "affordability": aff_pts, "employment": emp_pts, "residential": res_pts, "id_data": id_pts},
            "ratio": ratio, "caps": caps, "review_flags": review_flags, "decline_reasons": [],
            "guarantor_requirements": {"min_ratio": 3.0, "min_tas": 618, "min_tas_if_rent_protection": 710}
        }

    tas_effective = tas_score or 0
    if ratio >= 2.5 and total >= 80 and tas_effective >= min_tas and ("guarantor_required" not in caps):
        decision = "PASS"
    elif ratio >= 1.5 and total >= 65:
        decision = "PASS_WITH_GUARANTOR"
    else:
        return decline("Insufficient score for PASS_WITH_GUARANTOR")

    return {
        "decision": decision,
        "score_total": total,
        "domain_scores": {"credit_tas": credit_pts, "affordability": aff_pts, "employment": emp_pts, "residential": res_pts, "id_data": id_pts},
        "ratio": ratio, "caps": caps, "review_flags": [], "decline_reasons": [],
        "guarantor_requirements": {"min_ratio": 3.0, "min_tas": 618, "min_tas_if_rent_protection": 710}
    }
