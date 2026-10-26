import type { LoanTerms } from "@faa/shared";

/**
 * Pulls the numbers needed for a true-cost calculation out of the agreement text.
 * Every value keeps the sentence it came from so the user can check it; anything not found is
 * left empty for the user to fill in rather than guessed.
 */

// OCR often turns "Rs." into "Rs," so either mark is accepted after the currency; the number must start with a digit.
const AMOUNT = String.raw`(?:Rs|INR|₹|\$|USD|रु|रुपये)[.,]?\s?(\d[\d,]*(?:\.\d{1,2})?)(?:\s?(?:/-|रुपये))?`;
// OCR frequently misreads the rare letter "ऋ", e.g. "ऋण" as "करण"/"रिण" and "ऋणदाता" as "कणदाता".
const LOAN_HI = String.raw`(?:ऋण|लोन|करण|रिण|कण)`;

export function extractLoanTerms(text: string): LoanTerms {
  const sentences = splitSentences(text);
  const terms: LoanTerms = { currency: detectCurrency(text), sources: {} };

  const lender = matchFirst(sentences, [
    /between\s+(.{3,80}?(?:Ltd\.?|Limited|Pvt\.?\s*Ltd\.?|Bank|Finance|Financial Services|NBFC|Capital|Fintech))(?=[\s,(.]|$)/i,
    /(?:^|\s)Lender[:\s-]+([A-Z][\w&.,' -]{2,60}?(?:Ltd\.?|Limited|Bank|Finance|Capital))/,
    new RegExp(String.raw`समझौता\s+([^()।]{3,60}?)\s*\(\s*` + LOAN_HI + String.raw`दाता\s*\)`),
    new RegExp(String.raw`(?:^|\s)([^\s,।(]+(?:\s[^\s,।(]+){0,3}?\s(?:प्रा\.?\s*लि\.?|लिमिटेड|बैंक|फाइनेंस))\s*\(\s*` + LOAN_HI + String.raw`दाता\s*\)`),
    /(?:^|\s)([A-Z][\w&.' -]{2,60}?)\s*\(\s*(?:the\s+)?Lender\s*\)/,
  ]);
  if (lender) {
    // Trim OCR debris such as a stray "[" or "|" around the name.
    terms.lenderName = lender.value.replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[\s,]+$/gu, "").trim();
    terms.sources.lenderName = lender.sentence;
  }

  const principal = matchFirst(sentences, [
    new RegExp(String.raw`(?:loan\s+amount|principal(?:\s+amount)?|sanctioned\s+amount|amount\s+of\s+(?:the\s+)?loan|loan\s+of)[^.\d₹$]{0,40}` + AMOUNT, "i"),
    new RegExp(AMOUNT + String.raw`[^.]{0,30}(?:loan|principal)`, "i"),
    new RegExp(LOAN_HI + String.raw`\s*राशि[^।\d₹]{0,30}` + AMOUNT),
  ]);
  if (principal) {
    terms.principal = toNumber(principal.value);
    terms.sources.principal = principal.sentence;
  }

  const rate = matchFirst(sentences, [
    /(?:interest|rate|ROI)[^.%]{0,60}?(\d{1,2}(?:\.\d{1,2})?)\s?%\s*(?:per\s+annum|p\.?\s?a\.?|per\s+year|annual(?:ly)?|a\s+year)/i,
    /(\d{1,2}(?:\.\d{1,2})?)\s?%\s*(?:per\s+annum|p\.?\s?a\.?|per\s+year|annual(?:ly)?)[^.]{0,40}interest/i,
    /ब्याज[^।%]{0,40}?(\d{1,2}(?:\.\d{1,2})?)\s?%\s*(?:प्रति\s*वर्ष|वार्षिक)/,
  ]);
  const monthlyRate = !rate
    ? matchFirst(sentences, [/(?:interest|rate)[^.%]{0,60}?(\d{1,2}(?:\.\d{1,2})?)\s?%\s*(?:per\s+month|p\.?\s?m\.?|monthly|a\s+month)/i])
    : undefined;
  if (rate) {
    terms.annualRatePct = Number(rate.value);
    terms.sources.annualRatePct = rate.sentence;
  } else if (monthlyRate) {
    terms.annualRatePct = Number(monthlyRate.value) * 12;
    terms.sources.annualRatePct = monthlyRate.sentence;
  }

  const tenure = matchFirst(sentences, [
    /(\d{1,3})\s+(?:equated\s+)?(?:monthly\s+)?(?:instal?ments|EMIs|months)/i,
    /(?:tenure|term|period)[^.\d]{0,30}(\d{1,3})\s*months/i,
    /(\d{1,3})\s*(?:मासिक\s*)?(?:किस्तों|किस्तें|महीने|माह)/,
  ]);
  const tenureYears = !tenure ? matchFirst(sentences, [/(?:tenure|term|period)[^.\d]{0,30}(\d{1,2})\s*years?/i]) : undefined;
  if (tenure) {
    terms.tenureMonths = Number(tenure.value);
    terms.sources.tenureMonths = tenure.sentence;
  } else if (tenureYears) {
    terms.tenureMonths = Number(tenureYears.value) * 12;
    terms.sources.tenureMonths = tenureYears.sentence;
  }

  const feeAmount = matchFirst(sentences, [
    new RegExp(String.raw`(?:processing|documentation|administrative|login|upfront|disbursal|insurance)\s+(?:fee|charge)s?[^.\d₹$%]{0,40}` + AMOUNT, "i"),
    new RegExp(String.raw`(?:प्रोसेसिंग|प्रसंस्करण)\s*(?:शुल्क|फीस)[^।\d₹%]{0,30}` + AMOUNT),
    new RegExp(AMOUNT + String.raw`\s*का\s*(?:प्रोसेसिंग|प्रसंस्करण)\s*(?:शुल्क|फीस)`),
  ]);
  const feePct = !feeAmount
    ? matchFirst(sentences, [/(?:processing|documentation|administrative|upfront)\s+(?:fee|charge)s?[^.\d%]{0,40}(\d{1,2}(?:\.\d{1,2})?)\s?%/i])
    : undefined;
  if (feeAmount) {
    terms.upfrontFees = toNumber(feeAmount.value);
    terms.sources.upfrontFees = feeAmount.sentence;
  } else if (feePct && terms.principal) {
    terms.upfrontFees = Math.round((terms.principal * Number(feePct.value)) / 100);
    terms.sources.upfrontFees = feePct.sentence;
  }

  const late = matchFirst(sentences, [
    /(?:late|overdue|penal|delay)[^.%]{0,60}?(\d{1,2}(?:\.\d{1,2})?)\s?%\s*(?:per\s+month|p\.?\s?m\.?|monthly|a\s+month)/i,
    /(?:late|overdue|penal|delay)[^.%]{0,60}?(\d{1,2}(?:\.\d{1,2})?)\s?%\s*(?:per\s+day|daily)/i,
    /(\d{1,2}(?:\.\d{1,2})?)\s?%\s*(?:प्रति\s*माह|मासिक)[^।]{0,30}(?:जुर्माना|दंड|पेनल्टी)/,
  ]);
  if (late) {
    const perDay = /per\s+day|daily/i.test(late.sentence);
    terms.latePenaltyMonthlyPct = Number(late.value) * (perDay ? 30 : 1);
    terms.sources.latePenaltyMonthlyPct = late.sentence;
  }

  return terms;
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    // Split on sentence ends, but not after abbreviations such as "Rs." or "Pvt. Ltd.".
    .split(/(?<=[.;!?।])(?<!\b(?:Rs|Pvt|Ltd|No|Mr|Mrs|Ms|Dr|Co|Inc|St|vs|approx|Sr|Jr)\.)(?<!(?:रु|प्रा|लि|सं|श्री)\.)\s+(?=[A-Z0-9"“(ऀ-ॿ])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function matchFirst(sentences: string[], patterns: RegExp[]): { value: string; sentence: string } | undefined {
  for (const pattern of patterns) {
    for (const sentence of sentences) {
      const match = sentence.match(pattern);
      if (match?.[1]) return { value: match[1], sentence: sentence.slice(0, 300) };
    }
  }
  return undefined;
}

function toNumber(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function detectCurrency(text: string): LoanTerms["currency"] {
  if (/₹|\bRs\.?\s?\d|\bINR\b|रुपये|रु\.|\bEMI\b/.test(text)) return "INR";
  if (/\$\s?\d|\bUSD\b/.test(text)) return "USD";
  return "OTHER";
}
