import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";

// Must be set before the storage layer is imported, since it resolves DATA_DIR at module load.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "faa-retrieval-"));
process.env.DATA_DIR = tmp;
process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
delete process.env.SUPABASE_URL;

import { chunkText, splitSentences } from "../services/chunking.service";
import { embedTexts, cosineSimilarity } from "../services/embedding.service";

// The storage layer resolves DATA_DIR when it loads, so it is imported after the environment is set.
let index: typeof import("../services/semanticIndex.service");
before(async () => {
  index = await import("../services/semanticIndex.service");
});

const SAMPLES = path.resolve(__dirname, "..", "..", "..", "samples");
const AGREEMENT = fs.readFileSync(path.join(SAMPLES, "risky-loan-agreement.txt"), "utf8");
/** The individual samples are short by design; chunking only has work to do on a full-length document. */
const LONG_AGREEMENT = [
  fs.readFileSync(path.join(SAMPLES, "fair-education-loan.txt"), "utf8"),
  AGREEMENT,
].join("\n\n");

test("sentence splitting keeps rupee amounts and clause references intact", () => {
  const text = "The fee is Rs. 4,500 and is non-refundable. See Clause No. 7.2 for details. The rate may change.";
  const sentences = splitSentences(text);
  assert.equal(sentences.length, 3);
  assert.ok(sentences[0].text.includes("Rs. 4,500"), "Rs. must not end a sentence");
  assert.ok(sentences[1].text.includes("No. 7.2"), "No. and a decimal must not end a sentence");
});

test("sentence splitting handles the Devanagari danda", () => {
  const sentences = splitSentences("ब्याज दर बदल सकती है। शुल्क वापस नहीं होगा।");
  assert.equal(sentences.length, 2);
});

test("chunks overlap, respect the minimum size and keep exact character ranges", () => {
  const chunks = chunkText(LONG_AGREEMENT);
  assert.ok(chunks.length >= 2, `expected several chunks, got ${chunks.length}`);

  for (const chunk of chunks) {
    assert.ok(chunk.end > chunk.start, "range must be non-empty");
    assert.ok(chunk.end <= LONG_AGREEMENT.length, "range must stay inside the document");
    // The range is what lets a retrieved passage be highlighted on the original page.
    const source = LONG_AGREEMENT.slice(chunk.start, chunk.end).replace(/\s+/g, " ").trim();
    assert.ok(source.length > 0, "range must address real text");
  }

  // Consecutive chunks overlap, so a sentence on a boundary is reachable from either side.
  const overlapping = chunks.slice(1).filter((c, i) => c.start < chunks[i].end);
  assert.ok(overlapping.length >= chunks.length - 2, "consecutive chunks should overlap");

  const tooSmall = chunks.filter((c) => c.text.length < 300 && c.index !== chunks.length - 1);
  assert.equal(tooSmall.length, 0, "short chunks should have been merged");
});

test("embeddings are normalised and rank a question against the right clause", async () => {
  const clauses = [
    "The Borrower shall pay a processing fee of 9% which is deducted from the sanctioned amount before disbursal.",
    "The Lender may contact the Borrower's family members, employer and phone contacts to recover any overdue amount.",
    "The premises shall be maintained by the Tenant in good and habitable repair throughout the term.",
  ];
  const vectors = await embedTexts(clauses);

  assert.equal(vectors.length, 3);
  assert.equal(vectors[0].length, 384);

  // Normalised vectors have unit length, which is what makes the dot product a cosine.
  const magnitude = Math.sqrt(vectors[0].reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(magnitude - 1) < 1e-3, `expected unit length, got ${magnitude}`);

  const [query] = await embedTexts(["Will they call my relatives if I miss a payment?"]);
  const scores = vectors.map((v) => cosineSimilarity(query, v));
  const best = scores.indexOf(Math.max(...scores));

  assert.equal(best, 1, `harassment clause should rank first, scores were ${scores.map((s) => s.toFixed(2))}`);
  assert.ok(scores[1] > scores[2] + 0.1, "the unrelated tenancy clause should score clearly lower");
});

test("retrieval finds a fee question in the real sample agreement", async () => {
  const chunks = chunkText(AGREEMENT);
  const vectors = await embedTexts(chunks.map((c) => c.text));
  const [query] = await embedTexts(["What fees are deducted before I receive the money?"]);

  const ranked = chunks
    .map((c, i) => ({ chunk: c, score: cosineSimilarity(query, vectors[i]) }))
    .sort((a, b) => b.score - a.score);

  assert.ok(ranked[0].score > 0.2, `top match too weak: ${ranked[0].score.toFixed(2)}`);
  const top = ranked.slice(0, 3).map((r) => r.chunk.text.toLowerCase()).join(" ");
  assert.ok(/fee|charge|deduct/.test(top), "a fee question should retrieve the fee passage");
});

test("the index round-trips through encrypted storage and answers a question", async () => {
  const id = crypto.randomUUID();
  const count = await index.buildSemanticIndex(id, LONG_AGREEMENT);
  assert.ok(count >= 2, `expected the document to be indexed, got ${count} chunks`);

  // The stored index must be unreadable on disk: it holds the borrower's own sentences.
  const onDisk = fs.readFileSync(path.join(tmp, "indexes", `${id}.bin`));
  assert.ok(!onDisk.toString("utf8").includes("Borrower"), "index must not be stored in clear text");

  const hits = await index.querySemanticIndex(id, "what penalty applies if I repay the loan early?", 3);
  assert.ok(hits.length > 0, "retrieval should return passages");
  assert.ok(hits[0].score >= 0.2, `weak top score: ${hits[0].score.toFixed(2)}`);
  assert.ok(hits[0].score >= hits[hits.length - 1].score, "results must be ranked by similarity");

  // Ranges survive storage, so a retrieved passage can still be highlighted on the page.
  const quoted = LONG_AGREEMENT.slice(hits[0].start, hits[0].end).replace(/\s+/g, " ").trim();
  assert.ok(quoted.length > 0 && LONG_AGREEMENT.includes(quoted.slice(0, 40)), "range must address the source text");

  assert.deepEqual(await index.querySemanticIndex(crypto.randomUUID(), "anything", 3), [], "an unindexed document returns nothing");
});

test("the document-type classifier recognises each kind of agreement", async () => {
  const { classifyDocumentType, evaluateDocumentTypeClassifier } = await import("../services/documentType.service");

  const cases: [string, string][] = [
    ["This education loan covers tuition and hostel fees; repayment begins after the moratorium period of twelve months following completion of the course.", "education-loan"],
    ["The tenant shall pay a monthly rent of Rs. 18,000 and a refundable security deposit of three months' rent before taking possession of the flat.", "lease"],
    ["Finance charges apply to the outstanding balance on the card if the total amount due is not paid by the statement payment due date.", "credit-card"],
    ["The borrower shall repay the sanctioned personal loan of Rs. 50,000 with interest in twelve equated monthly instalments by electronic mandate.", "personal-loan"],
  ];

  for (const [text, expected] of cases) {
    const { label, confidence } = await classifyDocumentType(text);
    assert.equal(label, expected, `"${text.slice(0, 40)}..." was classified ${label}`);
    assert.ok(confidence > 0.3, `confidence too low: ${confidence}`);
  }

  // A document too short to judge is reported as unknown rather than guessed at.
  assert.equal((await classifyDocumentType("Loan.")).label, "unknown");

  // The accuracy quoted on the model page must come from an actual cross-validation run.
  const metrics = await evaluateDocumentTypeClassifier();
  assert.equal(metrics.sampleSize, 48);
  assert.ok(metrics.accuracy > 0.8, `cross-validated accuracy regressed to ${metrics.accuracy}`);
});

test("embeddings are measurably worse than the rules at judging harm", async () => {
  const { evaluateRiskApproaches } = await import("../services/riskEvaluation.service");
  const { approaches } = await evaluateRiskApproaches();
  const [rules, knn] = approaches;

  // This is the evidence for keeping rules on the live path; if it ever inverts, the design
  // decision in the report no longer holds and must be revisited rather than quietly left.
  assert.ok(rules.accuracy > knn.accuracy, `rules ${rules.accuracy} vs embeddings ${knn.accuracy}`);
  assert.ok(rules.accuracy >= 0.75, `rule engine regressed to ${rules.accuracy}`);
});

// The ONNX runtime keeps worker threads alive; without this the test process never exits.
after(() => {
  setTimeout(() => process.exit(0), 100).unref();
});
