import { supabase } from "../../config/supabase";
import { decrypt } from "../encryption";
import { computeScore, scoringRules, computeIncomeMultiple } from "./computeScore";

type ResidentialStatus = "PASS" | "SKIPPED" | "FAIL" | "AMBER";
type Caller = 'System' | 'Staff';
type GlobalStatus = "PASS" | "FAIL" | "GUARANTOR_NEEDED";

type CreditFlags = { insolvency: boolean, ccj: boolean, deceased: boolean, electoral: boolean };
export type ReAssessmentPayload = {
    financial_status: GlobalStatus;
    res_assessment_status: ResidentialStatus;
    rtr_verified: boolean;
    credit_flags: CreditFlags;
    sanctions_clear: boolean;
}
type SanitizedIncome = {
    salary: string;
    benefits: string;
    additional: string;
    selfAnnual: string;
    is_hourly: boolean;
    monthly_rent: number;
    hours_per_month: number;
    additional_income: string;
    savings: string;
}

const sanitizeIncome = (raw_income: SanitizedIncome) => {
    const income = parseFloat(decrypt(raw_income.salary) || '0');
    const benefits = parseFloat(decrypt(raw_income.benefits) || '0');
    const additional = parseFloat(decrypt(raw_income.additional) || '0');
    const selfEmployedAnnual = parseFloat(decrypt(raw_income.selfAnnual) || '0');
    const additionalIncome = parseFloat(decrypt(raw_income.additional_income) || '0');
    const savings = parseFloat(decrypt(raw_income.savings) || '0') / 12;
    const rent = raw_income.monthly_rent || 0;
    const salary = raw_income.is_hourly ? Number(raw_income.hours_per_month) * income : (income / 12);
    return computeIncomeMultiple({ salary, benefits, additional, selfEmployedAnnual, rent, additionalIncome, savings });
}

export const assessApplicationScore = async (referenceId: string, caller: Caller, scoredBy: string | null = null,remarks : Record<string, any> | null = null) => {
    try {
        // FETCH ALL TABLE DATA
        const { data: reference } = await supabase
            .from("tenant_references")
            .select("*")
            .eq("id", referenceId)
            .single();

        const { data: creditsafe } = await supabase
            .from("creditsafe_verifications")
            .select("fraud_indicators")
            .eq("reference_id", referenceId)
            .single();

        const { data: sanctions } = await supabase
            .from("sanctions_screenings")
            .select("risk_level,sanctions_matches")
            .eq("reference_id", referenceId)
            .single();

        // Parse credit flags - null if no data, true if problem found
        let flags: any = null;
        try {
            if (creditsafe?.fraud_indicators) {
                flags = JSON.parse(creditsafe.fraud_indicators);
            }
        }
        catch (err) {
            console.error("Failed to parse creditsafe fraud indicators:", err);
        }

        // Credit: true = problem found, false = clear, null = no data
        const credit = {
            insolvency: flags ? (flags.insolvencyMatch || false) : null,
            ccj: flags ? (flags.ccjMatch || false) : null,
            deceased: flags ? (flags.deceasedMatch || false) : null,
            electoral: flags ? (flags.electoralRollMatch || false) : null
        };

        // AML: true = problem found (PEP/sanctions match), false = clear, null = no data
        let aml: { pep: boolean | null, sanctions: boolean | null } = { pep: null, sanctions: null };
        if (sanctions) {
            const isClear = sanctions.risk_level === 'clear' ||
                (Array.isArray(sanctions.sanctions_matches) && sanctions.sanctions_matches.length === 0);
            // If clear, no problem found (false). If not clear, problem found (true).
            aml = {
                pep: !isClear,
                sanctions: !isClear
            };
        }

        //RTR
        const rtrPass = reference?.rtr_verified || reference?.is_british_citizen;

        // RESIDENTIAL
        const residentialStatus: "PASS" | "SKIPPED" | "FAIL" | "AMBER" = reference?.res_assessment_status || (reference?.reference_type === "living_with_family" ? "PASS" : "SKIPPED");

        let incomeMultiple = 0;
        if (reference?.income_assessment_status !== "FAIL" && !reference?.income_student && !reference?.income_unemployed) {
            const payloadToSanitize: SanitizedIncome = {
                salary: reference.employment_salary_amount_encrypted,
                benefits: reference.benefits_monthly_amount_encrypted,
                additional: reference.additional_income_amount_encrypted,
                selfAnnual: reference.self_employed_annual_income_encrypted,
                monthly_rent: reference.rent_share || reference.monthly_rent || 0,
                additional_income: reference.additional_income_amount_encrypted,
                savings: reference.savings_amount_encrypted,
                is_hourly: reference.is_hourly || false,
                hours_per_month: reference.employment_hours_per_month || 0,
            }
            incomeMultiple = sanitizeIncome(payloadToSanitize);
        }

        // FINAL SCORING
        const scoreData = computeScore({
            credit,
            aml,
            rtr: rtrPass,
            residentialStatus,
            incomeMultiple,
            caller
        });

        // UPDATE OR INSERT INTO reference_scores
        const payload = {
            reference_id: referenceId,
            decision: scoreData.decision,
            score_total: scoreData.score_total,
            domain_scores: {
                credit: scoreData.domain_scores.credit,
                aml: scoreData.domain_scores.aml,
                rtr: scoreData.domain_scores.rtr,
                residential: scoreData.domain_scores.residential,
                income: scoreData.domain_scores.income
            },
            ratio: incomeMultiple,
            risk_level: scoreData.risk_level,
            caps: scoreData.gates,
            review_flags: [],
            decline_reasons: [],
            guarantor_required: scoreData.decision === "PASS_WITH_GUARANTOR",
            guarantor_min_ratio: null,
            guarantor_min_tas: null,
            scored_at: new Date().toISOString(),
            scored_by: scoredBy,
            final_remarks: remarks,
            assessed_by: caller,
            scoring_version: scoringRules.scoringVersion
        };

        const { error } = await supabase.from("reference_scores").upsert(payload, {
            onConflict: "reference_id"
        });

        if (error) {
            console.error("Failed to store score result:", error);
            return null;
        }
        console.log("Score stored successfully", payload.domain_scores);
        return true;
    } catch (err) {
        console.error("Failed scoring:", err);
        return null;
    }
};

export const reAssessApplicationScore = async (referenceId: string, caller: Caller, payload: ReAssessmentPayload) => {
    try {
        // FETCH ALL TABLE DATA
        const { data: reference } = await supabase
            .from("tenant_references")
            .select("*")
            .eq("id", referenceId)
            .single();

        if (!reference) throw new Error('Reference not found');


        const credit: CreditFlags = {
            insolvency: payload.credit_flags.insolvency || false,
            ccj: payload.credit_flags.ccj || false,
            deceased: payload.credit_flags.deceased || false,
            electoral: payload.credit_flags.electoral || false
        };

        // AML: true = problem found, false = clear
        // If sanctions_clear is true, no problems found (pep/sanctions = false)
        const isAmlClear = payload.sanctions_clear || false;

        const aml = {
            pep: !isAmlClear,
            sanctions: !isAmlClear
        };

        //RTR
        const rtrPass = payload.rtr_verified || false;

        // RESIDENTIAL
        const residentialStatus: "PASS" | "SKIPPED" | "FAIL" | "AMBER" = payload.res_assessment_status || "FAIL"
        let incomeMultiple = 0;
        if (payload.financial_status !== "FAIL" && !reference?.income_student && !reference?.income_unemployed) {
            const payloadToSanitize: SanitizedIncome = {
                salary: reference.employment_salary_amount_encrypted,
                benefits: reference.benefits_annual_amount_encrypted,
                additional: reference.additional_income_amount_encrypted,
                selfAnnual: reference.self_employed_annual_income_encrypted,
                monthly_rent: reference.monthly_rent || 0,
                additional_income: reference.additional_income_amount_encrypted,
                savings: reference.savings_amount_encrypted,
                is_hourly: reference.employment_is_hourly || false,
                hours_per_month: reference.employment_hours_per_month || 0,
            }
            incomeMultiple = sanitizeIncome(payloadToSanitize);
        }

        // FINAL SCORING
        const scoreData = computeScore({
            credit,
            aml,
            rtr: rtrPass,
            residentialStatus,
            incomeMultiple,
            caller
        });

        return {
            reference_id: referenceId,
            decision: scoreData.decision,
            score_total: scoreData.score_total,
            domain_scores: {
                credit: scoreData.domain_scores.credit,
                aml: scoreData.domain_scores.aml,
                rtr: scoreData.domain_scores.rtr,
                residential: scoreData.domain_scores.residential,
                income: scoreData.domain_scores.income
            },
            ratio: incomeMultiple,
            risk_level: scoreData.risk_level,
            caps: scoreData.gates,
            guarantor_required: scoreData.decision === "PASS_WITH_GUARANTOR",
            scored_at: new Date().toISOString(),
        }

    } catch (err) {
        console.error("Failed scoring:", err);
        return null;
    }
}
