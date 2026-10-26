import type { DocumentCheck, RiskLevel } from "@faa/shared";

/**
 * Risk rules for consumer loan agreements (personal, education, app-based loans).
 *
 * A rule only fires when:
 *  1. its pattern matches and the match is not negated ("no prepayment penalty" is a protection), and
 *  2. the clause is operative: it imposes or permits something ("will be deducted", "the lender may
 *     revise", "you agree"), or states a concrete figure (a fee table row such as "Processing fee: 2%").
 * Merely mentioning a term ("students find interest rates confusing") is not a risk.
 *
 * Rules are ordered by specificity: when several fire, the clause takes the category of the first
 * rule at the highest severity.
 */

export interface RiskRule {
  id: string;
  category: string;
  level: Exclude<RiskLevel, "safe">;
  pattern: RegExp;
  /** Raise a caution rule to high when the clause also matches this. */
  escalateIf?: RegExp;
}

export const RULES: RiskRule[] = [
  // ---- High: predatory or scam signals -----------------------------------------------------
  {
    id: "scam-payment",
    category: "Fraud or Scam Language",
    level: "high",
    pattern: /gift\s+cards?|crypto(?:currency)?|bitcoin|wire\s+transfer\s+(?:immediately|urgently)|urgent\s+payment|pay\s+(?:an?\s+)?(?:advance|upfront)\s+(?:fee|amount)[^.;]{0,40}(?:to|before)\s+(?:receive|get|release)|UPI\s+to\s+(?:a\s+)?personal/i,
  },
  {
    id: "contact-harvesting",
    category: "Data Misuse & Harassment Risk",
    level: "high",
    pattern: /access\s+(?:to\s+)?(?:\w+\s+){0,4}(?:contacts?|phone\s*book|photos|gallery|location|call\s+logs?|sms|messages)|contact\s+(?:your\s+|the\s+borrower'?s?\s+)?(?:family|relatives|friends|references|employer|colleagues)|(?:संपर्क(?:ों)?|कॉन्टैक्ट|फोटो|लोकेशन)[^।]{0,60}(?:पहुंच|एक्सेस|अनुमति)|(?:परिवार|रिश्तेदार|मित्र|दोस्त)[^।]{0,40}(?:संपर्क|कॉल|सूचित)/i,
  },
  {
    id: "salary-deduction",
    category: "Salary Deduction",
    level: "high",
    pattern: /(?:deduct|recover|debit)\w*[^.;]{0,60}(?:salary|wages|payroll)|(?:salary|wages|payroll)[^.;]{0,40}(?:deduct|recover)|(?:वेतन|तनख्वाह|सैलरी)[^।]{0,40}(?:कटौती|काट)/i,
  },
  {
    id: "unilateral-rate",
    category: "Variable Interest",
    level: "high",
    pattern: /(?:interest|rate|roi|emi)[^.;]{0,80}(?:sole\s+(?:and\s+absolute\s+)?discretion|without\s+(?:any\s+)?(?:prior\s+)?(?:notice|intimation)|unilateral|at\s+any\s+time)|(?:sole\s+discretion|without\s+(?:any\s+)?(?:prior\s+)?notice)[^.;]{0,80}(?:interest|rate|emi)|ब्याज[^।]{0,60}(?:एकमात्र\s*विवेक|बिना\s*(?:किसी\s*)?(?:सूचना|नोटिस))|(?:एकमात्र\s*विवेक|बिना\s*(?:किसी\s*)?(?:सूचना|नोटिस))[^।]{0,60}ब्याज/i,
  },
  {
    id: "auto-renewal",
    category: "Auto-Renewal Trap",
    level: "high",
    pattern: /auto[- ]?renew|renew(?:s|ed|al)?\s+automatically|automatically\s+(?:be\s+)?renew|(?:स्वतः|अपने\s*आप)[^।]{0,30}(?:नवीनीकरण|नवीनीकृत|रिन्यू)/i,
  },
  {
    id: "penal-charges",
    category: "Penalty Clause",
    level: "caution",
    // "Prepayment penalty" belongs to the prepayment rule, not to late-payment penalties.
    pattern: /(?<!(?:pre[- ]?payment|fore[- ]?closure|pre[- ]?closure|part[- ]?payment)\s)penal(?:ty|ties)?|penal\s+(?:interest|charges?)|late\s+(?:payment\s+)?(?:fees?|charges?)|overdue\s+(?:interest|charges?)|default\s+interest|bounce\s+charges?|liquidated\s+damages|जुर्माना|दंड|पेनल्टी/i,
    // A per-month or per-day penal rate, compounding, or liquidated damages is severe.
    escalateIf: /\d+(?:\.\d+)?\s?%\s*(?:per|a|p\.?)\s*(?:month|day|m\b|d\b)|प्रति\s*(?:माह|दिन)|compound|liquidated\s+damages/i,
  },
  {
    id: "one-sided-arbitration",
    category: "Binding Arbitration",
    level: "high",
    pattern: /arbitrat\w*[^.;]{0,100}(?:appointed|nominated|chosen|selected)\s+(?:solely\s+)?by\s+the\s+(?:lender|bank|company|nbfc)|binding\s+arbitration|(?:waive|give\s+up)\w*[^.;]{0,40}(?:jury|court|legal\s+(?:action|proceedings))/i,
  },
  {
    id: "rights-waiver",
    category: "Rights Waiver",
    level: "high",
    pattern: /(?:waive|give\s+up|relinquish)\w*\s+(?:any\s+and\s+all\s+|all\s+|any\s+|the\s+|your\s+)?(?:rights?|claims?|remed(?:y|ies))/i,
  },
  {
    id: "no-cancellation",
    category: "Cancellation Restriction",
    level: "high",
    pattern: /cancel\w*[^.;]{0,80}(?:not\s+permitted|prohibited|not\s+allowed|no\s+refund|(?:cancellation|termination|exit)\s+(?:fee|charge))|difficult\s+to\s+cancel/i,
  },
  {
    id: "loan-recall",
    category: "Loan Recall",
    level: "high",
    pattern: /(?:recall|demand\s+(?:immediate\s+)?repayment\s+of)\s+(?:the\s+)?(?:entire\s+|whole\s+|full\s+)?(?:loan|outstanding|amount)[^.;]{0,60}(?:at\s+any\s+time|without|sole\s+discretion|on\s+demand)/i,
  },
  {
    id: "undisclosed-fees",
    category: "Hidden Fees",
    level: "high",
    pattern: /hidden\s+(?:fees?|charges?)|(?:not|never)\s+disclosed|undisclosed|charges?\s+as\s+(?:may\s+be\s+)?(?:applicable|determined|decided)(?!\s+in\s+(?:the\s+)?(?:schedule|annex|kfs|key\s+fact))|any\s+other\s+charges|छिपे?\s*(?:हुए)?\s*(?:शुल्क|चार्ज)/i,
  },
  {
    id: "non-refundable",
    category: "Hidden Fees",
    level: "high",
    pattern: /non[- ]?refundable|not\s+refundable|(?:shall|will)\s+not\s+be\s+refund|no\s+refund|वापस\s*नहीं|अप्रतिदेय|नॉन[- ]?रिफंडेबल/i,
  },
  {
    id: "unilateral-terms",
    category: "Unilateral Changes",
    level: "high",
    pattern: /sole\s+(?:and\s+absolute\s+)?discretion|without\s+(?:any\s+)?(?:prior\s+)?(?:notice|intimation)|unilateral(?:ly)?|(?:amend|modify|change|alter)\s+(?:these|the|any)\s+terms[^.;]{0,40}(?:at\s+any\s+time|without)|एकमात्र\s*विवेक|बिना\s*(?:किसी\s*)?(?:सूचना|नोटिस)/i,
  },

  // ---- Caution: common terms the borrower must understand ----------------------------------
  {
    id: "moratorium-interest",
    category: "Interest During Moratorium",
    level: "caution",
    pattern: /(?:interest|simple\s+interest)[^.;]{0,100}(?:moratorium|study\s+period|course\s+period|repayment\s+holiday)[^.;]{0,100}(?:added|capitali[sz]ed|compounded|payable|accrue|charged)|capitali[sz]\w*\s+(?:of\s+)?(?:the\s+)?interest|interest\s+(?:shall|will)\s+be\s+capitali[sz]ed|(?:moratorium|course\s+period)[^.;]{0,80}interest[^.;]{0,40}(?:added|capitali[sz]ed|compounded|charged|accrue)/i,
  },
  {
    id: "floating-rate",
    category: "Floating Rate",
    level: "caution",
    pattern: /(?:floating|variable)\s+(?:rate|interest)|linked\s+to\s+(?:the\s+)?(?:repo|mclr|ebr|eblr|rllr|benchmark|base\s+rate)|reset\s+(?:of\s+)?(?:the\s+)?(?:interest|rate)|बदलने\s*वाली\s*ब्याज/i,
  },
  {
    id: "prepayment-charges",
    category: "Prepayment Charges",
    level: "caution",
    pattern: /(?:pre[- ]?payment|pre[- ]?closure|fore[- ]?closure|part[- ]?payment|early\s+(?:repayment|closure))\s+(?:charges?|penalty|penalties|fees?)/i,
  },
  {
    id: "bundled-insurance",
    category: "Bundled Insurance",
    level: "caution",
    pattern: /(?:mandatory|compulsory|required)[^.;]{0,30}insurance|insurance\s+(?:premium|cover)[^.;]{0,60}(?:deducted|added|financed|included\s+in\s+the\s+loan)/i,
  },
  {
    id: "set-off",
    category: "Right of Set-off",
    level: "caution",
    pattern: /set[- ]?off|lien\s+(?:on|over)|right\s+to\s+(?:debit|appropriate|adjust)[^.;]{0,40}(?:account|deposit)|debit\s+(?:any|all)\s+(?:of\s+)?(?:your\s+|the\s+borrower'?s?\s+)?accounts?/i,
  },
  {
    id: "guarantor-liability",
    category: "Guarantor Liability",
    level: "caution",
    pattern: /guarantor[^.;]{0,80}(?:jointly|severally|personally|fully)\s+(?:and\s+severally\s+)?liable|joint(?:ly)?\s+and\s+several(?:ly)?/i,
  },
  {
    id: "data-sharing",
    category: "Data Sharing",
    level: "caution",
    pattern: /(?:share|disclose|sell|transfer)\w*\s+(?:your\s+|the\s+borrower'?s?\s+)?(?:personal\s+)?(?:data|information|details)[^.;]{0,60}(?:third\s+part|affiliates|partners|any\s+person)|(?:data|information|details)[^.;]{0,30}(?:shared|disclosed|sold|transferred)\s+(?:with|to)[^.;]{0,40}(?:third\s+part|affiliates|partners|any\s+person|marketing)/i,
  },
  {
    id: "upfront-deduction",
    category: "Hidden Fees",
    level: "caution",
    pattern: /(?:fee|charge|premium|interest)s?[^.;]{0,60}(?:deducted|adjusted|withheld)\s+(?:from|out\s+of)\s+(?:the\s+)?(?:loan|disburs)|(?:शुल्क|फीस)[^।]{0,40}(?:ऋण|लोन)\s*राशि\s*से\s*काट/i,
  },
  {
    id: "lock-in",
    category: "Cancellation Restriction",
    level: "caution",
    pattern: /lock[- ]?in\s+period/i,
  },
  {
    id: "fees",
    category: "Processing & Other Fees",
    level: "caution",
    pattern: /(?:processing|administrative|admin|documentation|convenience|login|service|legal|valuation)\s+(?:fees?|charges?)|प्रोसेसिंग\s*शुल्क|प्रसंस्करण\s*शुल्क/i,
  },
  {
    id: "indemnity",
    category: "Indemnification",
    level: "caution",
    pattern: /indemnif/i,
  },
  {
    id: "arbitration",
    category: "Binding Arbitration",
    level: "caution",
    pattern: /arbitrat|मध्यस्थता|आर्बिट्रेशन/i,
  },
  {
    id: "dark-pattern",
    category: "Dark Pattern",
    level: "caution",
    pattern: /free\s+trial[^.;]{0,60}(?:then|automatically)|by\s+(?:continuing|using)[^.;]{0,40}(?:you\s+)?agree|pre[- ]?checked/i,
  },
  {
    id: "discretionary-terms",
    category: "Ambiguous Terms",
    level: "caution",
    pattern: /may\s+(?:be\s+)?(?:revised|changed|modified|varied|amended)|subject\s+to\s+change|from\s+time\s+to\s+time|as\s+(?:may\s+be\s+)?(?:determined|decided|notified)\s+by\s+the\s+(?:lender|bank|company)|at\s+(?:its|our)\s+discretion|परिवर्तन\s*के\s*अधीन|बदला\s*जा\s*सकता/i,
  },
];

/** Terms that protect the borrower. */
export const PROTECTIVE =
  /no\s+(?:hidden\s+)?(?:fees?|charges?)|no\s+(?:pre[- ]?payment|foreclosure|pre[- ]?closure)\s+(?:charges?|penalty)|without\s+(?:any\s+)?(?:pre[- ]?payment|foreclosure)\s+(?:charges?|penalty)|fixed\s+(?:rate|interest)|cooling[- ]?off|look[- ]?up\s+period|key\s+fact\s+statement|written\s+notice|(?:prior|advance)\s+notice|grievance|ombudsman|cancel\s+anytime|कोई\s*छिपा\s*(?:हुआ)?\s*शुल्क\s*नहीं|लिखित\s*सूचना|कभी\s*भी\s*रद्द/i;

/** Language that imposes or permits something, as opposed to describing it. */
const OPERATIVE =
  /\b(?:the\s+)?(?:lender|bank|company|nbfc|creditor|we)\s+(?:may|can|shall|will|is\s+entitled)\b|\b(?:shall|will|must|agrees?|agreed|authori[sz]es?|undertakes?|grants?|consents?|waives?|incurs?|entitled|chargeable|payable|liable|reserves?\s+the\s+right|is\s+(?:charged|deducted|levied|applicable)|are\s+(?:charged|deducted|levied|applicable)|appl(?:y|ies)|may\s+(?:charge|levy|deduct|revise|change|increase|adjust|vary|terminate|recall|debit|contact|share|disclose|assign|access|appoint|renew|cancel|set\s*off|use|be\s+(?:charged|revised|changed|increased|deducted|levied|shared|disclosed|used|transferred|sold)))\b|होगा|होगी|होंगे|सकता|सकती|सकते|करेगा|करेगी|करेंगे|जाएगा|जाएगी|जाएँगे|जाएंगे|लगेगा|लगेगी|सहमत|अनुमति\s*देता/i;

const FIGURE = /\d\s?%|(?:Rs|INR|₹|\$|USD|रु)[.,]?\s?\d/i;

// "shall not be charged any prepayment penalty": the negation can sit a few words before the term.
const NEGATION_BEFORE = /(?:\b(?:no|not|without|nil|zero|free\s+of|never|neither|nor)\b|कोई|बिना)[^.;,।]{0,40}$/i;

export interface Finding {
  rule: RiskRule;
  level: Exclude<RiskLevel, "safe">;
  match: string;
}

export function isOperative(text: string): boolean {
  return OPERATIVE.test(text) || FIGURE.test(text);
}

/** All non-negated rule matches in a clause. */
export function findRisks(text: string): Finding[] {
  const findings: Finding[] = [];
  for (const rule of RULES) {
    const global = new RegExp(rule.pattern.source, rule.pattern.flags.includes("g") ? rule.pattern.flags : rule.pattern.flags + "g");
    for (const m of text.matchAll(global)) {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 40), m.index);
      // "without notice" and "no refund" are risks in their own right; only look before the match.
      if (NEGATION_BEFORE.test(before) && !/^(?:without|no\s+refund|not\s+refundable|बिना)/i.test(m[0])) continue;
      const level = rule.level === "caution" && rule.escalateIf?.test(text) ? "high" : rule.level;
      findings.push({ rule, level, match: m[0] });
      break;
    }
  }
  return findings;
}

/* ------------------------------------------------------------------------------------------ */
/* Is this document actually an agreement?                                                     */
/* ------------------------------------------------------------------------------------------ */

const CONTRACT_SIGNALS: { weight: number; pattern: RegExp; label: string }[] = [
  { weight: 2, label: "refers to itself as an agreement", pattern: /\b(?:this|the)\s+(?:loan\s+|credit\s+|facility\s+)?(?:agreement|contract|deed)\b|समझौता|अनुबंध|करार/i },
  { weight: 2, label: "names the parties", pattern: /\b(?:borrower|lender|creditor|debtor|guarantor|co-?borrower|the\s+bank|nbfc|the\s+company)\b|ऋणदाता|उधारकर्ता|कर्जदार/i },
  { weight: 2, label: "uses binding legal language", pattern: /\b(?:shall|hereby|hereinafter|whereas|herein|thereof|hereto|undertakes?|covenants?)\b|होगा|होगी|होंगे|जाएगा|जाएगी/i },
  { weight: 1, label: "records consent", pattern: /\b(?:agrees?|agreed|consents?|authori[sz]es?|accepts?)\b|सहमत|अनुमति/i },
  { weight: 2, label: "contains loan terms documents", pattern: /\b(?:terms\s+(?:and|&)\s+conditions|sanction\s+letter|key\s+fact\s+statement|loan\s+account\s+(?:no|number)|schedule\s+of\s+charges|disbursal|disbursement)\b/i },
  { weight: 1, label: "has signature or execution wording", pattern: /\b(?:signature|signed|witness|executed|in\s+witness\s+whereof)\b|हस्ताक्षर/i },
];

const NON_CONTRACT_SIGNALS: RegExp[] = [
  /\bproject\s+(?:overview|report|document|title|description)\b/i,
  /\bproblem\s+statement\b/i,
  /\bobjectives?\b/i,
  /\b(?:functional|non-functional)\s+requirements?\b/i,
  /\b(?:main\s+)?(?:features|modules)\b/i,
  /\bfuture\s+(?:scope|enhancements?|work)\b/i,
  /\b(?:abstract|introduction|methodology|literature\s+(?:review|survey)|conclusion|references|bibliography)\b/i,
  /\b(?:intended|target)\s+users\b|\buse\s+cases?\b|\buser\s+(?:stories|workflow)\b|\bsuggested\s+user\s+workflow\b/i,
  /\bthe\s+(?:analy[sz]er|system|application|app|tool|platform|software|website)\s+(?:should|will|shall|can|must)\b/i,
  /\b(?:calculation\s+logic|core\s+inputs|outputs\s+and\s+reports|tech(?:nology)?\s+stack)\b/i,
];

export function checkDocument(text: string): DocumentCheck {
  const found = CONTRACT_SIGNALS.filter((s) => s.pattern.test(text));
  const positive = found.reduce((sum, s) => sum + s.weight, 0);
  const negative = NON_CONTRACT_SIGNALS.filter((p) => p.test(text)).length;
  const tooShort = text.replace(/\s+/g, " ").trim().length < 150;

  const isAgreement = !tooShort && positive >= 4 && negative < Math.max(3, positive / 2);
  const looksLikeReport = negative >= 3;
  return {
    isAgreement,
    confidence: Math.round(Math.min(0.99, Math.abs(positive - negative * 1.5) / 10 + 0.5) * 100) / 100,
    documentType: isAgreement ? "agreement" : looksLikeReport ? "report" : tooShort ? "too-short" : "other",
    signals: found.map((s) => s.label),
  };
}
