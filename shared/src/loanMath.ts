export interface LoanCostInput {
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  upfrontFees: number;
}

export interface LoanCostResult {
  emi: number;
  totalRepayment: number;
  totalInterest: number;
  /** What the borrower actually receives after upfront fees. */
  amountReceived: number;
  /** Everything paid beyond the amount received: interest plus fees. */
  totalCostOfCredit: number;
  /** Annual percentage rate including fees (nominal, monthly compounding x 12). */
  aprPct: number;
  /** Effective annual rate including fees: (1 + monthly)^12 - 1. */
  effectiveAnnualPct: number;
}

/** Standard reducing-balance EMI. */
export function computeEmi(principal: number, annualRatePct: number, tenureMonths: number): number {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / tenureMonths;
  const f = Math.pow(1 + r, tenureMonths);
  return (principal * r * f) / (f - 1);
}

/**
 * True cost of a loan. The APR is the monthly rate at which the amount actually received equals
 * the present value of all EMIs (solved by bisection), so upfront fees raise it above the headline rate.
 */
export function computeLoanCost(input: LoanCostInput): LoanCostResult | null {
  const { principal, annualRatePct, tenureMonths, upfrontFees } = input;
  if (!(principal > 0) || !(tenureMonths >= 1) || !(annualRatePct >= 0) || !(upfrontFees >= 0)) return null;
  if (upfrontFees >= principal) return null;

  const emi = computeEmi(principal, annualRatePct, tenureMonths);
  const totalRepayment = emi * tenureMonths;
  const amountReceived = principal - upfrontFees;

  const presentValue = (monthly: number) =>
    monthly === 0 ? emi * tenureMonths : (emi * (1 - Math.pow(1 + monthly, -tenureMonths))) / monthly;
  let lo = 0;
  let hi = 1; // 100% per month upper bound
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (presentValue(mid) > amountReceived) lo = mid;
    else hi = mid;
  }
  const monthly = (lo + hi) / 2;

  return {
    emi: round2(emi),
    totalRepayment: round2(totalRepayment),
    totalInterest: round2(totalRepayment - principal),
    amountReceived: round2(amountReceived),
    totalCostOfCredit: round2(totalRepayment - amountReceived),
    aprPct: round2(monthly * 12 * 100),
    effectiveAnnualPct: round2((Math.pow(1 + monthly, 12) - 1) * 100),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
