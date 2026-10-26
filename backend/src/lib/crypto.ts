import crypto from "crypto";
import fs from "fs";
import path from "path";
import { DATA_DIR, isProduction } from "./config";

/**
 * AES-256-GCM encryption for everything we persist (agreement records and uploaded files).
 * Layout of an encrypted blob: [version:1][iv:12][authTag:16][ciphertext].
 */
const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.DATA_ENCRYPTION_KEY;
  if (fromEnv) {
    const key = Buffer.from(fromEnv, "base64");
    if (key.length !== 32) {
      throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes encoded as base64");
    }
    cachedKey = key;
    return key;
  }

  if (isProduction) {
    throw new Error("DATA_ENCRYPTION_KEY is required in production");
  }

  // Development only: generate a local key once so data survives restarts.
  const keyPath = path.join(DATA_DIR, "dev-encryption.key");
  if (fs.existsSync(keyPath)) {
    cachedKey = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "base64");
  } else {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    cachedKey = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, cachedKey.toString("base64"), { mode: 0o600 });
    console.warn(`[security] DATA_ENCRYPTION_KEY not set - generated a development key at ${keyPath}`);
  }
  return cachedKey;
}

export function encrypt(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", loadKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), ciphertext]);
}

export function decrypt(blob: Buffer): Buffer {
  if (blob.length < 1 + IV_LENGTH + TAG_LENGTH || blob[0] !== VERSION) {
    throw new Error("Unsupported encrypted payload");
  }
  const iv = blob.subarray(1, 1 + IV_LENGTH);
  const tag = blob.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-256-gcm", loadKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(1 + IV_LENGTH + TAG_LENGTH)), decipher.final()]);
}

export function encryptJson(value: unknown): string {
  return encrypt(Buffer.from(JSON.stringify(value), "utf8")).toString("base64");
}

export function decryptJson<T>(payload: string): T {
  return JSON.parse(decrypt(Buffer.from(payload, "base64")).toString("utf8")) as T;
}

/** A purpose-specific key derived from the master key (e.g. for signing guest sessions). */
export function deriveKey(purpose: string): Buffer {
  return crypto.createHmac("sha256", loadKey()).update(purpose).digest();
}
