/**
 * Compares two ways of deciding whether a clause is harmful, on the same labelled clauses.
 *
 * This exists to answer one question with evidence rather than opinion: should the live risk path
 * be the rule engine, or a learned classifier? ClauseGuard uses TF-IDF with Naive Bayes and reports
 * 66.7% accuracy on 90 examples. The comparison here uses embeddings, which are a stronger
 * representation than TF-IDF, and still measures both against the same set so the result is
 * meaningful rather than a number quoted out of context.
 *
 * The clauses below are labelled by whether the clause is harmful to the borrower, not by whether
 * it mentions money. Several are deliberately awkward: a protective clause that contains the word
 * "penalty", a neutral clause that contains "fee". Those are the cases that separate matching on
 * words from matching on meaning.
 */

import { classifyClause } from "./riskClassifier.service";
import { embedTexts, cosineSimilarity } from "./embedding.service";

type Label = "harmful" | "benign";

interface LabelledClause {
  text: string;
  label: Label;
}

const LABELLED: LabelledClause[] = [
  // ---------- Harmful ----------
  { text: "The lender may revise the rate of interest at its sole discretion without notice to the borrower.", label: "harmful" },
  { text: "A processing fee of Rs. 4,500 shall be deducted from the sanctioned amount before disbursal and is non-refundable under any circumstances.", label: "harmful" },
  { text: "Overdue amounts shall attract a penal charge of 5% per month compounded on the outstanding balance.", label: "harmful" },
  { text: "The borrower grants the lender access to the contacts, photographs and location stored on the borrower's mobile device.", label: "harmful" },
  { text: "The lender may contact the borrower's family members, references and employer to recover any amount due.", label: "harmful" },
  { text: "This agreement shall renew automatically for successive twelve-month periods unless cancelled thirty days in advance.", label: "harmful" },
  { text: "Cancellation of this facility is subject to an administrative charge, the amount of which is not disclosed herein.", label: "harmful" },
  { text: "The borrower authorises the employer to deduct the instalment directly from the borrower's monthly salary.", label: "harmful" },
  { text: "All disputes shall be referred to arbitration at a seat chosen by the lender and the borrower waives the right to approach any court.", label: "harmful" },
  { text: "Prepayment of the loan before the end of the tenure shall attract a foreclosure charge of 6% of the outstanding principal.", label: "harmful" },
  { text: "The lender reserves the right to recall the entire outstanding amount at any time without assigning any reason.", label: "harmful" },
  { text: "Payment shall be made to the agent's personal account by UPI transfer before the loan can be released.", label: "harmful" },
  { text: "Liquidated damages equal to three months' instalments shall be payable if the borrower terminates this agreement early.", label: "harmful" },
  { text: "The borrower shall have no right to dispute any charge debited to the account after a period of seven days.", label: "harmful" },
  { text: "The lender may assign this agreement and all recovery rights to any third party without the borrower's consent.", label: "harmful" },
  { text: "Insurance premium shall be added to the loan amount and charged interest at the same rate as the principal.", label: "harmful" },
  { text: "The borrower waives the right to receive a statement of account unless specifically requested in writing each quarter.", label: "harmful" },
  { text: "Cheque dishonour shall attract a charge of Rs. 750 per instance in addition to the penal interest on the overdue amount.", label: "harmful" },
  { text: "The lender shall not be liable for any loss arising from unauthorised transactions on the borrower's account.", label: "harmful" },
  { text: "Documents furnished by the borrower shall be retained by the lender and shall not be returned upon closure of the loan.", label: "harmful" },

  // ---------- Benign ----------
  { text: "No prepayment penalty shall be charged if the borrower repays the loan in full before the end of the tenure.", label: "benign" },
  { text: "The rate of interest is fixed at 9.5% per annum for the entire tenure and shall not be revised.", label: "benign" },
  { text: "The lender shall provide a statement of account to the borrower on the first day of every month without charge.", label: "benign" },
  { text: "A grace period of fifteen days is allowed after the due date before any late payment charge is levied.", label: "benign" },
  { text: "The borrower may request a change in the instalment date once in each financial year at no cost.", label: "benign" },
  { text: "All fees and charges applicable to this facility are listed in the schedule annexed to this agreement.", label: "benign" },
  { text: "The borrower may close the loan account at any time after giving fifteen days' written notice to the lender.", label: "benign" },
  { text: "Any dispute arising under this agreement shall be subject to the jurisdiction of the courts at the borrower's place of residence.", label: "benign" },
  { text: "The lender shall give thirty days' written notice before any revision to the charges takes effect.", label: "benign" },
  { text: "Repayment shall commence twelve months after completion of the course, and interest during this period is not capitalised.", label: "benign" },
  { text: "The borrower's personal information shall not be shared with any third party except as required by law.", label: "benign" },
  { text: "The security deposit shall be refunded in full within thirty days of handing over vacant possession of the premises.", label: "benign" },
  { text: "The landlord shall carry out all structural repairs to the premises at the landlord's own cost.", label: "benign" },
  { text: "The borrower shall be entitled to a copy of this agreement duly signed by both parties at the time of execution.", label: "benign" },
  { text: "This loan carries no processing fee and no documentation charges of any kind.", label: "benign" },
  { text: "The cardholder shall not be liable for any transaction reported as unauthorised within three days of the statement date.", label: "benign" },
  { text: "The tenant shall pay the monthly rent on or before the fifth day of each calendar month.", label: "benign" },
  { text: "The loan shall be disbursed directly to the educational institution against the fee demand raised each semester.", label: "benign" },
  { text: "Either party may terminate this agreement by giving one month's written notice, without payment of any penalty.", label: "benign" },
  { text: "The borrower may nominate a person to receive the documents in the event of the borrower's demise.", label: "benign" },
];

export interface ApproachMetrics {
  name: string;
  accuracy: number;
  /** Precision, recall and F1 are reported for the harmful class, which is the one that matters. */
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
}

export interface RiskComparison {
  sampleSize: number;
  approaches: ApproachMetrics[];
  /** Clauses the two approaches disagreed on, which is where the design decision is visible. */
  disagreements: { text: string; expected: Label; rules: Label; embeddings: Label }[];
}

export async function evaluateRiskApproaches(): Promise<RiskComparison> {
  const rulePredictions = LABELLED.map((c) => ruleVerdict(c.text));
  const embeddingPredictions = await embeddingVerdicts();

  const disagreements = LABELLED.map((c, i) => ({
    text: c.text,
    expected: c.label,
    rules: rulePredictions[i],
    embeddings: embeddingPredictions[i],
  })).filter((d) => d.rules !== d.embeddings);

  return {
    sampleSize: LABELLED.length,
    approaches: [
      score("Rule engine (27 rules)", rulePredictions),
      score("Embedding k-NN (k=3, LOO)", embeddingPredictions),
    ],
    disagreements,
  };
}

/** The live path: a clause is harmful when the rules rate it caution or high. */
function ruleVerdict(text: string): Label {
  return classifyClause(text).riskLevel === "safe" ? "benign" : "harmful";
}

/**
 * The learned alternative, scored by leave-one-out so no clause is classified against itself.
 * This is the same algorithm as the document-type classifier, applied to a different question.
 */
async function embeddingVerdicts(): Promise<Label[]> {
  const vectors = await embedTexts(LABELLED.map((c) => c.text));

  return LABELLED.map((_, i) => {
    const neighbours = vectors
      .map((v, j) => ({ label: LABELLED[j].label, score: j === i ? -Infinity : cosineSimilarity(vectors[i], v) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const harmful = neighbours.filter((n) => n.label === "harmful").reduce((s, n) => s + Math.max(0, n.score), 0);
    const benign = neighbours.filter((n) => n.label === "benign").reduce((s, n) => s + Math.max(0, n.score), 0);
    return harmful >= benign ? "harmful" : "benign";
  });
}

function score(name: string, predictions: Label[]): ApproachMetrics {
  let tp = 0;
  let fp = 0;
  let tn = 0;
  let fn = 0;

  LABELLED.forEach((c, i) => {
    const predicted = predictions[i];
    if (c.label === "harmful" && predicted === "harmful") tp++;
    else if (c.label === "benign" && predicted === "harmful") fp++;
    else if (c.label === "benign" && predicted === "benign") tn++;
    else fn++;
  });

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return {
    name,
    accuracy: round((tp + tn) / LABELLED.length),
    precision: round(precision),
    recall: round(recall),
    f1: round(precision + recall ? (2 * precision * recall) / (precision + recall) : 0),
    truePositives: tp,
    falsePositives: fp,
    trueNegatives: tn,
    falseNegatives: fn,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
