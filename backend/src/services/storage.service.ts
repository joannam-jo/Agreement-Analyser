import fs from "fs/promises";
import path from "path";
import type { AgreementAnalysis } from "@faa/shared";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import { DATA_DIR } from "../lib/config";
import { decrypt, decryptJson, encrypt, encryptJson } from "../lib/crypto";

/**
 * Persistence for agreements and their original files.
 *
 * - Everything sensitive (contract text, clauses, the file itself) is encrypted with AES-256-GCM
 *   before it is written, whether to local disk or to Supabase.
 * - Every read takes the caller's userId and only returns rows that user owns. There is no
 *   "get by id" without an owner, so a route cannot forget the ownership check.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RECORDS_DIR = path.join(DATA_DIR, "agreements");
const FILES_DIR = path.join(DATA_DIR, "files");
const INDEX_DIR = path.join(DATA_DIR, "indexes");
const FILE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "agreement-documents";

interface StoredRecord {
  id: string;
  userId: string;
  createdAt: string;
  payload: string;
}

export function isValidId(id: string): boolean {
  return UUID.test(id);
}

function assertId(id: string) {
  if (!isValidId(id)) throw new Error("Invalid agreement id");
}

export async function saveAgreement(agreement: AgreementAnalysis): Promise<void> {
  assertId(agreement.id);
  const payload = encryptJson(agreement);

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase.from("agreements").upsert({
      id: agreement.id,
      user_id: agreement.userId,
      status: agreement.status,
      payload_enc: payload,
      created_at: agreement.createdAt,
      updated_at: agreement.updatedAt,
    });
    if (error) throw new Error(`Failed to save agreement: ${error.message}`);
    return;
  }

  await fs.mkdir(RECORDS_DIR, { recursive: true });
  const record: StoredRecord = { id: agreement.id, userId: agreement.userId, createdAt: agreement.createdAt, payload };
  const target = path.join(RECORDS_DIR, `${agreement.id}.json`);
  const temp = `${target}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.writeFile(temp, JSON.stringify(record), { mode: 0o600 });
  await renameWithRetry(temp, target);
}

/** Windows refuses to replace a file another handle is briefly reading; retry a few times. */
async function renameWithRetry(from: string, to: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (attempt >= 8 || !["EPERM", "EACCES", "EBUSY"].includes(code || "")) throw e;
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

export async function getAgreementForUser(id: string, userId: string): Promise<AgreementAnalysis | null> {
  if (!isValidId(id)) return null;

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("agreements")
      .select("payload_enc")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return decryptJson<AgreementAnalysis>(data.payload_enc as string);
  }

  const record = await readLocalRecord(id);
  if (!record || record.userId !== userId) return null;
  return decryptJson<AgreementAnalysis>(record.payload);
}

export async function listAgreementsByUser(userId: string): Promise<AgreementAnalysis[]> {
  let payloads: string[] = [];

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from("agreements")
      .select("payload_enc")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(`Failed to list agreements: ${error.message}`);
    payloads = (data || []).map((row) => row.payload_enc as string);
  } else {
    const records = await readAllLocalRecords();
    payloads = records
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => r.payload);
  }

  return payloads.map((p) => decryptJson<AgreementAnalysis>(p));
}

export async function deleteAgreementForUser(id: string, userId: string): Promise<boolean> {
  const existing = await getAgreementForUser(id, userId);
  if (!existing) return false;

  if (isSupabaseConfigured() && supabase) {
    await supabase.storage.from(FILE_BUCKET).remove([`${id}.bin`]);
    const { error } = await supabase.from("agreements").delete().eq("id", id).eq("user_id", userId);
    if (error) throw new Error(`Failed to delete agreement: ${error.message}`);
    return true;
  }

  await fs.rm(path.join(FILES_DIR, `${id}.bin`), { force: true });
  await fs.rm(path.join(INDEX_DIR, `${id}.bin`), { force: true });
  await fs.rm(path.join(RECORDS_DIR, `${id}.json`), { force: true });
  return true;
}

/**
 * The semantic index holds the document's own sentences and their embeddings, so it is treated as
 * sensitive as the document itself: encrypted at rest, and removed when the agreement is deleted.
 */
export async function saveSemanticIndex(id: string, buffer: Buffer): Promise<void> {
  assertId(id);
  const blob = encrypt(buffer);

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase.storage
      .from(FILE_BUCKET)
      .upload(`${id}.index.bin`, blob, { contentType: "application/octet-stream", upsert: true });
    if (error) throw new Error(`Failed to store semantic index: ${error.message}`);
    return;
  }

  await fs.mkdir(INDEX_DIR, { recursive: true });
  await fs.writeFile(path.join(INDEX_DIR, `${id}.bin`), blob, { mode: 0o600 });
}

/** Callers must check ownership first (via getAgreementForUser). */
export async function readSemanticIndex(id: string): Promise<Buffer | null> {
  assertId(id);

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.storage.from(FILE_BUCKET).download(`${id}.index.bin`);
    if (error || !data) return null;
    return decrypt(Buffer.from(await data.arrayBuffer()));
  }

  try {
    return decrypt(await fs.readFile(path.join(INDEX_DIR, `${id}.bin`)));
  } catch {
    return null;
  }
}

/** Store the document the viewer will display, encrypted. */
export async function saveDocumentFile(id: string, buffer: Buffer): Promise<void> {
  assertId(id);
  const blob = encrypt(buffer);

  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase.storage
      .from(FILE_BUCKET)
      .upload(`${id}.bin`, blob, { contentType: "application/octet-stream", upsert: true });
    if (error) throw new Error(`Failed to store document: ${error.message}`);
    return;
  }

  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.writeFile(path.join(FILES_DIR, `${id}.bin`), blob, { mode: 0o600 });
}

/** Callers must check ownership first (via getAgreementForUser). */
export async function readDocumentFile(id: string): Promise<Buffer | null> {
  assertId(id);

  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase.storage.from(FILE_BUCKET).download(`${id}.bin`);
    if (error || !data) return null;
    return decrypt(Buffer.from(await data.arrayBuffer()));
  }

  try {
    return decrypt(await fs.readFile(path.join(FILES_DIR, `${id}.bin`)));
  } catch {
    return null;
  }
}

/** Analyses interrupted by a restart can never finish; mark them failed so the UI stops waiting. */
export async function failInterruptedAnalyses(): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    const { data } = await supabase.from("agreements").select("payload_enc").eq("status", "processing");
    for (const row of data || []) await markInterrupted(decryptJson<AgreementAnalysis>(row.payload_enc as string));
    return;
  }
  for (const record of await readAllLocalRecords()) {
    const agreement = decryptJson<AgreementAnalysis>(record.payload);
    if (agreement.status === "processing") await markInterrupted(agreement);
  }
}

async function markInterrupted(agreement: AgreementAnalysis) {
  await saveAgreement({
    ...agreement,
    status: "failed",
    progress: { stage: "failed", percent: 100, message: "Analysis was interrupted. Please upload the document again." },
    updatedAt: new Date().toISOString(),
  });
}

async function readLocalRecord(id: string): Promise<StoredRecord | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(RECORDS_DIR, `${id}.json`), "utf8")) as StoredRecord;
  } catch {
    return null;
  }
}

async function readAllLocalRecords(): Promise<StoredRecord[]> {
  let names: string[] = [];
  try {
    names = await fs.readdir(RECORDS_DIR);
  } catch {
    return [];
  }
  const records = await Promise.all(
    names.filter((n) => n.endsWith(".json")).map((n) => readLocalRecord(n.slice(0, -".json".length)))
  );
  return records.filter((r): r is StoredRecord => Boolean(r));
}
