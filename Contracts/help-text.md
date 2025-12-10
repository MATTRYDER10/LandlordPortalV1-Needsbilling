# Contract Help Text Reference

This document catalogs all help text and instructional content found in the contract templates. These should be handled appropriately when generating final contracts.

---

## 1. Welsh Occupation Contracts - "RULES FOR POPULATION" Block

**Files affected:**
- DPS - Welsh Occupation Contract.docx.md
- G DPS - Welsh Occupation Contract.docx.md
- G MyDep - Welsh Occupation Contract.docx.md
- G Reposit - Welsh Occupation Contract.docx.md
- G TDS - Welsh Occupation Contract.docx.md
- MyDep - Welsh Occupation Contract.docx.md
- Reposit - Welsh Occupation Contract.docx.md
- TDS - Welsh Occupation Contract.docx.md

**Location:** Around lines 205-210

**Content:**
```
**RULES FOR POPULATION:**
**1\) Insert details into the placeholders using the provided tenant data.**
**2\) If there is more than one Contract-Holder, duplicate the entire "CONTRACT-HOLDERS BLOCK" for each additional person.**
**3\) Number each duplicated block sequentially (Contract-Holder \#1, \#2, \#3...).**
**4\) If only one Contract-Holder is provided, output exactly one block and do not add extra blocks.**
**5\) If no additional Contract-Holders are provided, do not duplicate anything; leave the clause structure as-is.**
```

**Purpose:** Instructions for populating multiple contract-holder blocks dynamically.

---

## 2. Propertymark AST - Permitted Occupiers Instruction

**Files affected:**
- Welsh Contracts Markdown/Propertymark AST, TDS.docx.md

**Location:** Line 571

**Content:**
```
#### **There are no Permitted Occupiers residing at the Premises. OR delete this sentence and fill in boxes below.**
```

**Purpose:** Conditional instruction - either display "no permitted occupiers" text or remove and populate the occupier details.

---

## 3. Propertymark AST - Witness Section

**Files affected:**
- Welsh Contracts Markdown/Propertymark AST, TDS.docx.md

**Location:** Lines 735-737

**Content:**
```
#### **Witnessed by [insert name of witness] or delete (best practice but not legally required)**

[Insert witness address]
```

**Purpose:** Optional witness section that can be included or removed.

---

## 4. Propertymark AST - Special Clauses Section

**Files affected:**
- Welsh Contracts Markdown/Propertymark AST, TDS.docx.md

**Location:** Line 747

**Content:**
```
[Insert special clauses here] *OR* remove this page.
```

**Purpose:** Placeholder for custom special clauses, or section should be removed if none exist.

---

## Usage Notes

When generating contracts:

1. **RULES FOR POPULATION** - Remove entirely after processing contract-holder blocks
2. **Permitted Occupiers** - Choose one option based on whether occupiers exist
3. **Witness Section** - Include or remove based on requirements
4. **Special Clauses** - Replace with actual clauses or remove the section entirely
