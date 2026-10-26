/**
 * Predicts which kind of agreement a document is.
 *
 * ClauseGuard, the reference implementation, trains TF-IDF + SVM on hand-written examples and
 * reports 91.7% accuracy over 60 of them. Its examples are United States consumer finance —
 * dollar instalments, FHA and VA mortgages, street addresses — which transfers poorly to an Indian
 * agreement, so the examples below were rewritten for Indian lending and tenancy.
 *
 * The classifier itself is k-nearest-neighbour over the sentence embeddings the project already
 * computes for retrieval. TF-IDF matches on shared words; embeddings match on meaning, so a
 * document that says "lessee" is still recognised when every example says "tenant". It also adds
 * no dependency and no training step: the examples are embedded once and cached.
 *
 * `evaluate()` scores it by leave-one-out cross-validation, which is what the ML metrics endpoint
 * reports. Nothing here is trusted blindly: the prediction is a label shown to the reader, and the
 * risk rules never consult it.
 */

import { embedTexts, cosineSimilarity } from "./embedding.service";
import type { AgreementKind } from "@faa/shared";

/** Nearest neighbours consulted. Three is enough to outvote a single unusual example. */
const K = 3;

/** Below this the document is reported as unknown rather than guessed at. */
const MIN_CONFIDENCE = 0.3;

interface Example {
  text: string;
  label: AgreementKind;
}

const EXAMPLES: Example[] = [
  // ---------- Personal and consumer loans ----------
  { text: "This personal loan agreement is made between the lender and the borrower for a principal sum of Rs. 50,000 repayable in 12 monthly instalments.", label: "personal-loan" },
  { text: "The borrower shall repay the loan amount together with interest at 24% per annum through equated monthly instalments.", label: "personal-loan" },
  { text: "A processing fee shall be deducted from the sanctioned amount before disbursal of the loan to the borrower's bank account.", label: "personal-loan" },
  { text: "Instant personal loan sanctioned through the mobile application, disbursed within 24 hours to the registered account.", label: "personal-loan" },
  { text: "The borrower authorises the lender to present the electronic mandate for recovery of each monthly instalment on the due date.", label: "personal-loan" },
  { text: "Gold loan agreement against pledged ornaments with repayment of principal and interest on or before the maturity date.", label: "personal-loan" },
  { text: "Two-wheeler loan for purchase of the hypothecated vehicle, repayable over 36 months with the vehicle as security.", label: "personal-loan" },
  { text: "Consumer durable loan for purchase of household appliances on a no-cost equated monthly instalment scheme.", label: "personal-loan" },
  { text: "Salary advance facility recoverable directly from the borrower's monthly salary credited by the employer.", label: "personal-loan" },
  { text: "Overdue instalments shall attract a penal charge calculated per month on the outstanding principal until regularised.", label: "personal-loan" },
  { text: "The lender may revise the floating rate of interest at its sole discretion and the borrower shall be bound by the revised rate.", label: "personal-loan" },
  { text: "Business loan to the proprietor for working capital requirements, secured by a personal guarantee of the promoter.", label: "personal-loan" },

  // ---------- Education loans ----------
  { text: "This education loan agreement covers tuition fees, examination fees and hostel charges for the student's approved course of study.", label: "education-loan" },
  { text: "Repayment shall commence after the moratorium period, being course duration plus twelve months from completion of the course.", label: "education-loan" },
  { text: "Simple interest accrued during the moratorium period shall be capitalised and added to the principal on commencement of repayment.", label: "education-loan" },
  { text: "The student borrower and the parent co-borrower shall be jointly and severally liable for repayment of the education loan.", label: "education-loan" },
  { text: "Loan sanctioned for pursuing a postgraduate programme at a recognised institution, disbursed directly to the college each semester.", label: "education-loan" },
  { text: "Education loans above Rs. 7.5 lakh require collateral security acceptable to the bank in addition to the parental guarantee.", label: "education-loan" },
  { text: "Interest subsidy under the central scheme is available to eligible students during the moratorium period subject to income criteria.", label: "education-loan" },
  { text: "Disbursement shall be made in instalments aligned with the fee demand raised by the educational institution each academic year.", label: "education-loan" },
  { text: "The student shall furnish evidence of satisfactory academic progress and continued enrolment before each subsequent disbursement.", label: "education-loan" },
  { text: "Loan for overseas studies covering tuition, travel and living expenses, repayable over 15 years after the moratorium.", label: "education-loan" },
  { text: "No prepayment penalty shall apply if the student repays the education loan in full before the end of the repayment tenure.", label: "education-loan" },
  { text: "Skill development loan for a vocational training programme of less than one year with a shorter repayment schedule.", label: "education-loan" },

  // ---------- Lease and rental agreements ----------
  { text: "This leave and licence agreement is executed between the licensor and the licensee for residential premises for a term of eleven months.", label: "lease" },
  { text: "The tenant shall pay a monthly rent of Rs. 18,000 on or before the fifth day of each calendar month.", label: "lease" },
  { text: "An interest-free refundable security deposit equal to three months' rent shall be paid before taking possession of the premises.", label: "lease" },
  { text: "The landlord shall carry out structural repairs while the tenant shall bear the cost of day-to-day minor repairs.", label: "lease" },
  { text: "Rent shall be enhanced by five per cent upon each renewal of the tenancy for a further term.", label: "lease" },
  { text: "The licensee shall not sublet, assign or part with possession of the said premises without the prior written consent of the licensor.", label: "lease" },
  { text: "Commercial lease of office premises admeasuring 1,200 square feet together with two reserved car parking spaces.", label: "lease" },
  { text: "The tenant shall pay electricity, water and maintenance charges to the society directly in addition to the monthly rent.", label: "lease" },
  { text: "Either party may terminate this tenancy by giving one month's written notice to the other party.", label: "lease" },
  { text: "The premises shall be used solely for residential purposes and for no other purpose whatsoever.", label: "lease" },
  { text: "On expiry of the licence period the licensee shall hand over vacant and peaceful possession of the premises to the licensor.", label: "lease" },
  { text: "The lessee shall maintain the leased equipment in good working condition and bear the cost of insurance during the lease term.", label: "lease" },

  // ---------- Credit card terms ----------
  { text: "These credit card terms and conditions govern the use of the card issued by the bank to the primary cardholder.", label: "credit-card" },
  { text: "Finance charges shall be levied on the outstanding balance if the total amount due is not paid by the payment due date.", label: "credit-card" },
  { text: "The cardholder may convert eligible transactions into equated monthly instalments subject to a conversion fee.", label: "credit-card" },
  { text: "A cash advance from an automated teller machine attracts a cash withdrawal fee and finance charges from the date of withdrawal.", label: "credit-card" },
  { text: "The minimum amount due is five per cent of the total outstanding balance plus any unpaid minimum from previous statements.", label: "credit-card" },
  { text: "The annual fee shall be reversed if the cardholder spends the specified amount during the preceding card anniversary year.", label: "credit-card" },
  { text: "Reward points accrue on eligible retail spends and lapse if the card account remains inactive or is closed.", label: "credit-card" },
  { text: "The bank may enhance or reduce the credit limit assigned to the card account at its discretion after review.", label: "credit-card" },
  { text: "Transactions in foreign currency shall attract a mark-up fee on the converted rupee amount billed to the card account.", label: "credit-card" },
  { text: "The cardholder shall report loss or theft of the card immediately, after which liability for subsequent transactions ceases.", label: "credit-card" },
  { text: "A late payment charge is levied when the minimum amount due is not received by the due date shown on the statement.", label: "credit-card" },
  { text: "The statement is generated on the billing date each month and payment falls due twenty days thereafter.", label: "credit-card" },
];

export interface DocumentTypePrediction {
  label: AgreementKind;
  /** Vote share of the winning label among the k nearest examples, weighted by similarity. */
  confidence: number;
}

let vectorCache: Promise<Float32Array[]> | null = null;

function exampleVectors(): Promise<Float32Array[]> {
  if (!vectorCache) {
    vectorCache = embedTexts(EXAMPLES.map((e) => e.text));
    vectorCache.catch(() => {
      vectorCache = null;
    });
  }
  return vectorCache;
}

/**
 * Predicts the kind of agreement from a sample of its text.
 * Returns "unknown" when the model is unavailable or no label is clearly ahead.
 */
export async function classifyDocumentType(text: string): Promise<DocumentTypePrediction> {
  const sample = text.replace(/\s+/g, " ").trim().slice(0, 3000);
  if (sample.length < 120) return { label: "unknown", confidence: 0 };

  try {
    const vectors = await exampleVectors();
    const [queryVector] = await embedTexts([sample]);
    return classifyAgainst(queryVector, vectors, EXAMPLES.map((e) => e.label));
  } catch (e) {
    console.warn("Document type classification unavailable", e);
    return { label: "unknown", confidence: 0 };
  }
}

/** The k-nearest-neighbour vote itself, separated so cross-validation can reuse it. */
function classifyAgainst(query: Float32Array, vectors: Float32Array[], labels: AgreementKind[]): DocumentTypePrediction {
  const neighbours = vectors
    .map((v, i) => ({ label: labels[i], score: cosineSimilarity(query, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, K);

  // Weighting by similarity lets a close neighbour outweigh two distant ones.
  const weights = new Map<AgreementKind, number>();
  let total = 0;
  for (const n of neighbours) {
    const weight = Math.max(0, n.score);
    weights.set(n.label, (weights.get(n.label) ?? 0) + weight);
    total += weight;
  }

  let best: { label: AgreementKind; weight: number } = { label: "unknown", weight: 0 };
  for (const [label, weight] of weights) if (weight > best.weight) best = { label, weight };

  const confidence = total > 0 ? best.weight / total : 0;
  if (confidence < MIN_CONFIDENCE) return { label: "unknown", confidence: Math.round(confidence * 100) / 100 };
  return { label: best.label, confidence: Math.round(confidence * 100) / 100 };
}

export interface ClassifierMetrics {
  model: string;
  method: string;
  sampleSize: number;
  accuracy: number;
  perLabel: Record<string, { precision: number; recall: number; f1: number; support: number }>;
  confusion: Record<string, Record<string, number>>;
}

/**
 * Leave-one-out cross-validation: every example is classified against all the others.
 * With a small hand-built set this is the honest way to report accuracy — a single train/test
 * split of 60 examples puts only 12 in the test set, so one mistake moves the figure by 8 points.
 */
export async function evaluateDocumentTypeClassifier(): Promise<ClassifierMetrics> {
  const vectors = await exampleVectors();
  const labels = EXAMPLES.map((e) => e.label);
  const classes = [...new Set(labels)];

  const confusion: Record<string, Record<string, number>> = {};
  for (const actual of classes) {
    confusion[actual] = {};
    for (const predicted of [...classes, "unknown"]) confusion[actual][predicted] = 0;
  }

  let correct = 0;
  for (let i = 0; i < EXAMPLES.length; i++) {
    const heldOutVectors = vectors.filter((_, j) => j !== i);
    const heldOutLabels = labels.filter((_, j) => j !== i);
    const { label } = classifyAgainst(vectors[i], heldOutVectors, heldOutLabels);
    confusion[labels[i]][label] = (confusion[labels[i]][label] ?? 0) + 1;
    if (label === labels[i]) correct++;
  }

  const perLabel: ClassifierMetrics["perLabel"] = {};
  for (const cls of classes) {
    const support = labels.filter((l) => l === cls).length;
    const truePositive = confusion[cls][cls];
    const predicted = classes.reduce((sum, actual) => sum + (confusion[actual][cls] ?? 0), 0);
    const precision = predicted ? truePositive / predicted : 0;
    const recall = support ? truePositive / support : 0;
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
    perLabel[cls] = { precision: round(precision), recall: round(recall), f1: round(f1), support };
  }

  return {
    model: "all-MiniLM-L6-v2",
    method: `k-nearest-neighbour (k=${K}), leave-one-out cross-validation`,
    sampleSize: EXAMPLES.length,
    accuracy: round(correct / EXAMPLES.length),
    perLabel,
    confusion,
  };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
