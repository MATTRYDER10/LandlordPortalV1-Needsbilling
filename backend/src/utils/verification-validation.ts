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

export interface AssessmentSection {
    decision: string;
    notes?: string;
    tas_category: string;
    tas_reason?: string;
    Verification_Checks: VerificationChecks;
    Evidence_Sources_Used: string[];
}

export interface FinalRemarks {
    id: AssessmentSection;
    rtr: AssessmentSection;
    income: AssessmentSection;
    residential: AssessmentSection;
    credit_tas: AssessmentSection;
}

export interface SubmitAssessmentBody {
    final_remarks: FinalRemarks;
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

function validateFinalRemarks(data: any): data is FinalRemarks {
    if (!isObject(data)) return false;

    const requiredKeys = ["id", "rtr", "income", "residential", "credit_tas"];

    return requiredKeys.every((key) => isAssessmentSection(data[key]));
}

export function validateSubmitAssessmentBody(
    body: any
) {
    const isValid = (
        isObject(body) &&
        validateFinalRemarks(body.final_remarks)
    );
    return { isValid, final_remarks: (body.final_remarks || {}) as FinalRemarks };
}
