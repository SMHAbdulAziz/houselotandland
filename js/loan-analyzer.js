// Fix & flip deal analyzer: a JavaScript port of Harvey's COGO Deal Analyzer (app/analyzer.py, v1.0.1).
// One copy is used by both the public application page (apply.html) and the site Worker (src/loan.js),
// so the estimate an applicant sees and the analysis Harvey sees on the Deal Desk always match.
// The Deal Desk carries the same math in its own script; keep the three in step when a rule changes.

export const RULES = {
  minProfit: 20000,     // $20K minimum net profit
  maxLtvArv: 0.65,      // loan up to 65% of ARV
  maxLtvPurchase: 0.80, // and up to 80% of purchase price (the lower one wins)
  financeCostRate: 0.05,
  publicBrokerFeePct: 1.0, // advertised intro rate (first 3 loans); Harvey can change it per application on the desk
};

export const EXIT_STRATEGIES = {
  mls_listing:  { name: "MLS listing (traditional sale)", agent: 0.055, title: 0.015, misc: 0.01 },
  direct_sale:  { name: "Direct sale (FSBO / off-market)", agent: 0.0, title: 0.015, misc: 0.015 },
  wholesale:    { name: "Wholesale to an investor", agent: 0.0, title: 0.01, misc: 0.005 },
  auction:      { name: "Auction sale", agent: 0.0, title: 0.015, misc: 0.025 },
  lease_option: { name: "Lease option / rent-to-own", agent: 0.02, title: 0.01, misc: 0.015 },
  refinance:    { name: "Refinance and hold (rental)", agent: 0.0, title: 0.015, misc: 0.01 },
};

export const LOAN_TYPES = {
  fix_flip: "Fix and flip",
  bridge: "Bridge (short term, light or no rehab)",
  rental: "Long-term rental (DSCR)",
  construction: "New construction",
  commercial: "Commercial / 5+ units",
};

// States where Harvey does not broker loans (see funding.html).
export const EXCLUDED_STATES = ["UT", "ID", "MN", "AZ", "MA", "NY", "SD", "ND"];

export const BROKER_DOCS = [
  "Broker Fee Agreement", "Loan Application", "Schedule of Real Estate Owned", "Zero Fraud Policy",
  "Secretary of State Verification", "Entity Operating Agreement", "Federal EIN Verification", "Guarantor ID",
  "Social Security Card", "Bank Statements (3 months)", "Federal Tax Returns (2 years)", "State Tax Returns (2 years)",
  "Purchase & Sales Agreement", "P&S Agreement Addendums", "Mortgage Payoff Letter", "Contractor's Liability Insurance",
  "Contractor's License Verification", "Draw Schedule", "Contractor Scope of Work", "CDNA Report",
  "Schedule of Real Estate Sold",
];

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const r2 = (n) => Math.round(n * 100) / 100;

// Same results as DealAnalyzer.calculate_deal_metrics for the fix-and-flip product.
export function analyzeFlip({ arv, purchase_price, rehab, exit_strategy, broker_fee_pct } = {}) {
  const ARV = num(arv), P = num(purchase_price), R = num(rehab);
  if (ARV <= 0 || P <= 0) return null;
  const fee = broker_fee_pct === undefined || broker_fee_pct === null || broker_fee_pct === "" ? RULES.publicBrokerFeePct : num(broker_fee_pct);
  const ex = EXIT_STRATEGIES[exit_strategy] || EXIT_STRATEGIES.mls_listing;
  const maxLoanArv = ARV * RULES.maxLtvArv, maxLoanPurchase = P * RULES.maxLtvPurchase;
  const loan = Math.min(maxLoanArv, maxLoanPurchase);
  const selling = { agent: ARV * ex.agent, title: ARV * ex.title, misc: ARV * ex.misc };
  selling.total = selling.agent + selling.title + selling.misc;
  const brokerFee = loan * fee / 100, financeCosts = loan * RULES.financeCostRate;
  const totalCosts = P + R + selling.total + brokerFee + financeCosts;
  const netProfit = ARV - totalCosts;
  return {
    exitStrategy: exit_strategy in EXIT_STRATEGIES ? exit_strategy : "mls_listing",
    exitStrategyName: ex.name,
    brokerFeePct: fee,
    maxLoanArv: r2(maxLoanArv), maxLoanPurchase: r2(maxLoanPurchase), loanAmount: r2(loan),
    loanLimitedBy: maxLoanPurchase <= maxLoanArv ? "purchase" : "arv",
    cashToClose: r2(Math.max(0, P + R - loan)), // purchase + rehab not covered by the loan (before closing costs)
    selling: { agent: r2(selling.agent), title: r2(selling.title), misc: r2(selling.misc), total: r2(selling.total),
               rate: r2((ex.agent + ex.title + ex.misc) * 100) },
    brokerFee: r2(brokerFee), financeCosts: r2(financeCosts), totalCosts: r2(totalCosts),
    netProfit: r2(netProfit), profitMargin: r2(ARV ? netProfit / ARV * 100 : 0),
    minProfit: RULES.minProfit, profitSurplus: r2(netProfit - RULES.minProfit),
    eligible: netProfit >= RULES.minProfit,
  };
}
