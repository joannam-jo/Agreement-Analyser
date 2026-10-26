export const RISK_COLORS = {
  safe: { primary: "#22C55E", bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.4)" },
  caution: { primary: "#F59E0B", bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)" },
  high: { primary: "#EF4444", bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.4)" },
} as const;

export const BRAND = {
  trustBlue: "#2563EB",
  insightBlue: "#06B6D4",
  intelligencePurple: "#7C3AED",
  deepNavy: "#0F172A",
  graphite: "#1E293B",
  slate: "#334155",
  coolGray: "#64748B",
  lightGray: "#F1F5F9",
  offWhite: "#FFFFFF",
} as const;

export const HIGH_RISK_PATTERNS = [
  /auto[- ]?renew/i,
  /variable\s+interest/i,
  /penalty|penalt(y|ies)/i,
  /without\s+notice/i,
  /sole\s+discretion/i,
  /binding\s+arbitration/i,
  /waive.*right/i,
  /liquidated\s+damages/i,
  /(?<!\bno\s)hidden\s+fees?/i,
  /non[- ]?refundable/i,
  /indemnif/i,
  /unilateral/i,
  /forfeiture/i,
  /salary\s+deduct|deduct(?:ed|ion).{0,40}(?:salary|wages|payroll)/i,
  /administrative\s+fee|convenience\s+fee|processing\s+fee/i,
  /cancel(?:lation)?.{0,80}(?:not\s+permitted|prohibited|no\s+refund|(?:cancellation|termination|exit|administrative|processing|foreclosure)\s+(?:fee|charge))/i,
  /renew(?:s|al).{0,80}(?:unless|without\s+further\s+notice)/i,
  /phish|gift\s+card|wire\s+transfer|crypto(?:currency)?|urgent\s+payment/i,
  /access\s+(?:to\s+)?(?:\w+\s+){0,3}(?:contacts|phone\s*book|photos|gallery|location|call\s+logs|sms)/i,
  /contact\s+(?:your\s+|the\s+borrower'?s?\s+)?(?:family|relatives|friends|references|employer|colleagues)/i,
  // Hindi (Devanagari). Word boundaries do not work with Devanagari, so these match phrases.
  /ब्याज\s*(?:दर)?.{0,60}(?:बदल|परिवर्तन|बढ़ा)/,
  /(?:जुर्माना|दंड|पेनल्टी)/,
  /(?:स्वतः|अपने\s*आप).{0,30}(?:नवीनीकरण|नवीनीकृत|रिन्यू)/,
  /(?:वापस\s*नहीं|अप्रतिदेय|नॉन[- ]?रिफंडेबल)/,
  /(?:वेतन|तनख्वाह|सैलरी).{0,40}(?:कटौती|काट)/,
  /(?:संपर्क(?:ों)?|कॉन्टैक्ट|फोटो|लोकेशन).{0,60}(?:पहुंच|एक्सेस|अनुमति)/,
  /(?:परिवार|रिश्तेदार|मित्र|दोस्त).{0,40}(?:संपर्क|कॉल|सूचित)/,
  /(?:एकमात्र\s*विवेक|बिना\s*(?:किसी\s*)?(?:सूचना|नोटिस))/,
  /(?:छिपे?\s*(?:हुए)?\s*(?:शुल्क|चार्ज))/,
  /(?:मध्यस्थता|आर्बिट्रेशन)/,
];

export const CAUTION_PATTERNS = [
  /may\s+change/i,
  /subject\s+to/i,
  /at\s+our\s+discretion/i,
  /reasonable\s+efforts/i,
  /force\s+majeure/i,
  /as\s+determined/i,
  /including\s+but\s+not\s+limited/i,
  /introductory\s+rate|promotional\s+rate/i,
  /material\s+change/i,
  /opt[- ]?out/i,
  /third[- ]party\s+fees?/i,
  /estimated|approximate/i,
  /(?:परिवर्तन\s*के\s*अधीन|बदला\s*जा\s*सकता|अनुमानित|लगभग)/,
];

export const SAFE_PATTERNS = [
  /cancel\s+anytime/i,
  /no\s+hidden\s+fees/i,
  /transparent/i,
  /30[- ]?day/i,
  /money[- ]?back/i,
  /written\s+notice/i,
  /(?:कोई\s*छिपा\s*(?:हुआ)?\s*शुल्क\s*नहीं|लिखित\s*सूचना|कभी\s*भी\s*रद्द)/,
];
