// ----- Types -----

//SAMPLE DATA
// const sample_data = {
//     "id": {
//       "decision": "PASS",
//       "notes": "ID checked",
//       "Verification_Checks": {},
//       "Evidence_Sources_Used": []
//     },
//     "rtr": {
//       "decision": "FAIL",
//       "notes": "RTR FAIL",
//       "Verification_Checks": {},
//       "Evidence_Sources_Used": []
//     },
//     "income": {
//       "decision": "PASS",
//       "notes": "Finance PASS",
//       "Verification_Checks": {
//         "businessTrading": "FAIL",
//         "employerEmailGenuine": "PASS",
//         "affordability": "PASS"
//       },
//       "Evidence_Sources_Used": [
//         "BANK_STATEMENTS",
//         "PAYSLIPS"
//       ]
//     },
//     "residential": {
//       "decision": "AMBER",
//       "notes": "AMBER RES",
//       "Verification_Checks": {
//         "tenancyDatesMatch": "PASS",
//         "contactDetailsVerifiable": "PASS",
//         "noConflicts": "PASS",
//         "referenceResponseSatisfactory": "FAIL"
//       },
//       "Evidence_Sources_Used": [
//         "LANDLORD_REFERENCE",
//         "AGENT_REFERENCE"
//       ]
//     },
//     "credit_tas": {
//       "decision": "FAIL",
//       "notes": "CREDS FAILED",
//       "tas_category": "FAIL",
//       "tas_reason": "FAILED nOT MATCHED",
//       "Verification_Checks": {},
//       "Evidence_Sources_Used": [
//         "CREDITSAFE_REPORT",
//         "SANCTIONS_SCREENING"
//       ]
//     }
//   }

export interface VerificationChecks {
    [key: string]: string; // dynamic key-value pairs
}

export interface VerifiedIncome {
    salary?: number | null;
    benefits?: number | null;
    savings?: number | null;
    additional_income?: number | null;
    self_employed?: number | null;
    total_override?: number | null;
    effective_total?: number;
    has_edits?: boolean;
}

export interface AssessmentSection {
    decision: string;
    notes?: string;
    tas_category: string;
    tas_reason?: string;
    Verification_Checks: VerificationChecks;
    Evidence_Sources_Used: string[];
    verified_income?: VerifiedIncome;
}

export interface FinalRemarks {
    id: AssessmentSection;
    rtr: AssessmentSection;
    income: AssessmentSection;
    residential?: AssessmentSection; // Optional for guarantors
    credit_tas: AssessmentSection;
}

export interface SubmitAssessmentBody {
    final_remarks: FinalRemarks;
    is_guarantor?: boolean;
}
// ----- Validation Functions -----
function isObject(v: any): v is Record<string, any> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isAssessmentSection(v: any): v is AssessmentSection {
    return (
        isObject(v) &&
        typeof v.decision === "string" &&
        isObject(v.Verification_Checks) &&
        Array.isArray(v.Evidence_Sources_Used) &&
        v.Evidence_Sources_Used.every((x: any) => typeof x === "string")
    );
}

function validateFinalRemarks(data: any, isGuarantor: boolean = false): data is FinalRemarks {
    if (!isObject(data)) return false;

    // For guarantors, residential is not required
    const requiredKeys = isGuarantor
        ? ["id", "rtr", "income", "credit_tas"]
        : ["id", "rtr", "income", "residential", "credit_tas"];

    return requiredKeys.every((key) => isAssessmentSection(data[key]));
}

export function validateSubmitAssessmentBody(
    body: any
) {
    const isGuarantor = body.is_guarantor === true;
    const isValid = (
        isObject(body) &&
        validateFinalRemarks(body.final_remarks, isGuarantor)
    );
    return { isValid, final_remarks: (body.final_remarks || {}) as FinalRemarks, is_guarantor: isGuarantor };
}
