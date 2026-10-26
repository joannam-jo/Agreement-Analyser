/**
 * Evaluates the project's learned components and writes the figures the ML metrics endpoint serves.
 *
 * Run with: npm run evaluate --workspace=@faa/backend
 *
 * Two things are measured:
 *   1. the document-type classifier, by leave-one-out cross-validation;
 *   2. the rule engine against an embedding classifier on the same labelled clauses, which is the
 *      evidence for keeping rules as the live path for risk.
 */

import fs from "fs";
import path from "path";
import { evaluateDocumentTypeClassifier } from "../src/services/documentType.service";
import { evaluateRiskApproaches } from "../src/services/riskEvaluation.service";

const OUT = path.resolve(__dirname, "..", "ml-metrics.json");

(async () => {
  console.log("Evaluating document-type classifier (leave-one-out)...");
  const documentType = await evaluateDocumentTypeClassifier();
  console.log(`  accuracy ${(documentType.accuracy * 100).toFixed(1)}% over ${documentType.sampleSize} examples`);
  for (const [label, m] of Object.entries(documentType.perLabel)) {
    console.log(`    ${label.padEnd(16)} precision ${m.precision.toFixed(2)}  recall ${m.recall.toFixed(2)}  f1 ${m.f1.toFixed(2)}  n=${m.support}`);
  }

  console.log("\nComparing risk approaches on labelled clauses...");
  const risk = await evaluateRiskApproaches();
  for (const approach of risk.approaches) {
    console.log(
      `  ${approach.name.padEnd(28)} accuracy ${(approach.accuracy * 100).toFixed(1)}%  ` +
        `precision ${approach.precision.toFixed(2)}  recall ${approach.recall.toFixed(2)}  f1 ${approach.f1.toFixed(2)}`
    );
  }

  const metrics = { generatedAt: new Date().toISOString(), documentType, risk };
  fs.writeFileSync(OUT, `${JSON.stringify(metrics, null, 2)}\n`);
  console.log(`\nWritten: ${path.relative(process.cwd(), OUT)}`);

  // The ONNX runtime keeps worker threads alive.
  setTimeout(() => process.exit(0), 100).unref();
})();
