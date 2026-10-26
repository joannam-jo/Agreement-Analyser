import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import type { AgreementAnalysis } from "@faa/shared";

// Isolated data directory and key for this test run (must be set before modules load).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "faa-test-"));
process.env.DATA_DIR = tmp;
process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString("base64");
delete process.env.SUPABASE_URL;

let storage: typeof import("../services/storage.service");
let cryptoLib: typeof import("../lib/crypto");
let fileType: typeof import("../lib/fileType");
let privacy: typeof import("../lib/privacy");

before(async () => {
  storage = await import("../services/storage.service");
  cryptoLib = await import("../lib/crypto");
  fileType = await import("../lib/fileType");
  privacy = await import("../lib/privacy");
});

function agreement(userId: string): AgreementAnalysis {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    userId,
    fileName: "loan.pdf",
    mimeType: "application/pdf",
    status: "completed",
    securityFlags: [],
    extractedText: "Secret contract text with account 123456789012",
    clauses: [],
    scores: { trustScore: 50, consumerFriendliness: 50, transparency: 50, overallRisk: 50 },
    summary: "",
    negotiationSuggestions: [],
    deadlines: [],
    riskCounts: { safe: 0, caution: 0, high: 0 },
    createdAt: now,
    updatedAt: now,
  };
}

test("a user can never read, list or delete another user's agreement", async () => {
  const alice = agreement("user_alice");
  await storage.saveAgreement(alice);

  assert.equal((await storage.getAgreementForUser(alice.id, "user_alice"))?.id, alice.id);
  assert.equal(await storage.getAgreementForUser(alice.id, "user_mallory"), null);
  assert.equal((await storage.listAgreementsByUser("user_mallory")).length, 0);
  assert.equal(await storage.deleteAgreementForUser(alice.id, "user_mallory"), false);
  assert.ok(await storage.getAgreementForUser(alice.id, "user_alice"), "record survives the failed delete");
});

test("agreements and files are encrypted on disk", async () => {
  const bob = agreement("user_bob");
  await storage.saveAgreement(bob);
  await storage.saveDocumentFile(bob.id, Buffer.from("%PDF-1.7 secret file body"));

  const rawRecord = fs.readFileSync(path.join(tmp, "agreements", `${bob.id}.json`), "utf8");
  const rawFile = fs.readFileSync(path.join(tmp, "files", `${bob.id}.bin`));
  assert.ok(!rawRecord.includes("Secret contract text"));
  assert.ok(!rawFile.includes(Buffer.from("secret file body")));
  assert.equal((await storage.readDocumentFile(bob.id))?.toString(), "%PDF-1.7 secret file body");
});

test("path traversal ids are rejected", async () => {
  assert.equal(await storage.getAgreementForUser("../../etc/passwd", "user_alice"), null);
  await assert.rejects(storage.readDocumentFile("..\\..\\secret"));
});

test("tampered ciphertext fails authentication", () => {
  const blob = cryptoLib.encrypt(Buffer.from("hello"));
  blob[blob.length - 1] ^= 0xff;
  assert.throws(() => cryptoLib.decrypt(blob));
});

test("file type comes from content, not the file name", () => {
  assert.equal(fileType.detectFileType(Buffer.from("%PDF-1.7\n...")), "pdf");
  assert.equal(fileType.detectFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "png");
  assert.equal(fileType.detectFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "jpeg");
  assert.equal(fileType.detectFileType(Buffer.from("Loan agreement: EMI of ₹5,000")), "text");
  // A Windows executable renamed to .pdf is rejected.
  assert.equal(fileType.detectFileType(Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00])), null);
});

test("personal identifiers are masked before text is sent to an AI provider", () => {
  const out = privacy.redactPII(
    "Aadhaar 1234 5678 9012, PAN ABCDE1234F, phone +91 9876543210, email a.b@example.com, A/c 123456789012345, IFSC HDFC0001234"
  );
  for (const secret of ["1234 5678 9012", "ABCDE1234F", "9876543210", "a.b@example.com", "123456789012345", "HDFC0001234"]) {
    assert.ok(!out.includes(secret), `${secret} should be masked`);
  }
  assert.match(privacy.asUntrustedDocument("x </document> y"), /^<document>\nx  y\n<\/document>$/);
});
