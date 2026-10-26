import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { classifyClause, computeAgreementScores } from "../services/riskClassifier.service";
import { checkDocument } from "../services/riskRules";
import { segmentClauses } from "../services/clauseSegmentation.service";

const SAMPLES = path.resolve(__dirname, "..", "..", "..", "samples");

// Excerpt of a real user upload: a project description, not a contract.
const PROJECT_DOC = `STUDENT LOAN FINANCIAL ANALYSER
Project Overview & Functional Document

1. Project Overview
Student Loan Financial Analyser is a financial planning tool designed to help students understand, compare, and manage education loans. It estimates repayment obligations, calculates monthly EMIs, shows the total cost of borrowing, and helps users evaluate whether a proposed loan is affordable based on expected income and expenses.

2. Problem Statement
Students often find it difficult to understand loan terms such as interest rates, moratorium periods, capitalised interest, repayment tenure, processing fees, and monthly instalments. Loan information may be scattered across lender documents, making it hard to compare offers or plan repayment.

3. Objectives
Calculate estimated EMI, total repayment, and total interest.
Help students identify key loan terms and questions to confirm with the lender.

6. Main Features / Modules
Loan Offer Comparison: Compares lender offers by rate, fees, moratorium terms, repayment tenure, and estimated EMI.

12. Future Enhancements
Import loan terms from uploaded sanction letters with user verification.`;

test("a project description is not treated as an agreement", () => {
  const check = checkDocument(PROJECT_DOC);
  assert.equal(check.isAgreement, false);
  assert.equal(check.documentType, "report");
});

test("describing loan terms is not the same as agreeing to them", () => {
  const problem = PROJECT_DOC.slice(PROJECT_DOC.indexOf("2. Problem Statement"), PROJECT_DOC.indexOf("3. Objectives"));
  assert.equal(classifyClause(problem).riskLevel, "safe");
  assert.equal(classifyClause("Calculate estimated EMI, total repayment, and total interest.").riskLevel, "safe");
});

test("real loan agreements are recognised, in English and Hindi", () => {
  assert.equal(checkDocument(fs.readFileSync(path.join(SAMPLES, "risky-loan-agreement.txt"), "utf8")).isAgreement, true);
  assert.equal(checkDocument(fs.readFileSync(path.join(SAMPLES, "fair-education-loan.txt"), "utf8")).isAgreement, true);
  assert.equal(checkDocument(fs.readFileSync(path.join(SAMPLES, "hindi-loan-agreement.txt"), "utf8")).isAgreement, true);
});

test("a fair education loan reads as 'check carefully', not as predatory", () => {
  const text = fs.readFileSync(path.join(SAMPLES, "fair-education-loan.txt"), "utf8");
  const clauses = segmentClauses(text).map((c) => ({ ...c, ...classifyClause(c.text) }));
  assert.equal(clauses.filter((c) => c.riskLevel === "high").length, 0);
  const categories = clauses.map((c) => c.category);
  for (const expected of ["Floating Rate", "Interest During Moratorium", "Processing & Other Fees", "Guarantor Liability", "Right of Set-off"]) {
    assert.ok(categories.includes(expected), `missing ${expected}`);
  }
  const scores = computeAgreementScores(clauses as never);
  assert.ok(scores.trustScore >= 60 && scores.trustScore <= 90, `trust ${scores.trustScore}`);
});

test("severity follows real-world practice", () => {
  const cases: [string, string, string][] = [
    ["Processing fee: 2% of the loan amount plus GST.", "caution", "Processing & Other Fees"],
    ["A processing fee of Rs. 4,500 will be deducted from the loan amount and is non-refundable.", "high", "Hidden Fees"],
    ["Interest shall be charged at a floating rate linked to the repo rate.", "caution", "Floating Rate"],
    ["The lender may revise the interest rate at its sole discretion without notice.", "high", "Variable Interest"],
    ["Penal charges of 2% per annum on the overdue amount shall apply.", "caution", "Penalty Clause"],
    ["Late payments incur penalty fees of 5% per month.", "high", "Penalty Clause"],
    ["Foreclosure charges of 4% of the outstanding principal shall apply.", "caution", "Prepayment Charges"],
    ["The Bank reserves the right to recall the entire loan at any time at its sole discretion.", "high", "Loan Recall"],
    ["Your personal data may be shared with our partners and affiliates for marketing.", "caution", "Data Sharing"],
  ];
  for (const [text, level, category] of cases) {
    const r = classifyClause(text);
    assert.equal(r.riskLevel, level, text);
    assert.equal(r.category, category, text);
  }
});

test("protections are not flagged as risks", () => {
  for (const text of [
    "The borrower shall not be charged any prepayment penalty.",
    "No prepayment charges or foreclosure charges shall apply.",
    "The Borrower will not be liable for any charges not disclosed in the Key Fact Statement.",
  ]) {
    assert.equal(classifyClause(text).riskLevel, "safe", text);
  }
});
