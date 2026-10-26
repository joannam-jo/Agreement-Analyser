import type { AgreementAnalysis, CompareResult, ChatMessage, DocumentLanguage, ExplanationLanguage } from "@faa/shared";

// Empty string means "same origin": the web app forwards /api to the backend (see next.config.ts).
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type TokenGetter = () => Promise<string | null>;
let getToken: TokenGetter = async () => null;

/** Called by UserProvider so every request carries the signed Clerk session token. */
export function setAuthTokenGetter(getter: TokenGetter) {
  getToken = getter;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = await getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers, cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401 && process.env.NEXT_PUBLIC_GUEST_MODE === "true") {
      // An invalid guest session is dropped so the next page load starts a fresh one.
      try {
        localStorage.removeItem("faa-guest-session");
      } catch {
        // ignore
      }
    }
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res;
}

async function fetchApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Public demo mode: a private, signed guest session so visitors only see their own documents. */
export async function createGuestSession(): Promise<{ token: string; userId: string }> {
  const res = await fetch(`${API_URL}/api/session/guest`, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error("Could not start a session");
  return res.json();
}

export async function uploadAgreement(
  file: File,
  options: { documentLanguage: DocumentLanguage; explanationLanguage: ExplanationLanguage }
): Promise<{ agreementId: string; status: string }> {
  const form = new FormData();
  // Fields before the file so the server has them when it reads the upload.
  form.append("documentLanguage", options.documentLanguage);
  form.append("explanationLanguage", options.explanationLanguage);
  form.append("file", file);
  return fetchApi("/api/agreements/upload", { method: "POST", body: form });
}

export async function getAgreement(id: string, lang?: ExplanationLanguage) {
  return fetchApi<{ agreement: AgreementAnalysis }>(`/api/agreements/${id}${lang ? `?lang=${lang}` : ""}`);
}

/** Downloads the decrypted document for the viewer (owner only). */
export async function getAgreementFile(id: string): Promise<Blob> {
  const res = await request(`/api/agreements/${id}/file`);
  return res.blob();
}

export async function deleteAgreement(id: string) {
  return fetchApi<void>(`/api/agreements/${id}`, { method: "DELETE" });
}

export async function listAgreements() {
  return fetchApi<{ agreements: AgreementAnalysis[] }>("/api/agreements");
}

export async function getDashboardStats() {
  return fetchApi<{
    totalDocuments: number;
    analyzedCount: number;
    totalHighRiskClauses: number;
    averageTrustScore: number;
    riskTrend: { date: string; overallRisk: number; trustScore: number; fileName: string }[];
    recentUploads: { id: string; fileName: string; trustScore: number; riskCounts: AgreementAnalysis["riskCounts"]; createdAt: string }[];
  }>("/api/dashboard/stats");
}

export async function getBeforeYouSignWarnings(id: string, lang?: ExplanationLanguage) {
  return fetchApi<{
    showBeforeYouSign: boolean;
    warnings: { id: string; category: string; plainEnglish: string; confidence: number }[];
    trustScore: number;
  }>(`/api/analysis/${id}/warnings${lang ? `?lang=${lang}` : ""}`);
}

export async function sendChatMessage(
  agreementId: string,
  messages: { role: "user" | "assistant"; content: string }[],
  language: ExplanationLanguage = "en"
) {
  return fetchApi<{ message: ChatMessage }>("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreementId, messages, language }),
  });
}

export async function compareAgreements(agreementIdA: string, agreementIdB: string) {
  return fetchApi<CompareResult>("/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agreementIdA, agreementIdB }),
  });
}

export async function getModelMetrics() {
  return fetchApi<{
    generatedAt: string;
    documentType: {
      model: string;
      method: string;
      sampleSize: number;
      accuracy: number;
      perLabel: Record<string, { precision: number; recall: number; f1: number; support: number }>;
      confusion: Record<string, Record<string, number>>;
    };
    risk: {
      sampleSize: number;
      approaches: {
        name: string;
        accuracy: number;
        precision: number;
        recall: number;
        f1: number;
        truePositives: number;
        falsePositives: number;
        trueNegatives: number;
        falseNegatives: number;
      }[];
      disagreements: { text: string; expected: string; rules: string; embeddings: string }[];
    };
  }>("/api/ml/metrics");
}

/** Creates a Razorpay order for a plan; the price is fixed on the server. */
export async function createPaymentOrder(plan: "pro") {
  return fetchApi<{ orderId: string; amount: number; currency: string; keyId: string; name: string }>("/api/billing/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
}

/** Asks the server to verify Razorpay's signature for a completed payment. */
export async function verifyPayment(response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  return fetchApi<{ paid: boolean }>("/api/billing/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(response),
  });
}
