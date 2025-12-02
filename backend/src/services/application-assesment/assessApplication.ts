import { supabase } from "../../config/supabase";
import { decrypt } from "../encryption";
import { computeScore, scoringRules, computeIncomeMultiple } from "./computeScore";

export const assessApplicationScore = async (referenceId: string,caller: 'System' | 'Staff',scoredBy: string | null = null) => {
    try {
        // FETCH ALL TABLE DATA
        const { data: reference } = await supabase
            .from("tenant_references")
            .select("*")
            .eq("id", referenceId)
            .single();

        const { data: creditsafe } = await supabase
            .from("creditsafe_verifications")
            .select("*")
            .eq("reference_id", referenceId)
            .single();

        const { data: sanctions } = await supabase
            .from("sanctions_screenings")
            .select("*")
            .eq("reference_id", referenceId)
            .single();

        let flags: any = {};
        try {
            flags = JSON.parse(creditsafe?.fraud_indicators || '{}');
        }
        catch (err) {
            console.error("Failed to parse creditsafe fraud indicators:", err);
        }

        const credit = {
            insolvency: flags?.insolvencyMatch || false,
            ccj: flags?.ccjMatch || false,
            deceased: flags?.deceasedMatch || false,
            electoral: flags?.electoralRollMatch || false
        };

        const isAlmlClear = sanctions?.risk_level === 'clear' || Array.isArray(sanctions?.sanctions_matches) && sanctions?.sanctions_matches.length === 0;

        const aml = {
            pep: isAlmlClear,
            sanctions: isAlmlClear
        };

        //RTR
        const rtrPass = reference?.is_british_citizen;

        // RESIDENTIAL
        let residentialStatus: "PASS" | "SKIPPED" | "FAIL" = "SKIPPED";

        if (reference?.reference_type === "living_with_family") {
            residentialStatus = "PASS";
        } else if (!reference?.time_at_address_years && !reference?.time_at_address_months) {
            residentialStatus = "SKIPPED"; // default fail
        }

        let incomeMultiple = 0;
        if (!reference?.income_student && !reference?.income_unemployed) {
            const salary = reference.employment_salary_amount || 0;
            const benefits = parseFloat(decrypt(reference.benefits_annual_amount_encrypted) || '0');
            const additional = parseFloat(decrypt(reference.additional_income_amount_encrypted) || '0');
            const selfAnnual = parseFloat(decrypt(reference.self_employed_annual_income_encrypted) || '0');
            const rent = reference.monthly_rent || 0;

            incomeMultiple = computeIncomeMultiple({
                salary,
                benefits,
                additional,
                selfEmployedAnnual: selfAnnual,
                rent
            });
        }

        // FINAL SCORING
        const scoreData = computeScore({
            credit,
            aml,
            rtr: rtrPass,
            residentialStatus,
            incomeMultiple
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
   
        return true;
    } catch (err) {
        console.error("Failed scoring:", err);
        return null;
    }
};
