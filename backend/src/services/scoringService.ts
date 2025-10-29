// src/propertygoose_scoring.ts
export type Decision = "PASS" | "PASS_WITH_GUARANTOR" | "MANUAL_REVIEW" | "DECLINE";

export interface ApplicantInput {
  monthly_rent_total: number;
  rent_share_fraction: number; // 0..1
  tenancy_months: number;
  tas_score?: number | null;
  credit_events: {
    declared_ccjs: { amount: number; satisfied: boolean }[];
    declared_iva: boolean;
    declared_bankruptcy: boolean;
    undeclared_adverse_found: boolean;
    has_score: boolean;
  };
  id_check: {
    passed: boolean;
    document_fraud: boolean;
    proof_of_residency_received: boolean;
  };
  aml_pep_sanctions: {
    sanctions_match: boolean;
    pep: boolean;
    aml_adverse: boolean;
  };
  income: {
    type: "employed" | "self_employed" | "temp" | "benefits" | "pension" | "unemployed";
    gross_annual: number;
    start_in_days: number;
    contract: string;
    professional_role?: boolean | null;
    self_employed_years: number;
    independent_means: { has_proof: boolean; funds_for_term: number };
  };
  landlord_ref: {
    received: boolean;
    arrears: "none" | "minor_cleared" | "severe" | "unknown";
    property_care: "good" | "fair" | "bad" | "unknown";
    notes: string;
  };
  bank_validation_present: boolean;
  needs_rent_protection_underwriting: boolean;
}

export interface ScoredDecision {
  decision: Decision;
  score_total: number;
  domain_scores: { credit_tas: number; affordability: number; employment: number; residential: number; id_data: number };
  ratio: number;
  caps: string[];
  review_flags: string[];
  decline_reasons: string[];
  guarantor_requirements: { min_ratio: number; min_tas: number; min_tas_if_rent_protection: number };
}

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)); }

export function scorePropertyGoose(a: ApplicantInput): ScoredDecision {
  // Track decline reasons (will be populated if gates fail)
  const decline_reasons: string[] = [];
  const review_flags: string[] = [];
  const caps: string[] = [];

  // Check hard gates (but don't return yet - calculate scores first)
  if (a.aml_pep_sanctions.sanctions_match) decline_reasons.push("Sanctions match");
  if (a.aml_pep_sanctions.aml_adverse) decline_reasons.push("Adverse AML");
  if (!a.id_check.passed) decline_reasons.push("ID verification failed");
  if (a.id_check.document_fraud) decline_reasons.push("Document fraud detected");
  if (a.credit_events.undeclared_adverse_found) decline_reasons.push("Undeclared adverse credit");

  const annual_rent_share = a.monthly_rent_total * 12 * a.rent_share_fraction;
  let ratio = (annual_rent_share > 0) ? a.income.gross_annual / annual_rent_share : 0;

  if (ratio < 1.5) decline_reasons.push("Affordability < 1.5x");

  // A) Credit & TAS
  let credit_pts = 0;
  if (!a.credit_events.has_score) {
    credit_pts += 10;
    if (!a.id_check.proof_of_residency_received) review_flags.push("no_score_needs_residency_proof");
  } else {
    const tas = a.tas_score ?? 0;
    if (tas >= 710) credit_pts += 30;
    else if (tas >= 618) credit_pts += 24;
    else if (tas >= 545) credit_pts += 16;
    else credit_pts += 6;
  }
  const declaredCount = a.credit_events.declared_ccjs.length;
  const maxAmt = declaredCount ? Math.max(...a.credit_events.declared_ccjs.map(c => c.amount)) : 0;
  if (declaredCount === 1 && maxAmt <= 300) credit_pts -= 6;
  if (declaredCount >= 2 || maxAmt > 300) { credit_pts -= 12; caps.push("guarantor_required"); }
  if (a.credit_events.declared_iva || a.credit_events.declared_bankruptcy) { credit_pts -= 12; caps.push("guarantor_required"); }
  credit_pts = clamp(credit_pts, 0, 35);

  // B) Affordability
  if (a.income.independent_means.has_proof) {
    const required = a.monthly_rent_total * a.tenancy_months * 3;
    if (a.income.independent_means.funds_for_term >= required) ratio = 3.0;
  }
  let aff_pts = 0;
  if (ratio >= 3.0) aff_pts = 30;
  else if (ratio >= 2.5) aff_pts = 24;
  else { aff_pts = 12; caps.push("affordability_<2.5x"); }

  // C) Employment
  let emp_pts = 0;
  const emp = a.income;
  if (emp.type === "employed" && emp.contract === "permanent" && emp.start_in_days <= 31) emp_pts = 15;
  else if (emp.type === "employed" && emp.start_in_days <= 31) emp_pts = 12;
  else if (emp.type === "employed" && emp.start_in_days <= 62 && !!emp.professional_role) emp_pts = 12;
  else if (emp.type === "temp" || emp.contract.toLowerCase().includes("fixed")) emp_pts = 8;
  else if (emp.type === "benefits" || emp.type === "pension") emp_pts = 10; // upgrade to 12 if award spans full term
  else if (emp.type === "self_employed" && emp.self_employed_years >= 1) emp_pts = 15;
  else if (emp.type === "self_employed" && emp.self_employed_years < 1) { emp_pts = 6; caps.push("guarantor_required"); }

  // D) Residential
  let res_pts = 0;
  if (!a.landlord_ref.received) {
    res_pts = 6;
    review_flags.push("missing_landlord_ref");
  } else {
    if (a.landlord_ref.arrears === "severe" || a.landlord_ref.property_care === "bad") {
      decline_reasons.push("Severe tenancy issues");
      res_pts = 0;
    } else if (a.landlord_ref.arrears === "minor_cleared") {
      res_pts = 8;
    } else {
      res_pts = 15;
    }
  }

  // E) ID/Data
  let id_pts = 0;
  if (a.id_check.passed) id_pts += 3;
  if (a.bank_validation_present) id_pts += 2;

  const total = credit_pts + aff_pts + emp_pts + res_pts + id_pts;

  // Decision logic - check if any hard gates failed first
  const needs_rp = a.needs_rent_protection_underwriting;
  const min_tas = needs_rp ? 710 : 618;

  // If any hard gate failed, return DECLINE with full score breakdown
  if (decline_reasons.length > 0) {
    return {
      decision: "DECLINE",
      score_total: total,
      domain_scores: { credit_tas: credit_pts, affordability: aff_pts, employment: emp_pts, residential: res_pts, id_data: id_pts },
      ratio, caps, review_flags, decline_reasons,
      guarantor_requirements: { min_ratio: 3.0, min_tas: 618, min_tas_if_rent_protection: 710 }
    };
  }

  // Check for manual review flags
  if (review_flags.length > 0) {
    return {
      decision: "MANUAL_REVIEW",
      score_total: total,
      domain_scores: { credit_tas: credit_pts, affordability: aff_pts, employment: emp_pts, residential: res_pts, id_data: id_pts },
      ratio, caps, review_flags, decline_reasons,
      guarantor_requirements: { min_ratio: 3.0, min_tas: 618, min_tas_if_rent_protection: 710 }
    };
  }

  // PASS criteria
  if (ratio >= 2.5 && total >= 80 && (a.tas_score ?? 0) >= min_tas && !caps.includes("guarantor_required")) {
    return {
      decision: "PASS",
      score_total: total,
      domain_scores: { credit_tas: credit_pts, affordability: aff_pts, employment: emp_pts, residential: res_pts, id_data: id_pts },
      ratio, caps, review_flags, decline_reasons,
      guarantor_requirements: { min_ratio: 3.0, min_tas: 618, min_tas_if_rent_protection: 710 }
    };
  }

  // PASS_WITH_GUARANTOR criteria
  if (ratio >= 1.5 && total >= 65) {
    return {
      decision: "PASS_WITH_GUARANTOR",
      score_total: total,
      domain_scores: { credit_tas: credit_pts, affordability: aff_pts, employment: emp_pts, residential: res_pts, id_data: id_pts },
      ratio, caps, review_flags, decline_reasons,
      guarantor_requirements: { min_ratio: 3.0, min_tas: 618, min_tas_if_rent_protection: 710 }
    };
  }

  // Insufficient score
  return {
    decision: "DECLINE",
    score_total: total,
    domain_scores: { credit_tas: credit_pts, affordability: aff_pts, employment: emp_pts, residential: res_pts, id_data: id_pts },
    ratio, caps, review_flags, decline_reasons: ["Insufficient score for PASS_WITH_GUARANTOR"],
    guarantor_requirements: { min_ratio: 3.0, min_tas: 618, min_tas_if_rent_protection: 710 }
  };
}
