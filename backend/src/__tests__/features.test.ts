import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { computeLoanCost, computeEmi, type AgreementAnalysis } from "@faa/shared";
import { extractLoanTerms } from "../services/loanTerms.service";
import { segmentClauses } from "../services/clauseSegmentation.service";
import { buildClauseAnalysis, classifyClause } from "../services/riskClassifier.service";
import { localizeAgreement, templateExplanation } from "../services/explanations";
import { answerFromAnalysis } from "../services/chatFallback.service";

const SAMPLES = path.resolve(__dirname, "..", "..", "..", "samples");

test("EMI and APR: upfront fees raise the real cost above the advertised rate", () => {
  assert.equal(Math.round(computeEmi(50000, 24, 12)), 4728);
  const result = computeLoanCost({ principal: 50000, annualRatePct: 24, tenureMonths: 12, upfrontFees: 4500 })!;
  assert.equal(result.amountReceived, 45500);
  assert.ok(Math.abs(result.aprPct - 42.84) < 0.1, `APR was ${result.aprPct}`);
  // With no fees, APR equals the nominal rate.
  const noFees = computeLoanCost({ principal: 50000, annualRatePct: 24, tenureMonths: 12, upfrontFees: 0 })!;
  assert.ok(Math.abs(noFees.aprPct - 24) < 0.01);
  assert.equal(computeLoanCost({ principal: 1000, annualRatePct: 10, tenureMonths: 12, upfrontFees: 1000 }), null);
});

test("loan terms are read from an English agreement", () => {
  const terms = extractLoanTerms(
    "This agreement is made between QuickCash Finance Pvt. Ltd. (the Lender) and the Borrower. The loan amount is Rs. 50,000 repayable in 12 monthly instalments. Interest is charged at 24% per annum. A processing fee of Rs. 4,500 will be deducted. Late payments incur penalty fees of 5% per month."
  );
  assert.equal(terms.principal, 50000);
  assert.equal(terms.annualRatePct, 24);
  assert.equal(terms.tenureMonths, 12);
  assert.equal(terms.upfrontFees, 4500);
  assert.equal(terms.latePenaltyMonthlyPct, 5);
  assert.equal(terms.currency, "INR");
  assert.match(terms.lenderName ?? "", /QuickCash Finance/);
  assert.match(terms.sources.principal ?? "", /50,000/);
});

test("Hindi agreement: clauses, risks and loan terms", () => {
  const text = fs.readFileSync(path.join(SAMPLES, "hindi-loan-agreement.txt"), "utf8");
  const clauses = segmentClauses(text);
  assert.equal(clauses.length, 7);
  const categories = clauses.map((c) => classifyClause(c.text).category);
  for (const expected of ["Variable Interest", "Hidden Fees", "Penalty Clause", "Salary Deduction", "Data Misuse & Harassment Risk"]) {
    assert.ok(categories.includes(expected), `missing ${expected}: ${categories.join(", ")}`);
  }
  assert.equal(classifyClause(clauses[6].text).riskLevel, "safe", "prepayment with written notice is safe");

  const terms = extractLoanTerms(text);
  assert.equal(terms.principal, 50000);
  assert.equal(terms.annualRatePct, 24);
  assert.equal(terms.tenureMonths, 12);
  assert.equal(terms.upfrontFees, 4500);
  assert.equal(terms.lenderName, "क्विककैश फाइनेंस प्रा. लि.");
});

test("explanations and chat switch to Hindi", () => {
  const hi = templateExplanation("", "high", "Variable Interest", "hi");
  assert.match(hi.plainEnglish, /ब्याज/);

  const raw = segmentClauses("1. Interest Rate. The lender may adjust the variable interest rate at its sole discretion without notice.\n\n2. Prepayment. You may prepay at any time with 30-day written notice.");
  const clauses = raw.map((r) => {
    const partial = buildClauseAnalysis(r, []);
    return { ...partial, ...templateExplanation(r.text, partial.riskLevel!, partial.category!, "en") } as AgreementAnalysis["clauses"][number];
  });
  const agreement: AgreementAnalysis = {
    id: "a", userId: "u", fileName: "loan.pdf", mimeType: "application/pdf", status: "completed",
    securityFlags: [], extractedText: "", summary: "", negotiationSuggestions: [], deadlines: [],
    scores: { trustScore: 30, consumerFriendliness: 30, transparency: 30, overallRisk: 70 },
    riskCounts: { safe: 1, caution: 0, high: 1 }, createdAt: "", updatedAt: "", clauses,
    language: { document: "eng", explanation: "en" },
  };

  const localized = localizeAgreement(agreement, "hi");
  assert.match(localized.summary, /भरोसा स्कोर/);
  assert.match(localized.clauses[0].plainEnglish, /ब्याज/);
  assert.equal(localized.clauses[0].riskLevel, "high", "risk levels never change with language");

  assert.match(answerFromAnalysis(agreement, "क्या मुझे इस पर हस्ताक्षर करने चाहिए?", "hi"), /नहीं/);
  assert.match(answerFromAnalysis(agreement, "What is the interest rate?", "en"), /1\. Interest Rate/);
});
