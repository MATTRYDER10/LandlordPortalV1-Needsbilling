# PropertyGoose Referencing Scoring Policy (v1)

**Outcomes:** PASS · PASS-WITH-GUARANTOR · MANUAL-REVIEW · DECLINE

## Gates (hard stops)
1. **Sanctions/AML**: sanctions match or adverse AML → DECLINE; PEP → MANUAL-REVIEW.
2. **Identity**: ID fail or document fraud → DECLINE; unverifiable → MANUAL-REVIEW.
3. **Undeclared adverse credit** (CCJ/IVA/Bankruptcy) → DECLINE.
4. **Affordability floor (tenant)**: income:rent share ratio <1.5× → DECLINE; 1.5–2.49× → cap to PASS-WITH-GUARANTOR.
5. **Residential reference severe issues**: serious arrears, deliberate damage, tenancy fraud → DECLINE.
6. **No credit score**: MANUAL-REVIEW unless proof of residency is provided and rest is clean.

## Scoring (100 pts total)
- **A. Credit & TAS (35)**  
  TAS ≥710: +30 · 618–709: +24 · 545–617: +16 · <545: +6 · No score: +10 (with review flag unless residency proof).  
  Overlays (deduct; domain floor 0):  
  - Declared 1× CCJ ≤£300 → −6  
  - Declared CCJ >£300 or ≥2 CCJs → −12 (cap: guarantor)  
  - Declared IVA/Bankruptcy (satisfied or not) → −12 (cap: guarantor)

- **B. Affordability (30)**  
  ratio = gross_annual_income_for_share / annual_rent_share.  
  ≥3.0×: +30 · 2.5–2.99×: +24 · 1.5–2.49×: +12 (cap: guarantor) · <1.5×: DECLINE.  
  Independent means: verifiable funds ≥3× rent for full term → treat as 3.0× (30).  
  Guarantor affordability: ≥3.0× on obligation; else guarantor unacceptable.

- **C. Employment/Income stability (15)**  
  Permanent or ≥12m self-employed: +15 · New job ≤31d: +12 (non-professional) · Professional start ≤62d: +12 ·
  Fixed-term/Temp with ≥3m remaining: +8 · Benefits/Pension verified: +10–12 · Self-employed <12m: +6 (cap: guarantor).

- **D. Residential history (15)**  
  Clean ref: +15 · Minor historic arrears cleared: +8 · Missing ref (non-fault): +6 (review flag) · Material issues → DECLINE.

- **E. Identity & data quality (5)**  
  ID pass + 3y address + bank validation: +5 · Minor gaps resolved: +3 · ID pass + no-score credit: +2 (review until residency proof).

## Decision Mapping
- **PASS** if total ≥80, ratio ≥2.5×, no caps, and TAS ≥ min_tas (618 normal; 710 if rent-protection).
- **PASS-WITH-GUARANTOR** if total 65–79 (no gates) OR affordability 1.5–2.49× OR declared significant adverse (as above) OR early start rules; guarantor must be ≥3× and TAS ≥618 (≥710 if rent-protection).
- **MANUAL-REVIEW** if any review flag remains.
- **DECLINE** if any gate triggers.

## Multi-Applicant
Score each applicant. The tenancy is acceptable if acceptable shares cover ≥100% of rent: at least one PASS or all applicants together meet coverage through PASS/PASS-WITH-GUARANTOR with valid guarantors.
