import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { detectFileType } from "../lib/fileType";
import { extractDocument } from "../services/ocr.service";
import { segmentClauses } from "../services/clauseSegmentation.service";
import { classifyClause } from "../services/riskClassifier.service";
import { extractDocx } from "../services/wordDocument.service";

const SAMPLES = path.resolve(__dirname, "..", "..", "..", "samples");

test("Word .docx: text, clauses and hidden white text are detected", async () => {
  const buffer = fs.readFileSync(path.join(SAMPLES, "loan-agreement.docx"));
  assert.equal(detectFileType(buffer), "docx");

  const result = await extractDocument(buffer, "docx");
  assert.equal(result.document.kind, "word");
  assert.ok(result.securityFlags.includes("hidden-tiny-text"));

  const categories = segmentClauses(result.index.text).map((c) => classifyClause(c.text).category);
  assert.ok(categories.includes("Variable Interest"));
  assert.ok(categories.includes("Hidden Instructions to AI"));
});

test("legacy Word .doc is read", async () => {
  const buffer = fs.readFileSync(path.join(SAMPLES, "loan-agreement-legacy.doc"));
  assert.equal(detectFileType(buffer), "doc");
  const result = await extractDocument(buffer, "doc");
  assert.match(result.index.text, /processing fee of Rs\. 4,500/i);
  assert.ok(segmentClauses(result.index.text).length >= 9);
});

test("a ZIP that is not a Word document is rejected", async () => {
  const zip = new JSZip();
  zip.file("payload.exe", "MZ...");
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  assert.equal(detectFileType(buffer), null);
});

test("an oversized (zip bomb style) Word file is refused before decompression", async () => {
  const zip = new JSZip();
  zip.file("word/document.xml", "<w:document/>");
  // 90 MB of zeros compresses to a few KB.
  zip.file("word/media/bomb.bin", Buffer.alloc(90 * 1024 * 1024));
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  assert.ok(buffer.length < 1024 * 1024, "the archive itself is small");
  await assert.rejects(extractDocx(buffer), /too large/);
});
