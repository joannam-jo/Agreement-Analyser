import type { AgreementAnalysis, ClauseAnalysis, ExplanationLanguage } from "@faa/shared";
import { localizeAgreement } from "./explanations";

/**
 * Answers questions from the finished analysis when no AI provider is configured (or it fails).
 * Every answer quotes the user's own clauses, so it stays accurate even without a language model.
 *
 * Replies use a small markdown subset the chat UI renders: **bold**, "- " bullets and "> " quotes.
 * They are kept short: a direct answer first, then at most two clauses.
 */

type Lang = ExplanationLanguage;

interface Topic {
  question: RegExp;
  clause: RegExp;
  /** Clause categories that answer this topic most directly; listed first. */
  primary?: RegExp;
  empty: Record<Lang, string>;
}

// Most specific topics first: "pay late" is about penalties, not fees.
const TOPICS: Topic[] = [
  {
    // "late" needs a word boundary: without it, "what happens to the rate later on?" is read as a
    // question about late payment.
    question: /\blate\b|penalt|\bmiss(?:ed|ing|es)?\b|default|overdue|can'?t pay|cannot pay|देर|जुर्माना|दंड|किस्त\s*(?:चूक|छूट)/i,
    clause: /late|penalt|default|overdue|liquidated|देर|जुर्माना|दंड/i,
    primary: /Penalty/,
    empty: { en: "I did not find late-payment or penalty clauses in this agreement.", hi: "इस समझौते में देर से भुगतान या जुर्माने की कोई शर्त नहीं मिली।" },
  },
  {
    question: /salary|wage|payroll|employer|deduct|वेतन|तनख्वाह|सैलरी|कटौती/i,
    clause: /salary|wage|payroll|employer|वेतन|तनख्वाह|सैलरी/i,
    primary: /Salary/,
    empty: { en: "I did not find any clause allowing deductions from your salary.", hi: "आपके वेतन से कटौती की अनुमति देने वाली कोई शर्त नहीं मिली।" },
  },
  {
    question: /contact|data|privacy|photo|location|family|harass|call my|phone|संपर्क|परिवार|फोटो|डेटा|परेशान/i,
    clause: /contact|photo|location|data|privacy|family|relatives|references|संपर्क|परिवार|फोटो|डेटा/i,
    primary: /Data Misuse/,
    empty: { en: "I did not find clauses about access to your phone data or contacting your family.", hi: "आपके फोन डेटा या परिवार से संपर्क के बारे में कोई शर्त नहीं मिली।" },
  },
  {
    // Paying a loan off ahead of schedule is asked in plain words far more often than it is asked
    // as "prepayment", and the penalty for doing it is a common complaint in consumer lending.
    question:
      /renew|cancel|terminat|exit|close|quit|get out|pre-?pay|foreclos|pay(?:ing)?\s+(?:it|them|the\s+\w+)?\s*off|(?:repay|settl|clos)\w*\s+(?:it\s+)?early|early\s+(?:re)?pay|रद्द|नवीनीकरण|बंद|जल्दी\s*चुका|पूर्व\s*भुगतान/i,
    clause: /renew|cancel|terminat|pre-?pay|foreclos|liquidated|early|रद्द|नवीनीकरण|नवीनीकृत|चुका/i,
    primary: /Renewal|Cancellation/,
    empty: { en: "I did not find renewal or cancellation terms in this agreement.", hi: "इस समझौते में नवीनीकरण या रद्द करने की कोई शर्त नहीं मिली।" },
  },
  {
    question: /dispute|arbitrat|court|complain|grievance|sue|legal action|ombudsman|विवाद|शिकायत|अदालत|मध्यस्थ/i,
    clause: /dispute|arbitrat|court|grievance|complain|jurisdiction|विवाद|शिकायत|मध्यस्थ/i,
    primary: /Arbitration/,
    empty: { en: "I did not find dispute-resolution or complaint terms in this agreement.", hi: "इस समझौते में विवाद या शिकायत से जुड़ी कोई शर्त नहीं मिली।" },
  },
  {
    question: /interest|rate|emi|apr|instal?ment|repay|ब्याज|किस्त|ईएमआई/i,
    clause: /interest|rate|emi|instal?ment|repay|ब्याज|किस्त/i,
    primary: /Interest/,
    empty: { en: "I did not find interest-rate or repayment terms in this agreement.", hi: "इस समझौते में ब्याज दर या किस्तों की कोई शर्त नहीं मिली।" },
  },
  {
    question: /fee|charge|cost|hidden|processing|\bpay\b|\bpaying\b|price|how much|शुल्क|फीस|चार्ज|खर्च|कितना/i,
    clause: /fee|charge|surcharge|cost|deduct|शुल्क|फीस|चार्ज/i,
    primary: /Fees/,
    empty: { en: "I did not find any fee or charge clauses in this agreement.", hi: "इस समझौते में किसी शुल्क या चार्ज की शर्त नहीं मिली।" },
  },
];

const T = {
  en: {
    risk: { high: "High risk", caution: "Caution", safe: "Low risk" },
    trust: (n: number) => `**Trust score ${n}/100**`,
    counts: (high: number, caution: number) => {
      const parts = [high && `${high} high-risk`, caution && `${caution} caution`].filter(Boolean);
      return parts.length ? `${parts.join(", ")} clause${high + caution === 1 ? "" : "s"}` : "no risky clauses found";
    },
    concerns: "**Biggest concerns**",
    pick: "Pick a question below or ask your own.",
    hello: "Hi! I'm your agreement assistant. How can I help you?\n\nI can explain **fees**, **interest**, **late payment**, **cancelling or repaying early**, **your data** and whether you should **sign**. Ask about this agreement, or upload another document to check it.",
    thanks: "You're welcome! Ask me anything else about this agreement, or upload another one.",
    security: "⚠️ **This document hides text from readers or tries to fool automated review.** Legitimate lenders don't do this.",
    noScam: "I found **no hidden text, AI-manipulation text or typical scam language**.\n\nThat does not prove the lender is genuine. Check it is registered with the regulator before signing.",
    scamYes: "**Yes, there are warning signs.**",
    verdictNo: "**No — I would not sign this as it stands.**",
    verdictMaybe: "**Only after the issues below are fixed in writing.**",
    verdictOk: "**It looks relatively fair**, but read the flagged clauses first.",
    trustShort: (n: number) => `Trust score ${n}/100.`,
    reasons: "**Main reasons**",
    notAdvice: "Automated review, not legal advice. For a large loan, ask a lawyer or free legal aid clinic.",
    negotiate: "**Ask the lender to change these before you sign:**",
    defaultAction: "Ask for this clause to be removed or capped.",
    writing: "Get every change written into the signed agreement. Verbal promises are hard to enforce.",
    alsoRelated: (names: string, more: boolean) => `Also related: ${names}${more ? " and more" : ""}.`,
    closest: "The closest clause I found:",
    whatToDo: "**What to do:**",
    noMatch: "I couldn't match that to a clause in this agreement. Try asking about **fees**, **interest**, **cancelling**, **late payments**, **disputes**, **your data**, or **whether to sign**.",
    notAgreement:
      "**This document doesn't look like an agreement**, so I can't judge whether it is safe to sign. It reads like a report or description, not a contract with binding terms.\n\nUpload the actual **loan agreement, sanction letter, Key Fact Statement or terms and conditions** from the lender, and I'll check those.",
  },
  hi: {
    risk: { high: "उच्च जोखिम", caution: "सावधानी", safe: "कम जोखिम" },
    trust: (n: number) => `**भरोसा स्कोर ${n}/100**`,
    counts: (high: number, caution: number) => {
      const parts = [high && `${high} उच्च-जोखिम`, caution && `${caution} सावधानी वाली`].filter(Boolean);
      return parts.length ? `${parts.join(", ")} शर्तें` : "कोई जोखिम वाली शर्त नहीं मिली";
    },
    concerns: "**सबसे बड़ी चिंताएँ**",
    pick: "नीचे से कोई सवाल चुनें या अपना सवाल लिखें।",
    hello: "नमस्ते! मैं आपका समझौता सहायक हूँ। मैं आपकी कैसे मदद कर सकता हूँ?\n\nमैं **शुल्क**, **ब्याज**, **देर से भुगतान**, **रद्द करना या जल्दी चुकाना**, **आपका डेटा** और **हस्ताक्षर करें या नहीं** समझा सकता हूँ। इस समझौते के बारे में पूछें, या जाँच के लिए कोई और दस्तावेज़ अपलोड करें।",
    thanks: "आपका स्वागत है! इस समझौते के बारे में कुछ और पूछें, या दूसरा दस्तावेज़ अपलोड करें।",
    security: "⚠️ **यह दस्तावेज़ पाठकों से टेक्स्ट छिपाता है या स्वचालित जाँच को धोखा देने की कोशिश करता है।** असली ऋणदाता ऐसा नहीं करते।",
    noScam: "मुझे **कोई छिपा टेक्स्ट, AI को गुमराह करने वाला टेक्स्ट या आम धोखाधड़ी वाली भाषा नहीं मिली**।\n\nइससे यह साबित नहीं होता कि ऋणदाता असली है। हस्ताक्षर से पहले जाँचें कि वह नियामक (RBI) के पास पंजीकृत है।",
    scamYes: "**हाँ, चेतावनी के संकेत हैं।**",
    verdictNo: "**नहीं — मौजूदा रूप में मैं इस पर हस्ताक्षर नहीं करूँगा।**",
    verdictMaybe: "**केवल तभी, जब नीचे दी गई समस्याएँ लिखित में ठीक हो जाएँ।**",
    verdictOk: "**यह काफी हद तक ठीक लगता है**, पर चिह्नित शर्तें पहले ज़रूर पढ़ें।",
    trustShort: (n: number) => `भरोसा स्कोर ${n}/100।`,
    reasons: "**मुख्य कारण**",
    notAdvice: "यह स्वचालित जाँच है, कानूनी सलाह नहीं। बड़े ऋण के लिए किसी वकील या मुफ़्त कानूनी सहायता केंद्र से सलाह लें।",
    negotiate: "**हस्ताक्षर से पहले ऋणदाता से ये बदलाव माँगें:**",
    defaultAction: "इस शर्त को हटाने या सीमित करने को कहें।",
    writing: "हर बदलाव हस्ताक्षरित समझौते में लिखवाएँ। मौखिक वादे लागू करवाना मुश्किल होता है।",
    alsoRelated: (names: string, more: boolean) => `इनसे भी जुड़ा: ${names}${more ? " और अन्य" : ""}।`,
    closest: "सबसे मिलती-जुलती शर्त:",
    whatToDo: "**क्या करें:**",
    noMatch: "यह सवाल किसी शर्त से नहीं मिला। **शुल्क**, **ब्याज**, **रद्द करना**, **देर से भुगतान**, **विवाद**, **आपका डेटा** या **हस्ताक्षर करें या नहीं** के बारे में पूछें।",
    notAgreement:
      "**यह दस्तावेज़ कोई समझौता नहीं लगता**, इसलिए मैं नहीं बता सकता कि इस पर हस्ताक्षर करना सुरक्षित है या नहीं। यह बाध्यकारी शर्तों वाले अनुबंध की जगह किसी रिपोर्ट या विवरण जैसा है।\n\nऋणदाता का असली **ऋण समझौता, सैंक्शन लेटर, की फैक्ट स्टेटमेंट या नियम और शर्तें** अपलोड करें, मैं उनकी जाँच करूँगा।",
  },
};

const RISK_ORDER = { high: 0, caution: 1, safe: 2 } as const;

export function answerFromAnalysis(
  original: AgreementAnalysis,
  question: string,
  lang: Lang = "en",
  /** Passages found by semantic search, best first; empty when the embedding model is unavailable. */
  retrieved: RetrievedRange[] = []
): string {
  const agreement = localizeAgreement(original, lang);
  const t = T[lang];
  if (original.documentCheck?.isAgreement === false) return t.notAgreement;
  const q = question.trim();
  const clauses = agreement.clauses;
  const risky = byRisk(clauses.filter((c) => c.riskLevel !== "safe"));
  const security = agreement.securityFlags.length ? t.security : "";

  // Small talk gets a friendly greeting, not the full analysis.
  const smallTalk = /^\s*(?:(?:hi+|hello+|hey+|hola|yo|namaste|good\s+(?:morning|afternoon|evening))\b[\s\S]{0,40}|how\s+are\s+you[\s\S]{0,20}|what'?s\s+up[\s\S]{0,20}|sup)\s*[!.?]*\s*$|^\s*(?:नमस्ते|नमस्कार|हेलो|हाय)[\s\S]{0,30}$/i;
  if (smallTalk.test(q) && !/fee|rate|interest|sign|penalt|cancel|risk|clause|late/i.test(q)) return t.hello;
  if (/^\s*(?:thanks?|thank\s+you|ok(?:ay)?|cool|great|bye|धन्यवाद|शुक्रिया)\b[\s\S]{0,20}$/i.test(q)) return t.thanks;

  if (!q || /help|what can you|summar|overview|explain (this|the) (agreement|document)|सारांश|मदद/i.test(q)) {
    return join(
      `${t.trust(agreement.scores.trustScore)} · ${t.counts(agreement.riskCounts.high, agreement.riskCounts.caution)}`,
      security,
      risky.length ? `${t.concerns}\n` + risky.slice(0, 3).map((c) => `- **${name(c)}**: ${c.plainEnglish}`).join("\n") : "",
      t.pick
    );
  }

  if (/trick|hidden text|scam|fraud|manipulat|fake|genuine|legit|धोखा|फ्रॉड|फर्ज़ी|फर्जी|असली|नकली/i.test(q)) {
    const scamClauses = clauses.filter((c) => /Hidden Text|Hidden Instructions|Scam|Fraud|Harassment/i.test(c.category));
    if (!security && !scamClauses.length) return t.noScam;
    return join(t.scamYes, security, scamClauses.slice(0, 3).map((c) => `- **${name(c)}**: ${c.plainEnglish}`).join("\n"));
  }

  if (/should i sign|safe to sign|is (it|this) (safe|good|fair|ok)|trust|worth|recommend|हस्ताक्षर|साइन|सुरक्षित|भरोसा/i.test(q)) {
    const verdict =
      agreement.scores.trustScore < 40 || security ? t.verdictNo : agreement.scores.trustScore < 70 ? t.verdictMaybe : t.verdictOk;
    return join(
      `${verdict} ${t.trustShort(agreement.scores.trustScore)}`,
      risky.length ? `${t.reasons}\n` + risky.slice(0, 4).map((c) => `- **${name(c)}**: ${c.plainEnglish}`).join("\n") : "",
      t.notAdvice
    );
  }

  if (/negotiat|change|ask (them|the lender|for)|remove|what can i do|what should i do|improve|मोलभाव|बदलाव|क्या करूँ|क्या करें/i.test(q)) {
    const actions = risky.slice(0, 4).map((c) => `- **${name(c)}**: ${c.recommendedActions[0] ?? t.defaultAction}`);
    return join(
      `${t.negotiate}\n` + (actions.length ? actions : agreement.negotiationSuggestions.map((s) => `- ${s}`)).join("\n"),
      t.writing
    );
  }

  const semantic = clausesForRetrieved(clauses, retrieved);

  const topic = pickTopic(q);
  if (topic) {
    const rank = (c: ClauseAnalysis) => (topic.primary?.test(c.category) ? 0 : 1);
    const matches = byRisk(clauses.filter((c) => topic.clause.test(c.text))).sort((a, b) => rank(a) - rank(b));
    if (matches.length) {
      const rest = matches.slice(2, 5).map((c) => `**${name(c)}**`).join(", ");
      return join(...matches.slice(0, 2).map((c) => describe(c, lang)), rest ? t.alsoRelated(rest, matches.length > 5) : "");
    }
    // The topic is recognised but no clause uses its vocabulary. Semantic search can still find the
    // passage — an agreement may say "recovery agents may visit your residence" without "contact".
    if (semantic.length) return join(t.closest, describe(semantic[0], lang));
    return topic.empty[lang];
  }

  // Free-form question. Semantic similarity understands wording the document does not share with
  // the question, so it is preferred; word overlap remains for when no index exists.
  const best = semantic[0] ?? bestMatch(clauses, q);
  if (best) return join(t.closest, describe(best, lang));

  return t.noMatch;
}

/**
 * Chooses between topics when a question matches more than one.
 *
 * "Will they call my family if I am late?" matches both the contact topic and the late-payment
 * topic. The subject of a question comes before its conditions, so the topic whose match appears
 * earliest is the one being asked about — here, contacting the family, with lateness only the
 * circumstance. Answering on the later match silently changes the question.
 */
function pickTopic(q: string): Topic | undefined {
  let best: { topic: Topic; at: number } | undefined;
  for (const topic of TOPICS) {
    const at = q.search(topic.question);
    if (at === -1) continue;
    if (!best || at < best.at) best = { topic, at };
  }
  return best?.topic;
}

/** A retrieved passage, reduced to what matching against clauses needs. */
export interface RetrievedRange {
  start: number;
  end: number;
  score: number;
}

/**
 * Maps retrieved character ranges onto the clauses that overlap them, best passage first.
 * A chunk usually spans more than one clause, so the risky clause within it is preferred: it is
 * the one the reader needs to know about.
 */
function clausesForRetrieved(clauses: ClauseAnalysis[], retrieved: RetrievedRange[]): ClauseAnalysis[] {
  const ordered: ClauseAnalysis[] = [];
  const seen = new Set<string>();

  for (const chunk of retrieved) {
    const overlapping = clauses.filter(
      (c) => c.position && c.position.textStart < chunk.end && c.position.textEnd > chunk.start
    );
    for (const clause of byRisk(overlapping)) {
      if (seen.has(clause.id)) continue;
      seen.add(clause.id);
      ordered.push(clause);
    }
  }
  return ordered;
}

function describe(c: ClauseAnalysis, lang: Lang): string {
  const t = T[lang];
  const body = c.heading && c.text.startsWith(c.heading) ? c.text.slice(c.heading.length).replace(/^[\s.:-]+/, "") : c.text;
  const excerpt = body.length > 160 ? `${body.slice(0, 160).replace(/\s+\S*$/, "")}…` : body;
  return [
    `**${name(c)}** · ${t.risk[c.riskLevel]}`,
    `> ${excerpt}`,
    c.plainEnglish,
    c.riskLevel !== "safe" && c.recommendedActions[0] ? `${t.whatToDo} ${c.recommendedActions[0]}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function join(...parts: string[]): string {
  return parts.filter(Boolean).join("\n\n");
}

function name(c: ClauseAnalysis): string {
  return c.heading || c.category;
}

function byRisk(list: ClauseAnalysis[]): ClauseAnalysis[] {
  return [...list].sort((a, b) => RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel] || b.confidence - a.confidence);
}

const STOPWORDS = new Set(
  "the a an is are was be to of and or in on for with this that it i my me you your what how does do can will if at by as from about क्या है हैं का की के में से को पर और यह वह मैं मेरा मेरी कैसे".split(" ")
);

function bestMatch(clauses: ClauseAnalysis[], question: string): ClauseAnalysis | undefined {
  const words = question.toLowerCase().match(/[a-zऀ-ॿ]{3,}/g)?.filter((w) => !STOPWORDS.has(w)) ?? [];
  if (!words.length) return undefined;
  let best: { clause: ClauseAnalysis; score: number } | undefined;
  for (const clause of clauses) {
    const text = clause.text.toLowerCase();
    const score = words.filter((w) => text.includes(w.slice(0, Math.max(3, w.length - 2)))).length;
    if (score > 0 && (!best || score > best.score)) best = { clause, score };
  }
  return best?.clause;
}
