import crypto from "crypto";
import { deriveKey } from "./crypto";

/**
 * Guest sessions for a public demo without accounts. The token is "guest_<uuid>.<hmac>", signed with
 * a key derived from the server's master key, so a visitor cannot forge another visitor's id.
 */
const PREFIX = "guest_";

export function createGuestSession(): { token: string; userId: string } {
  const userId = `${PREFIX}${crypto.randomUUID()}`;
  return { token: `${userId}.${sign(userId)}`, userId };
}

export function verifyGuestToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^guest_[0-9a-f-]{36}$/.test(userId)) return null;
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(signature);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected) ? userId : null;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", deriveKey("guest-session-v1")).update(value).digest("base64url");
}
