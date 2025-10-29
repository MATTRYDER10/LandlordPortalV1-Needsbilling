// tests/scoring.test.ts
import { describe, it, expect } from 'vitest';
import { scorePropertyGoose } from '../src/propertygoose_scoring';

const base = {
  monthly_rent_total: 1500,
  rent_share_fraction: 0.5,
  tenancy_months: 12,
  tas_score: 690,
  credit_events: { declared_ccjs: [], declared_iva: false, declared_bankruptcy: false, undeclared_adverse_found: false, has_score: true },
  id_check: { passed: true, document_fraud: false, proof_of_residency_received: true },
  aml_pep_sanctions: { sanctions_match: false, pep: false, aml_adverse: false },
  income: { type: "employed" as const, gross_annual: 48000, start_in_days: 0, contract: "permanent", professional_role: false, self_employed_years: 0, independent_means: { has_proof: false, funds_for_term: 0 } },
  landlord_ref: { received: true, arrears: "none" as const, property_care: "good" as const, notes: "" },
  bank_validation_present: true,
  needs_rent_protection_underwriting: false
};

describe('scorePropertyGoose', () => {
  it('PASS when high ratio and score', () => {
    const r = scorePropertyGoose({ ...base, tas_score: 720, income: { ...base.income, gross_annual: 60000 } });
    expect(r.decision).toBe("PASS");
  });

  it('Decline on affordability <1.5x', () => {
    const r = scorePropertyGoose({ ...base, income: { ...base.income, gross_annual: 20000 } });
    expect(r.decision).toBe("DECLINE");
  });

  it('Pass with guarantor when ratio 2.0x', () => {
    const r = scorePropertyGoose({ ...base, income: { ...base.income, gross_annual: 36000 } });
    expect(r.decision).toBe("PASS_WITH_GUARANTOR");
  });

  it('Manual review if no credit score and missing residency proof', () => {
    const r = scorePropertyGoose({ ...base, credit_events: { ...base.credit_events, has_score: false }, id_check: { ...base.id_check, proof_of_residency_received: false } });
    expect(r.decision).toBe("MANUAL_REVIEW");
  });
});
