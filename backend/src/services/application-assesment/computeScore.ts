export const scoringRules = {
  credit: {
    insolvency: { pass: 90, fail: -150 },
    ccj: { pass: 90, fail: -120 },
    deceased: { pass: 90, fail: -300 },
    electoral: { pass: 30, fail: 0 }
  },

  aml: {
    pep: { pass: 80, fail: -200 },
    sanctions: { pass: 80, fail: -300 }
  },

  rtr: {
    pass: 40,
    failGate: "RTR_FAIL"
  },

  residential: {
    fullPassScore: 250,
    amberPassScore: 100,
    failScore: -300,
    failGate: "RES_REF_FAIL"
  },

  income: {
    bands: [
      { min: 3.0, score: 249, band: "3x" },
      { min: 2.5, score: 180, band: "2.5x" },
      { min: 0, score: 60, band: "below_2.5x" }
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

  scoringVersion: "1.0"
};


export const computeIncomeMultiple = ({
  salary,
  benefits,
  additional,
  selfEmployedAnnual,
  rent
}: {
  salary: number;
  benefits: number;
  additional: number;
  selfEmployedAnnual: number;
  rent: number;
}) => {
  if (!rent || rent <= 0) return 0;

  const monthlySelfEmployed = selfEmployedAnnual / 12;

  const monthlyIncome =
    (salary || 0) +
    (benefits || 0) +
    (additional || 0) +
    (monthlySelfEmployed || 0);

  return monthlyIncome / rent;
};

export const computeScore = ({
  credit,
  aml,
  rtr,
  residentialStatus,
  incomeMultiple
}: {
  credit: {
    insolvency: boolean;
    ccj: boolean;
    deceased: boolean;
    electoral: boolean;
  };
  aml: {
    pep: boolean;
    sanctions: boolean;
  };
  rtr: boolean;
  residentialStatus: "PASS" | "SKIPPED" | "FAIL" | "AMBER";
  incomeMultiple: number;
}) => {
  debugger
  const R = scoringRules;

  // Domain Scores
  let creditScore = 0;
  let amlScore = 0;
  let rtrScore = 0;
  let residentialScore = 0;
  let incomeScore = 0;

  // Fail tracking
  let failCount = 0;
  let gates: string[] = [];
  let incomeBand = "below_2.5x";
  let risk_level = 'high'

  // CREDIT
  creditScore += credit.insolvency ? R.credit.insolvency.fail : R.credit.insolvency.pass;
  if (credit.insolvency) failCount++;

  creditScore += credit.ccj ? R.credit.ccj.fail : R.credit.ccj.pass;
  if (credit.ccj) failCount++;

  creditScore += credit.deceased ? R.credit.deceased.fail : R.credit.deceased.pass;
  if (credit.deceased) {
    failCount++
    return {
      score_total: 0,
      risk_level: 'very_high',

      domain_scores: {
        credit: 0,
        aml: 0,
        rtr: 0,
        residential: 0,
        income: 0
      },

      failCount: 1,
      incomeBand: 'below_2.5x',
      gates: [],
      decision: 'FAIL'
    };
  }

  creditScore += credit.electoral ? R.credit.electoral.pass : R.credit.electoral.fail;

  // AML
  amlScore += aml.pep ? R.aml.pep.pass : R.aml.pep.fail;
  if (!aml.pep) failCount++;

  amlScore += aml.sanctions ? R.aml.sanctions.pass : R.aml.sanctions.fail;
  if (!aml.sanctions) failCount++;

  // RTR (System does not add gate: will be added at staff portal)
  if (rtr) rtrScore += R.rtr.pass;

  // RESIDENTIAL
  if (residentialStatus === "PASS") {
    residentialScore += R.residential.fullPassScore;
  } else if (residentialStatus === "AMBER") {
    residentialScore += R.residential.amberPassScore;
  } else if (residentialStatus === "FAIL") {
    residentialScore += R.residential.failScore;
    gates.push(R.residential.failGate);
  }

  // INCOME
  for (const band of R.income.bands) {
    if (incomeMultiple >= band.min) {
      incomeScore += band.score;
      incomeBand = band.band;
      break;
    }
  }

  // FAIL CONDITIONS
  if (failCount >= R.failConditions.minAllowedFails) {
    gates.push(R.failConditions.failGate);
  }

  const totalScore =
    creditScore + amlScore + rtrScore + residentialScore + incomeScore;

  if (totalScore < R.failConditions.minScore) {
    gates.push(R.failConditions.lowScoreGate);
  }

  // DECISION
  let decision = "FAIL";

  if (gates.length > 0) {
    decision = "FAIL";
  }
  else {
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

  if (totalScore <= 0) {
    risk_level = 'very_high';
  }
  else if (totalScore < 650) {
    risk_level = 'high';
  }
  else if (totalScore < 800) {
    risk_level = 'medium';
  }
  else {
    risk_level = 'low';
  }

  return {
    score_total: totalScore,
    risk_level,

    // NEW: returning all domain scores separately
    domain_scores: {
      credit: creditScore,
      aml: amlScore,
      rtr: rtrScore,
      residential: residentialScore,
      income: incomeScore
    },

    failCount,
    incomeBand,
    gates,
    decision
  };
};

