export const scoringRules = {
  baseScore: 999,

  credit: {
    insolvency: -150,
    ccj: -120,
    deceased: -300,
    notOnElectoralRoll: -30
  },

  aml: {
    pep: -200,
    sanctions: -300
  },

  rtr: {
    notVerified: -40,
    failGate: "RTR_FAIL"
  },

  residential: {
    fail: -300,
    amber: -150,
    failGate: "RES_REF_FAIL"
  },

  income: {
    bands: [
      { min: 3.0, deduction: 0, band: "3x" },
      { min: 2.5, deduction: -69, band: "2.5x" },
      { min: 0, deduction: -189, band: "below_2.5x" }
    ]
  },

  failConditions: {
    minAllowedFails: 2,
    failGate: "CREDIT_AML_2PLUS_FAILS",
    minScore: 650,
    lowScoreGate: "SCORE_BELOW_MIN"
  },

  decisions: {
    superb: { failCount: 0, resStatus: "PASS", incomeBand: "3x" },
    passBands: ["3x", "2.5x"]
  },

  scoringVersion: "2.0"
};


export const computeIncomeMultiple = ({
  salary,
  benefits,
  additional,
  selfEmployedAnnual,
  rent,
  additionalIncome,
  savings
}: {
  salary: number;
  benefits: number;
  additional: number;
  selfEmployedAnnual: number;
  rent: number;
  additionalIncome: number;
  savings: number;
}) => {
  if (!rent || rent <= 0) return 0;

  const monthlySelfEmployed = selfEmployedAnnual / 12;

  const monthlyIncome =
    (salary || 0) +
    (benefits || 0) +
    (additional || 0) +
    (additionalIncome || 0) +
    (savings || 0) +
    (monthlySelfEmployed || 0);

  return monthlyIncome / rent;
};
interface Input {
  credit: {
    insolvency: boolean | null;
    ccj: boolean | null;
    deceased: boolean | null;
    electoral: boolean | null;
  };
  aml: {
    pep: boolean | null;
    sanctions: boolean | null;
  };
  rtr: boolean | null;
  residentialStatus: "PASS" | "SKIPPED" | "FAIL" | "AMBER";
  incomeMultiple: number;
  caller: "System" | "Staff";
}

export const computeScore = ({
  credit,
  aml,
  rtr,
  residentialStatus,
  incomeMultiple,
  caller
}: Input) => {
  const R = scoringRules;

  // Start at base score (999), deduct for problems
  let totalScore = R.baseScore;

  // Domain deductions (track separately for reporting)
  let creditDeductions = 0;
  let amlDeductions = 0;
  let rtrDeductions = 0;
  let residentialDeductions = 0;
  let incomeDeductions = 0;

  // Fail tracking
  let failCount = 0;
  let gates: string[] = [];
  let incomeBand = "below_2.5x";
  let risk_level = 'low';

  // CREDIT - only deduct if problem found (true), skip if null/pending
  if (credit.insolvency === true) {
    creditDeductions += R.credit.insolvency;
    failCount++;
  }

  if (credit.ccj === true) {
    creditDeductions += R.credit.ccj;
    failCount++;
  }

  if (credit.deceased === true) {
    // Deceased match is an immediate fail
    return {
      score_total: 0,
      risk_level: 'very_high',
      domain_scores: {
        credit: R.credit.deceased,
        aml: 0,
        rtr: 0,
        residential: 0,
        income: 0
      },
      failCount: 1,
      incomeBand: 'below_2.5x',
      gates: ['DECEASED_MATCH'],
      decision: 'FAIL'
    };
  }

  if (credit.electoral === false) {
    creditDeductions += R.credit.notOnElectoralRoll;
  }

  // AML - only deduct if problem found (true), skip if null/pending
  if (aml.pep === true) {
    amlDeductions += R.aml.pep;
    failCount++;
  }

  if (aml.sanctions === true) {
    amlDeductions += R.aml.sanctions;
    failCount++;
  }

  // RTR - deduct if explicitly not verified
  if (rtr === false) {
    rtrDeductions += R.rtr.notVerified;
    if (caller === "Staff") {
      gates.push(R.rtr.failGate);
    }
  }

  // RESIDENTIAL
  if (residentialStatus === "FAIL") {
    residentialDeductions += R.residential.fail;
    gates.push(R.residential.failGate);
  } else if (residentialStatus === "AMBER") {
    residentialDeductions += R.residential.amber;
  }
  // PASS and SKIPPED = no deduction

  // INCOME
  for (const band of R.income.bands) {
    if (incomeMultiple >= band.min) {
      incomeDeductions += band.deduction;
      incomeBand = band.band;
      break;
    }
  }

  // Apply all deductions
  totalScore += creditDeductions + amlDeductions + rtrDeductions + residentialDeductions + incomeDeductions;

  // FAIL CONDITIONS
  if (failCount >= R.failConditions.minAllowedFails) {
    gates.push(R.failConditions.failGate);
  }

  if (totalScore < R.failConditions.minScore) {
    gates.push(R.failConditions.lowScoreGate);
  }

  // DECISION
  let decision = "FAIL";

  if (gates.length > 0) {
    decision = "FAIL";
  } else {
    const d = R.decisions;

    if (
      failCount === d.superb.failCount &&
      residentialStatus === d.superb.resStatus &&
      incomeBand === d.superb.incomeBand
    ) {
      decision = "SUPERB";
    } else if (d.passBands.includes(incomeBand)) {
      decision = "PASS";
    } else {
      decision = "PASS_WITH_GUARANTOR";
    }
  }

  // Risk level based on score
  if (totalScore <= 0) {
    risk_level = 'very_high';
  } else if (totalScore < 650) {
    risk_level = 'high';
  } else if (totalScore < 800) {
    risk_level = 'medium';
  } else {
    risk_level = 'low';
  }

  return {
    score_total: totalScore,
    risk_level,

    // Domain scores (showing deductions applied)
    domain_scores: {
      credit: creditDeductions,
      aml: amlDeductions,
      rtr: rtrDeductions,
      residential: residentialDeductions,
      income: incomeDeductions
    },

    failCount,
    incomeBand,
    gates,
    decision
  };
};

