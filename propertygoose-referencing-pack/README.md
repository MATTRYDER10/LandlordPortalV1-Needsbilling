# PropertyGoose Referencing Scoring – Dev Pack

Deterministic rules + scoring engine for tenancy applications. Ships with TypeScript and Python implementations, JSON Schemas, and tests.

## Contents
- `POLICY.md` – human-readable policy & mapping
- `schemas/` – JSON Schemas for input and output
- `src/propertygoose_scoring.ts` – TypeScript implementation
- `src/propertygoose_scoring.py` – Python implementation
- `tests/` – Jest & pytest unit tests
- `examples/` – sample I/O payloads
- `package.json` – quick-run scripts (TS tests via `vitest`)
- `pyproject.toml` – Python deps (`pytest` only)

## Quick Start (TypeScript)
```bash
npm i
npm run test
# or run a sample
npm run sample:ts
```

## Quick Start (Python)
```bash
pip install -r requirements.txt
pytest -q
python examples/run_python_example.py
```

## Design
- **Gates** short-circuit on sanctions, AML, ID fail, undeclared adverse credit, hard affordability floor.
- **Scoring** (0–100): Credit/TAS (35), Affordability (30), Employment (15), Residential (15), ID/Data (5).
- **Mapping**: PASS, PASS_WITH_GUARANTOR, MANUAL_REVIEW, DECLINE.
- **Affordability ratios**: Tenant ≥2.5× for PASS; 1.5–2.49× → guarantor route; Guarantor ≥3×.
- **TAS thresholds**: ≥618 general; ≥710 when rent-protection underwriting applies.

## Provenance
Policy bands & edge-case handling adapted from your internal guidance PDF and aligned to tenancy referencing practices.
