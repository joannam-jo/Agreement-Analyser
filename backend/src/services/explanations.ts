import type { AgreementAnalysis, ClauseAnalysis, ExplanationLanguage, RiskLevel } from "@faa/shared";

/**
 * Plain-language explanations per risk type, in every supported language. Used when no AI
 * provider is configured, and to switch an existing analysis to another language instantly.
 */

interface ClauseGuide {
  plain: string;
  why: string;
  impact: string;
  consequences: string[];
  do: string[];
  avoid: string[];
}

type GuideSet = Record<string, ClauseGuide>;

const GUIDES_EN: GuideSet = {
  "Unilateral Changes": {
    plain: "The lender can change the terms on its own, without asking you and possibly without telling you first.",
    why: "Terms that one side can change \"at its sole discretion\" or \"without notice\" mean the deal you sign may not be the deal you get.",
    impact: "Costs, rates or conditions can change after you are already committed.",
    consequences: ["New charges or conditions you never agreed to", "No time to react before a change applies"],
    do: ["Ask for changes only with advance written notice (for example 30 days) and your right to exit without penalty"],
    avoid: ["Accepting \"sole discretion\" wording for money matters"],
  },
  "Floating Rate": {
    plain: "Your interest rate moves with a benchmark (such as the RBI repo rate), so your EMI or loan tenure can change over time.",
    why: "Floating rates are common and can fall as well as rise, but you should know exactly how they are set.",
    impact: "If the benchmark rises, you pay more each month or for more months.",
    consequences: ["EMI or tenure can increase during the loan"],
    do: ["Ask which benchmark is used, the spread added to it, and how often the rate resets", "Ask whether you can switch to a fixed rate and at what cost"],
    avoid: ["Assuming today's rate will stay the same for the whole loan"],
  },
  "Interest During Moratorium": {
    plain: "Interest keeps building up while you study and during the moratorium, and unpaid interest is added to your loan.",
    why: "When interest is capitalised, you later pay interest on that interest, which can make an education loan much more expensive than it looks.",
    impact: "The amount you owe when repayment starts can be well above what you borrowed.",
    consequences: ["Larger loan balance at the start of repayment", "Higher EMIs or a longer tenure"],
    do: ["Ask how interest is calculated during the course and moratorium", "Pay the simple interest during your studies if you can", "Check if you qualify for an interest subsidy scheme (for example the government's CSIS for eligible students)"],
    avoid: ["Assuming no interest is charged until repayment starts"],
  },
  "Prepayment Charges": {
    plain: "You will be charged a fee if you repay the loan early, fully or in part.",
    why: "Prepayment charges make it expensive to close the loan when you have money or find a cheaper loan.",
    impact: "Paying off early costs extra, so you may stay in a costly loan longer.",
    consequences: ["Extra cost to close or part-pay the loan"],
    do: ["Ask for zero prepayment charges", "For floating-rate loans to individuals, RBI rules generally do not allow foreclosure charges, so ask the lender to confirm"],
    avoid: ["Ignoring this if you expect to repay early"],
  },
  "Processing & Other Fees": {
    plain: "One-time charges such as a processing or documentation fee apply to this loan.",
    why: "These fees are common, but they raise the real cost of the loan, especially when deducted from the amount you receive.",
    impact: "The true yearly cost (APR) is higher than the interest rate alone.",
    consequences: ["Slightly less money in hand", "Higher APR than the advertised rate"],
    do: ["Confirm the exact amount including GST", "Compare offers using APR, not just the interest rate"],
    avoid: ["Comparing loans on interest rate alone"],
  },
  "Bundled Insurance": {
    plain: "Insurance is required or added to the loan, and its premium may be financed so you pay interest on it too.",
    why: "Bundled insurance increases the loan amount and the total cost, and is sometimes presented as compulsory when it is not.",
    impact: "You repay the premium plus interest on it.",
    consequences: ["Higher total repayment"],
    do: ["Ask whether the insurance is optional and whether you can use your own policy", "Ask for the premium to be shown separately"],
    avoid: ["Assuming bundled insurance is mandatory"],
  },
  "Right of Set-off": {
    plain: "The lender can take money from your other accounts or deposits with it to recover what you owe.",
    why: "Set-off lets the lender recover dues without asking you, which can empty a savings account you rely on.",
    impact: "Your savings or fixed deposits with the same bank can be used to pay the loan.",
    consequences: ["Money taken from other accounts without warning"],
    do: ["Ask for advance notice before any set-off", "Keep essential savings with a different bank if you are worried"],
    avoid: ["Assuming your other accounts are separate from the loan"],
  },
  "Guarantor Liability": {
    plain: "The guarantor or co-borrower (often a parent) is fully responsible for the loan if you do not pay.",
    why: "Joint and several liability means the lender can recover the whole amount from any of you.",
    impact: "Missed payments can affect your guarantor's credit score and assets.",
    consequences: ["Recovery action against your guarantor", "Damage to their credit history"],
    do: ["Make sure the guarantor understands they owe the full amount if you default"],
    avoid: ["Treating a guarantee as a formality"],
  },
  "Loan Recall": {
    plain: "The lender can demand the whole outstanding loan back at any time.",
    why: "A recall clause without clear conditions lets the lender end the loan suddenly, even if you pay on time.",
    impact: "You may have to repay everything at short notice.",
    consequences: ["Sudden demand for the full amount"],
    do: ["Ask for recall to be limited to clearly defined defaults, with notice and a chance to fix the problem"],
    avoid: ["Accepting recall \"at any time\" or \"at sole discretion\""],
  },
  "Data Sharing": {
    plain: "Your personal information can be shared with third parties such as partners or affiliates.",
    why: "Broad data-sharing consent can lead to marketing calls or misuse of your details.",
    impact: "You lose control over who holds your personal data.",
    consequences: ["Unwanted calls and messages", "Your data held by companies you never dealt with"],
    do: ["Ask exactly who data is shared with and for what purpose, and how to withdraw consent"],
    avoid: ["Giving blanket consent to share your data"],
  },
  "Rights Waiver": {
    plain: "You give up legal rights or claims you would normally have.",
    why: "Waivers remove your ability to challenge unfair treatment later.",
    impact: "You may have no remedy if something goes wrong.",
    consequences: ["Loss of legal protection"],
    do: ["Ask for the waiver to be removed or narrowed", "Keep your right to approach consumer courts and the ombudsman"],
    avoid: ["Signing away rights you do not understand"],
  },
  "Variable Interest": {
    plain: "The lender can raise your interest rate whenever it wants, so your EMI (monthly payment) can go up.",
    why: "The rate is not fixed and can change at the lender's discretion, often without notice.",
    impact: "Your monthly payment and the total cost of the loan can rise after you sign.",
    consequences: ["Higher EMIs than you planned for", "Total repayment much larger than quoted"],
    do: ["Ask for a fixed rate, or a cap on how much the rate can rise", "Ask for written notice at least 30 days before any change"],
    avoid: ["Budgeting only for the first EMI amount"],
  },
  "Hidden Fees": {
    plain: "You will pay extra charges on top of the interest, and some may be taken before you receive the money.",
    why: "Fees that are deducted upfront, non-refundable, or not clearly listed raise the real cost of the loan.",
    impact: "You receive less money than the loan amount but repay the full amount plus interest.",
    consequences: ["Lower amount actually received", "Higher effective interest rate (APR)"],
    do: ["Ask for a written list of every fee and the exact amount you will receive", "Ask for the APR, which includes all fees"],
    avoid: ["Agreeing to fees that are not disclosed upfront"],
  },
  "Auto-Renewal Trap": {
    plain: "The agreement renews by itself unless you cancel, and cancelling may be difficult or cost money.",
    why: "Automatic renewal combined with cancellation fees or friction keeps you paying longer than intended.",
    impact: "You may be charged for another full term if you miss the cancellation window.",
    consequences: ["Unwanted renewal charges", "Fees to get out"],
    do: ["Ask for renewal only with your written consent", "Put the cancellation deadline in your calendar"],
    avoid: ["Assuming the agreement ends on its own"],
  },
  "Penalty Clause": {
    plain: "Missing or delaying a payment costs you a lot in penalties, and fees are non-refundable.",
    why: "High penalty rates (for example a percentage per month) compound quickly and can exceed the original loan.",
    impact: "A short delay can add a large amount to what you owe.",
    consequences: ["Debt growing faster than you can repay", "Penalties on top of interest"],
    do: ["Ask for a flat, capped late fee and a grace period", "Ask how penalties are calculated, in writing"],
    avoid: ["Signing if you are unsure you can pay every instalment on time"],
  },
  "Salary Deduction": {
    plain: "The lender can take money directly from your salary through your employer.",
    why: "Direct salary deduction without fresh consent removes your control over your income and involves your employer.",
    impact: "Money can be taken before you can pay rent, food or other essentials.",
    consequences: ["Loss of control over your pay", "Your employer learning about your debt"],
    do: ["Refuse automatic salary deduction, or require your written consent for each deduction"],
    avoid: ["Giving the lender your employer's details unless required"],
  },
  "Data Misuse & Harassment Risk": {
    plain: "The lender can access your phone's contacts, photos or location and may contact your family or friends to recover money.",
    why: "This is a common tactic of predatory loan apps and is often used for harassment and public shaming.",
    impact: "Your personal data and relationships can be used as pressure if you are late.",
    consequences: ["Calls or messages to your family and contacts", "Misuse of your photos or personal data"],
    do: ["Do not accept this. Legitimate lenders do not need your contacts or photos", "Report harassment to the regulator or the cyber-crime cell"],
    avoid: ["Granting contact, photo or location permissions to loan apps"],
  },
  "Binding Arbitration": {
    plain: "You give up your right to go to court, and disputes are decided by an arbitrator the lender chooses.",
    why: "Arbitration controlled by one side, in its location, makes it hard and costly to challenge unfair treatment.",
    impact: "You may have no fair way to dispute wrong charges.",
    consequences: ["Limited legal recourse", "Travel and legal costs to raise a dispute"],
    do: ["Ask for a neutral arbitrator and a location near you", "Keep your right to approach consumer courts and the ombudsman"],
    avoid: ["Waiving all your legal rights"],
  },
  "Hidden Instructions to AI": {
    plain: "This text is aimed at automated review tools, not at you. It tries to make software rate the document as safe.",
    why: "Legitimate agreements never contain instructions for AI tools. This is a strong sign of deliberate deception.",
    impact: "The document may hide other unfair terms.",
    consequences: ["Being misled about the real terms"],
    do: ["Do not sign. Report the lender to the regulator"],
    avoid: ["Trusting any automated 'safe' rating of this document"],
  },
  "Hidden Text": {
    plain: "Part of this document is printed too small to read, so you would agree to terms you cannot see.",
    why: "Hidden or microscopic text is a deceptive practice used to slip in unfair terms.",
    impact: "You could be bound by terms you never saw.",
    consequences: ["Agreeing to invisible terms"],
    do: ["Ask for a clean copy with all terms readable, or do not sign"],
    avoid: ["Signing documents with unreadable sections"],
  },
  "Cancellation Restriction": {
    plain: "Cancelling or closing this agreement early is restricted or costs money.",
    why: "Exit fees or bans on cancellation lock you in even if the terms become unaffordable.",
    impact: "Leaving early may be expensive.",
    consequences: ["Exit fees", "Being locked in"],
    do: ["Ask for penalty-free cancellation within a cooling-off period"],
    avoid: ["Assuming you can leave at any time"],
  },
  "Fraud or Scam Language": {
    plain: "This clause asks for payment methods commonly used in scams (gift cards, crypto, urgent wire transfers).",
    why: "Genuine lenders do not ask for these payment methods.",
    impact: "Money sent this way is usually impossible to recover.",
    consequences: ["Losing money with no way to get it back"],
    do: ["Stop and verify the lender independently before paying anything"],
    avoid: ["Paying any upfront fee to receive a loan"],
  },
};

const GUIDES_HI: GuideSet = {
  "Unilateral Changes": {
    plain: "ऋणदाता आपसे पूछे बिना, और शायद पहले बताए बिना, शर्तें खुद बदल सकता है।",
    why: "\"एकमात्र विवेक\" या \"बिना सूचना\" वाली शर्तों का मतलब है कि जो सौदा आप करते हैं, वह बाद में बदल सकता है।",
    impact: "प्रतिबद्ध होने के बाद खर्च, दरें या शर्तें बदल सकती हैं।",
    consequences: ["ऐसे शुल्क या शर्तें जिन पर आप कभी सहमत नहीं हुए", "बदलाव से पहले प्रतिक्रिया का समय नहीं"],
    do: ["बदलाव केवल पहले से लिखित सूचना (जैसे 30 दिन) और बिना जुर्माने के बाहर निकलने के अधिकार के साथ हों, यह माँगें"],
    avoid: ["पैसों से जुड़े मामलों में \"एकमात्र विवेक\" वाली भाषा मानना"],
  },
  "Floating Rate": {
    plain: "आपकी ब्याज दर किसी बेंचमार्क (जैसे RBI रेपो रेट) के साथ बदलती है, इसलिए समय के साथ आपकी EMI या अवधि बदल सकती है।",
    why: "फ्लोटिंग दरें आम हैं और घट भी सकती हैं, पर आपको पता होना चाहिए कि ये कैसे तय होती हैं।",
    impact: "बेंचमार्क बढ़ने पर आप हर महीने ज़्यादा या ज़्यादा महीनों तक भुगतान करेंगे।",
    consequences: ["ऋण के दौरान EMI या अवधि बढ़ सकती है"],
    do: ["पूछें कि कौन सा बेंचमार्क है, उस पर कितना स्प्रेड जुड़ता है, और दर कितनी बार बदलती है", "पूछें कि क्या फिक्स्ड दर में बदल सकते हैं और उसकी लागत क्या है"],
    avoid: ["यह मानना कि आज की दर पूरे ऋण में वही रहेगी"],
  },
  "Interest During Moratorium": {
    plain: "पढ़ाई और मोरेटोरियम के दौरान ब्याज बढ़ता रहता है, और न चुकाया गया ब्याज आपके ऋण में जुड़ जाता है।",
    why: "ब्याज जुड़ने (कैपिटलाइज़ होने) पर बाद में आप ब्याज पर भी ब्याज देते हैं, जिससे शिक्षा ऋण दिखने से काफी महँगा हो सकता है।",
    impact: "भुगतान शुरू होने तक बकाया राशि उधार ली गई राशि से काफी ज़्यादा हो सकती है।",
    consequences: ["भुगतान की शुरुआत में बड़ा बकाया", "ज़्यादा EMI या लंबी अवधि"],
    do: ["पूछें कि पढ़ाई और मोरेटोरियम में ब्याज कैसे गिना जाता है", "हो सके तो पढ़ाई के दौरान साधारण ब्याज चुकाते रहें", "जाँचें कि क्या आप किसी ब्याज सब्सिडी योजना (जैसे पात्र छात्रों के लिए सरकार की CSIS) के पात्र हैं"],
    avoid: ["यह मानना कि भुगतान शुरू होने तक कोई ब्याज नहीं लगता"],
  },
  "Prepayment Charges": {
    plain: "ऋण जल्दी चुकाने पर, पूरा या आंशिक, आपसे शुल्क लिया जाएगा।",
    why: "प्रीपेमेंट शुल्क के कारण पैसा होने पर या सस्ता ऋण मिलने पर भी ऋण बंद करना महँगा हो जाता है।",
    impact: "जल्दी चुकाने पर अतिरिक्त खर्च, इसलिए आप महँगे ऋण में ज़्यादा समय रह सकते हैं।",
    consequences: ["ऋण बंद करने या आंशिक भुगतान पर अतिरिक्त खर्च"],
    do: ["शून्य प्रीपेमेंट शुल्क माँगें", "व्यक्तियों को दिए फ्लोटिंग-रेट ऋण पर RBI नियम आमतौर पर फोरक्लोज़र शुल्क की अनुमति नहीं देते, ऋणदाता से पुष्टि करें"],
    avoid: ["जल्दी चुकाने की योजना हो तो इसे नज़रअंदाज़ करना"],
  },
  "Processing & Other Fees": {
    plain: "इस ऋण पर प्रोसेसिंग या डॉक्यूमेंटेशन जैसे एक बार के शुल्क लगते हैं।",
    why: "ये शुल्क आम हैं, पर ऋण की असली लागत बढ़ाते हैं, खासकर जब मिलने वाली राशि से काटे जाएँ।",
    impact: "असली सालाना लागत (APR) केवल ब्याज दर से ज़्यादा होती है।",
    consequences: ["हाथ में थोड़ा कम पैसा", "बताई गई दर से ज़्यादा APR"],
    do: ["GST सहित सही राशि की पुष्टि करें", "ऋणों की तुलना APR से करें, केवल ब्याज दर से नहीं"],
    avoid: ["केवल ब्याज दर देखकर ऋणों की तुलना करना"],
  },
  "Bundled Insurance": {
    plain: "ऋण के साथ बीमा ज़रूरी है या जोड़ा गया है, और उसका प्रीमियम भी ऋण में जुड़ सकता है जिस पर ब्याज लगेगा।",
    why: "जोड़ा गया बीमा ऋण राशि और कुल लागत बढ़ाता है, और कभी-कभी ज़रूरी न होते हुए भी ज़रूरी बताया जाता है।",
    impact: "आप प्रीमियम और उस पर ब्याज दोनों चुकाते हैं।",
    consequences: ["कुल भुगतान ज़्यादा"],
    do: ["पूछें कि बीमा वैकल्पिक है या नहीं और क्या आप अपनी पॉलिसी इस्तेमाल कर सकते हैं", "प्रीमियम अलग से दिखाने को कहें"],
    avoid: ["यह मान लेना कि जोड़ा गया बीमा अनिवार्य है"],
  },
  "Right of Set-off": {
    plain: "बकाया वसूलने के लिए ऋणदाता उसी बैंक में आपके दूसरे खातों या जमा से पैसा ले सकता है।",
    why: "सेट-ऑफ से ऋणदाता बिना पूछे वसूली कर सकता है, जिससे ज़रूरी बचत खाता खाली हो सकता है।",
    impact: "उसी बैंक में आपकी बचत या FD ऋण चुकाने में इस्तेमाल हो सकती है।",
    consequences: ["बिना चेतावनी दूसरे खातों से पैसा कटना"],
    do: ["किसी भी सेट-ऑफ से पहले सूचना माँगें", "चिंता हो तो ज़रूरी बचत दूसरे बैंक में रखें"],
    avoid: ["यह मानना कि आपके दूसरे खाते ऋण से अलग हैं"],
  },
  "Guarantor Liability": {
    plain: "आप भुगतान न करें तो गारंटर या सह-उधारकर्ता (अक्सर माता-पिता) पूरे ऋण के ज़िम्मेदार हैं।",
    why: "संयुक्त और पृथक देयता का मतलब है कि ऋणदाता आप में से किसी से भी पूरी राशि वसूल सकता है।",
    impact: "छूटे भुगतान आपके गारंटर के क्रेडिट स्कोर और संपत्ति पर असर डाल सकते हैं।",
    consequences: ["गारंटर के खिलाफ वसूली कार्रवाई", "उनके क्रेडिट इतिहास को नुकसान"],
    do: ["सुनिश्चित करें कि गारंटर समझता है कि डिफ़ॉल्ट होने पर पूरी राशि उसे देनी होगी"],
    avoid: ["गारंटी को सिर्फ औपचारिकता समझना"],
  },
  "Loan Recall": {
    plain: "ऋणदाता कभी भी पूरा बकाया ऋण वापस माँग सकता है।",
    why: "साफ़ शर्तों के बिना रिकॉल की शर्त से ऋणदाता अचानक ऋण खत्म कर सकता है, भले आप समय पर भुगतान कर रहे हों।",
    impact: "आपको कम समय में सब कुछ चुकाना पड़ सकता है।",
    consequences: ["पूरी राशि की अचानक माँग"],
    do: ["रिकॉल को साफ़ परिभाषित डिफ़ॉल्ट तक सीमित करने, सूचना देने और सुधार का मौका देने की माँग करें"],
    avoid: ["\"कभी भी\" या \"एकमात्र विवेक\" पर रिकॉल स्वीकार करना"],
  },
  "Data Sharing": {
    plain: "आपकी निजी जानकारी पार्टनर या सहयोगी कंपनियों जैसे तीसरे पक्षों से साझा की जा सकती है।",
    why: "डेटा साझा करने की व्यापक सहमति से मार्केटिंग कॉल या जानकारी का दुरुपयोग हो सकता है।",
    impact: "आपका निजी डेटा किसके पास है, इस पर आपका नियंत्रण नहीं रहता।",
    consequences: ["अनचाही कॉल और मैसेज", "आपका डेटा उन कंपनियों के पास जिनसे आपने कभी लेन-देन नहीं किया"],
    do: ["पूछें कि डेटा किसके साथ और किस उद्देश्य से साझा होता है, और सहमति कैसे वापस लें"],
    avoid: ["डेटा साझा करने की खुली सहमति देना"],
  },
  "Rights Waiver": {
    plain: "आप अपने कानूनी अधिकार या दावे छोड़ देते हैं जो आमतौर पर आपके पास होते।",
    why: "अधिकार छोड़ने से बाद में गलत व्यवहार को चुनौती देने की क्षमता खत्म हो जाती है।",
    impact: "कुछ गलत होने पर आपके पास कोई उपाय न हो।",
    consequences: ["कानूनी सुरक्षा खोना"],
    do: ["इस शर्त को हटाने या सीमित करने को कहें", "उपभोक्ता अदालत और लोकपाल के पास जाने का अधिकार बनाए रखें"],
    avoid: ["बिना समझे अधिकार छोड़ना"],
  },
  "Variable Interest": {
    plain: "ऋणदाता जब चाहे आपकी ब्याज दर बढ़ा सकता है, जिससे आपकी EMI (मासिक किस्त) बढ़ सकती है।",
    why: "ब्याज दर तय नहीं है और ऋणदाता अपनी मर्ज़ी से, अक्सर बिना सूचना के, इसे बदल सकता है।",
    impact: "हस्ताक्षर के बाद आपकी मासिक किस्त और ऋण की कुल लागत बढ़ सकती है।",
    consequences: ["योजना से ज़्यादा EMI", "बताई गई राशि से कहीं ज़्यादा कुल भुगतान"],
    do: ["तय (फिक्स्ड) ब्याज दर माँगें, या दर बढ़ने की एक सीमा तय करवाएँ", "किसी भी बदलाव से कम से कम 30 दिन पहले लिखित सूचना माँगें"],
    avoid: ["सिर्फ पहली EMI के हिसाब से बजट बनाना"],
  },
  "Hidden Fees": {
    plain: "ब्याज के अलावा आपको अतिरिक्त शुल्क देने होंगे, और कुछ शुल्क पैसा मिलने से पहले ही काट लिए जाएँगे।",
    why: "पहले से कटने वाले, वापस न होने वाले या साफ़ न बताए गए शुल्क ऋण की असली लागत बढ़ा देते हैं।",
    impact: "आपको ऋण राशि से कम पैसा मिलता है, पर चुकानी पूरी राशि ब्याज सहित पड़ती है।",
    consequences: ["हाथ में कम पैसा आना", "असली ब्याज दर (APR) ज़्यादा होना"],
    do: ["हर शुल्क की लिखित सूची और हाथ में मिलने वाली सही राशि माँगें", "APR पूछें, जिसमें सभी शुल्क शामिल होते हैं"],
    avoid: ["ऐसे शुल्क मानना जो पहले से नहीं बताए गए"],
  },
  "Auto-Renewal Trap": {
    plain: "जब तक आप रद्द न करें, यह समझौता अपने आप आगे बढ़ जाता है, और रद्द करना मुश्किल या महँगा हो सकता है।",
    why: "अपने आप नवीनीकरण और रद्द करने के शुल्क आपको ज़रूरत से ज़्यादा समय तक भुगतान करते रहने पर मजबूर करते हैं।",
    impact: "रद्द करने की समय-सीमा चूकने पर आपसे एक और पूरी अवधि का शुल्क लिया जा सकता है।",
    consequences: ["अनचाहा नवीनीकरण शुल्क", "बाहर निकलने के लिए शुल्क"],
    do: ["नवीनीकरण केवल आपकी लिखित सहमति से हो, यह शर्त रखें", "रद्द करने की आखिरी तारीख कैलेंडर में लिख लें"],
    avoid: ["यह मान लेना कि समझौता अपने आप खत्म हो जाएगा"],
  },
  "Penalty Clause": {
    plain: "किस्त चूकने या देर से देने पर भारी जुर्माना लगता है, और शुल्क वापस नहीं होते।",
    why: "ऊँची जुर्माना दर (जैसे हर महीने कुछ प्रतिशत) तेज़ी से बढ़ती है और मूल ऋण से भी ज़्यादा हो सकती है।",
    impact: "थोड़ी सी देरी भी आपके बकाया में बड़ी राशि जोड़ सकती है।",
    consequences: ["कर्ज़ का चुकाने से तेज़ बढ़ना", "ब्याज के ऊपर जुर्माना"],
    do: ["तय और सीमित देर-शुल्क तथा कुछ दिनों की छूट (ग्रेस पीरियड) माँगें", "जुर्माना कैसे गिना जाता है, यह लिखित में पूछें"],
    avoid: ["अगर हर किस्त समय पर चुकाने का भरोसा न हो तो हस्ताक्षर करना"],
  },
  "Salary Deduction": {
    plain: "ऋणदाता आपके नियोक्ता (कंपनी) के ज़रिए सीधे आपके वेतन से पैसा काट सकता है।",
    why: "बिना नई सहमति के वेतन से सीधी कटौती आपकी आय पर आपका नियंत्रण खत्म करती है और आपके नियोक्ता को शामिल करती है।",
    impact: "किराया, खाना या ज़रूरी खर्चों से पहले ही पैसा कट सकता है।",
    consequences: ["अपने वेतन पर नियंत्रण खोना", "नियोक्ता को आपके कर्ज़ के बारे में पता चलना"],
    do: ["अपने आप वेतन कटौती से मना करें, या हर कटौती के लिए लिखित सहमति की शर्त रखें"],
    avoid: ["बिना ज़रूरत ऋणदाता को नियोक्ता की जानकारी देना"],
  },
  "Data Misuse & Harassment Risk": {
    plain: "ऋणदाता आपके फोन के संपर्क, फोटो या लोकेशन देख सकता है और वसूली के लिए आपके परिवार या दोस्तों से संपर्क कर सकता है।",
    why: "यह धोखेबाज़ लोन ऐप्स का आम तरीका है, जिसका इस्तेमाल अक्सर परेशान करने और बदनाम करने के लिए होता है।",
    impact: "देरी होने पर आपका निजी डेटा और रिश्ते दबाव बनाने के लिए इस्तेमाल हो सकते हैं।",
    consequences: ["परिवार और संपर्कों को कॉल या मैसेज", "आपकी फोटो या निजी डेटा का दुरुपयोग"],
    do: ["इसे स्वीकार न करें। असली ऋणदाताओं को आपके संपर्क या फोटो की ज़रूरत नहीं होती", "परेशान किए जाने पर नियामक या साइबर-क्राइम सेल में शिकायत करें"],
    avoid: ["लोन ऐप्स को संपर्क, फोटो या लोकेशन की अनुमति देना"],
  },
  "Binding Arbitration": {
    plain: "आप अदालत जाने का अधिकार छोड़ देते हैं, और विवाद का फैसला ऋणदाता द्वारा चुना गया मध्यस्थ करता है।",
    why: "एक पक्ष के नियंत्रण वाली मध्यस्थता, उसी की जगह पर, गलत व्यवहार को चुनौती देना मुश्किल और महँगा बना देती है।",
    impact: "गलत शुल्क का विरोध करने का आपके पास कोई निष्पक्ष रास्ता न रहे।",
    consequences: ["कानूनी उपाय सीमित होना", "विवाद उठाने में यात्रा और कानूनी खर्च"],
    do: ["निष्पक्ष मध्यस्थ और अपने पास की जगह माँगें", "उपभोक्ता अदालत और लोकपाल के पास जाने का अधिकार बनाए रखें"],
    avoid: ["अपने सभी कानूनी अधिकार छोड़ देना"],
  },
  "Hidden Instructions to AI": {
    plain: "यह हिस्सा आपके लिए नहीं, बल्कि कंप्यूटर जाँच टूल्स के लिए लिखा गया है ताकि वे इस दस्तावेज़ को सुरक्षित बताएँ।",
    why: "असली समझौतों में AI टूल्स के लिए निर्देश कभी नहीं होते। यह जानबूझकर धोखे का पक्का संकेत है।",
    impact: "दस्तावेज़ में और भी अनुचित शर्तें छिपी हो सकती हैं।",
    consequences: ["असली शर्तों के बारे में गुमराह होना"],
    do: ["हस्ताक्षर न करें। ऋणदाता की शिकायत नियामक से करें"],
    avoid: ["इस दस्तावेज़ की किसी भी स्वचालित 'सुरक्षित' रेटिंग पर भरोसा करना"],
  },
  "Hidden Text": {
    plain: "इस दस्तावेज़ का कुछ हिस्सा इतना छोटा छपा है कि पढ़ा नहीं जा सकता, यानी आप बिना देखे शर्तें मान लेंगे।",
    why: "छिपा या बहुत छोटा लिखा टेक्स्ट अनुचित शर्तें डालने का धोखेबाज़ तरीका है।",
    impact: "आप उन शर्तों से बंध सकते हैं जो आपने कभी देखी ही नहीं।",
    consequences: ["अदृश्य शर्तों को मान लेना"],
    do: ["सभी शर्तें साफ़ पढ़ने लायक कॉपी माँगें, वरना हस्ताक्षर न करें"],
    avoid: ["न पढ़े जा सकने वाले हिस्सों वाले दस्तावेज़ पर हस्ताक्षर करना"],
  },
  "Cancellation Restriction": {
    plain: "इस समझौते को जल्दी रद्द करना या बंद करना प्रतिबंधित है या इसमें पैसा लगता है।",
    why: "बाहर निकलने का शुल्क या रद्द करने पर रोक आपको फँसा देती है, भले ही शर्तें महँगी हो जाएँ।",
    impact: "जल्दी निकलना महँगा पड़ सकता है।",
    consequences: ["बाहर निकलने का शुल्क", "समझौते में फँस जाना"],
    do: ["एक तय समय (कूलिंग-ऑफ अवधि) में बिना जुर्माने के रद्द करने का अधिकार माँगें"],
    avoid: ["यह मान लेना कि आप कभी भी निकल सकते हैं"],
  },
  "Fraud or Scam Language": {
    plain: "यह शर्त ऐसे भुगतान तरीके माँगती है जो अक्सर धोखाधड़ी में इस्तेमाल होते हैं (गिफ्ट कार्ड, क्रिप्टो, तुरंत वायर ट्रांसफर)।",
    why: "असली ऋणदाता ऐसे भुगतान तरीके नहीं माँगते।",
    impact: "इस तरह भेजा गया पैसा आमतौर पर वापस नहीं मिलता।",
    consequences: ["पैसा खो देना और वापस पाने का कोई रास्ता न होना"],
    do: ["कुछ भी भुगतान करने से पहले रुकें और ऋणदाता की स्वतंत्र रूप से जाँच करें"],
    avoid: ["ऋण पाने के लिए कोई भी अग्रिम शुल्क देना"],
  },
};

const GENERIC: Record<ExplanationLanguage, Record<RiskLevel, ClauseGuide>> = {
  en: {
    high: {
      plain: "This clause gives the lender significant power over you. Read it carefully before agreeing.",
      why: "This clause contains language that may expose you to significant financial or legal obligations.",
      impact: "Could result in unexpected charges or limited legal recourse.",
      consequences: ["Unexpected costs", "Limited dispute options"],
      do: ["Request written clarification before signing", "Negotiate removal or modification of this clause"],
      avoid: ["Signing without legal review", "Assuming favorable interpretation"],
    },
    caution: {
      plain: "Some terms here are vague or left to the lender's discretion and could change against you.",
      why: "This clause uses ambiguous or discretionary language that may be interpreted against you later.",
      impact: "Future costs or obligations may change based on provider discretion.",
      consequences: ["Cost increases over time", "Unclear obligations"],
      do: ["Ask for specific definitions and caps", "Document verbal promises in writing"],
      avoid: ["Ignoring variable or conditional terms"],
    },
    safe: {
      plain: "This looks like a standard, clearly worded provision.",
      why: "This section appears transparent and consumer-friendly with clear terms.",
      impact: "Minimal unexpected financial exposure from this clause.",
      consequences: ["Standard contractual obligations"],
      do: ["Keep a copy for your records"],
      avoid: [],
    },
  },
  hi: {
    high: {
      plain: "यह शर्त ऋणदाता को आप पर काफी अधिकार देती है। मानने से पहले इसे ध्यान से पढ़ें।",
      why: "इस शर्त की भाषा आप पर बड़ी आर्थिक या कानूनी ज़िम्मेदारी डाल सकती है।",
      impact: "अचानक शुल्क लग सकते हैं या कानूनी उपाय सीमित हो सकते हैं।",
      consequences: ["अप्रत्याशित खर्च", "विवाद के सीमित विकल्प"],
      do: ["हस्ताक्षर से पहले लिखित स्पष्टीकरण माँगें", "इस शर्त को हटाने या बदलने के लिए बात करें"],
      avoid: ["कानूनी सलाह के बिना हस्ताक्षर करना", "यह मान लेना कि शर्त आपके पक्ष में समझी जाएगी"],
    },
    caution: {
      plain: "यहाँ कुछ शर्तें अस्पष्ट हैं या ऋणदाता की मर्ज़ी पर छोड़ी गई हैं, जो आपके खिलाफ बदल सकती हैं।",
      why: "इस शर्त की भाषा अस्पष्ट है और बाद में आपके खिलाफ समझी जा सकती है।",
      impact: "आगे के खर्च या ज़िम्मेदारियाँ ऋणदाता की मर्ज़ी से बदल सकती हैं।",
      consequences: ["समय के साथ खर्च बढ़ना", "अस्पष्ट ज़िम्मेदारियाँ"],
      do: ["साफ़ परिभाषाएँ और सीमाएँ माँगें", "मौखिक वादों को लिखित में लें"],
      avoid: ["बदलने वाली या शर्तों वाली बातों को नज़रअंदाज़ करना"],
    },
    safe: {
      plain: "यह एक सामान्य और साफ़ शब्दों में लिखी गई शर्त लगती है।",
      why: "यह हिस्सा पारदर्शी और उपभोक्ता के अनुकूल लगता है।",
      impact: "इस शर्त से अचानक आर्थिक नुकसान की संभावना कम है।",
      consequences: ["सामान्य अनुबंध संबंधी ज़िम्मेदारियाँ"],
      do: ["अपने रिकॉर्ड के लिए एक कॉपी रखें"],
      avoid: [],
    },
  },
};

const PROTECTIVE_SAFE: Record<ExplanationLanguage, string> = {
  en: "This clause protects you: it sets out clear notice or exit terms.",
  hi: "यह शर्त आपकी रक्षा करती है: इसमें सूचना या बाहर निकलने की साफ़ शर्तें हैं।",
};

/**
 * Milder wording for categories whose main guide describes the severe form. A disclosed penal
 * charge of 2% a year is normal; 5% a month is not.
 */
const CAUTION_GUIDES: Record<ExplanationLanguage, GuideSet> = {
  en: {
    "Penalty Clause": {
      plain: "Charges apply if you pay late. The rate stated here looks moderate, but late payments still add cost and hurt your credit score.",
      why: "Penal charges are standard in loans; what matters is how high they are and how they are calculated.",
      impact: "Each late payment costs extra and is reported to credit bureaus.",
      consequences: ["Extra charges on overdue amounts", "Lower credit score after missed payments"],
      do: ["Confirm how penal charges are calculated and that they are also shown in the Key Fact Statement", "Set up auto-debit or reminders so you never pay late"],
      avoid: ["Missing EMIs on the assumption the charge is small"],
    },
    "Hidden Fees": {
      plain: "Fees are taken out of the loan before you receive it, so you get less money than the loan amount.",
      why: "Deducting fees upfront is common, but it means you pay interest on money you never received.",
      impact: "The real yearly cost (APR) is higher than the interest rate.",
      consequences: ["Less money in hand than the sanctioned amount"],
      do: ["Check the exact amount you will receive", "Compare offers using APR"],
      avoid: ["Budgeting with the full sanctioned amount"],
    },
    "Binding Arbitration": {
      plain: "Disputes will be settled by arbitration rather than in court.",
      why: "Arbitration clauses are common. It matters whether the arbitrator is neutral and the venue is reasonable for you.",
      impact: "Challenging the lender may take a different, sometimes costlier, route.",
      consequences: ["Disputes handled outside regular courts"],
      do: ["Check who appoints the arbitrator and where it happens", "You can still complain to the RBI Ombudsman about service issues"],
      avoid: ["Assuming you have given up every other remedy"],
    },
    "Cancellation Restriction": {
      plain: "There is a lock-in period during which you cannot close or switch the loan without cost.",
      why: "Lock-ins limit your ability to move to a cheaper lender.",
      impact: "Switching early may cost extra.",
      consequences: ["Being tied to this lender for a period"],
      do: ["Ask how long the lock-in is and what closing early would cost"],
      avoid: ["Ignoring the lock-in if you may refinance soon"],
    },
  },
  hi: {
    "Penalty Clause": {
      plain: "देर से भुगतान पर शुल्क लगता है। यहाँ बताई दर मध्यम लगती है, पर देर से भुगतान फिर भी खर्च बढ़ाता है और क्रेडिट स्कोर घटाता है।",
      why: "ऋणों में दंड शुल्क सामान्य हैं; असली बात यह है कि वे कितने हैं और कैसे गिने जाते हैं।",
      impact: "हर देरी पर अतिरिक्त खर्च और क्रेडिट ब्यूरो को रिपोर्ट।",
      consequences: ["बकाया राशि पर अतिरिक्त शुल्क", "छूटे भुगतान के बाद कम क्रेडिट स्कोर"],
      do: ["पुष्टि करें कि दंड शुल्क कैसे गिना जाता है और की फैक्ट स्टेटमेंट में भी दिखाया गया है", "ऑटो-डेबिट या रिमाइंडर लगाएँ ताकि कभी देर न हो"],
      avoid: ["शुल्क छोटा मानकर EMI छोड़ना"],
    },
    "Hidden Fees": {
      plain: "शुल्क ऋण मिलने से पहले ही काट लिए जाते हैं, इसलिए आपको ऋण राशि से कम पैसा मिलता है।",
      why: "पहले से शुल्क काटना आम है, पर इसका मतलब है कि आप उस पैसे पर भी ब्याज देते हैं जो आपको कभी मिला ही नहीं।",
      impact: "असली सालाना लागत (APR) ब्याज दर से ज़्यादा होती है।",
      consequences: ["स्वीकृत राशि से कम पैसा हाथ में"],
      do: ["जाँचें कि आपको कितनी राशि मिलेगी", "ऑफ़र की तुलना APR से करें"],
      avoid: ["पूरी स्वीकृत राशि मानकर बजट बनाना"],
    },
    "Binding Arbitration": {
      plain: "विवाद अदालत की जगह मध्यस्थता (आर्बिट्रेशन) से सुलझाए जाएँगे।",
      why: "मध्यस्थता की शर्तें आम हैं। मायने यह रखता है कि मध्यस्थ निष्पक्ष हो और जगह आपके लिए ठीक हो।",
      impact: "ऋणदाता को चुनौती देने का रास्ता अलग और कभी-कभी महँगा हो सकता है।",
      consequences: ["विवाद नियमित अदालतों के बाहर सुलझना"],
      do: ["देखें कि मध्यस्थ कौन नियुक्त करता है और कहाँ", "सेवा से जुड़ी शिकायत के लिए आप फिर भी RBI लोकपाल के पास जा सकते हैं"],
      avoid: ["यह मान लेना कि आपने बाकी सभी उपाय छोड़ दिए हैं"],
    },
    "Cancellation Restriction": {
      plain: "एक लॉक-इन अवधि है जिसमें आप बिना खर्च के ऋण बंद या बदल नहीं सकते।",
      why: "लॉक-इन सस्ते ऋणदाता के पास जाने की आपकी क्षमता सीमित करता है।",
      impact: "जल्दी बदलने पर अतिरिक्त खर्च हो सकता है।",
      consequences: ["कुछ समय के लिए इसी ऋणदाता से बँधे रहना"],
      do: ["पूछें कि लॉक-इन कितना लंबा है और जल्दी बंद करने की लागत क्या है"],
      avoid: ["जल्द रीफाइनेंस की योजना हो तो लॉक-इन को नज़रअंदाज़ करना"],
    },
  },
};

export function templateExplanation(
  text: string,
  riskLevel: RiskLevel,
  category: string,
  lang: ExplanationLanguage = "en"
): Pick<ClauseAnalysis, "plainEnglish" | "whyFlagged" | "financialImpact" | "predictedConsequences" | "recommendedActions" | "avoidActions"> {
  const cautionOverride = riskLevel === "caution" ? CAUTION_GUIDES[lang][category] : undefined;
  const guide = riskLevel !== "safe" ? cautionOverride ?? (lang === "hi" ? GUIDES_HI : GUIDES_EN)[category] : undefined;
  const g = guide ?? GENERIC[lang][riskLevel];
  const protective = riskLevel === "safe" && /cancel|prepay|notice|रद्द|लिखित\s*सूचना|चुका/i.test(text);
  return {
    plainEnglish: protective ? PROTECTIVE_SAFE[lang] : g.plain,
    whyFlagged: g.why,
    financialImpact: g.impact,
    predictedConsequences: g.consequences,
    recommendedActions: g.do,
    avoidActions: g.avoid,
  };
}

const SUMMARY_TEXT = {
  en: {
    summary: (trust: number, high: number, caution: number) =>
      high > 0
        ? `Trust score: ${trust}/100. Found ${high} high-risk clause${high === 1 ? "" : "s"} to deal with before signing${caution ? `, and ${caution} more to check` : ""}.`
        : caution > 0
          ? `Trust score: ${trust}/100. No serious red flags found. ${caution} term${caution === 1 ? "" : "s"} to understand before signing.`
          : `Trust score: ${trust}/100. No risky terms found.`,
    warning: "Warning: this document contains text designed to be hidden from you or to mislead automated review.",
    suggestions: [
      "Remove or cap auto-renewal provisions",
      "Request fixed interest rates instead of variable terms",
      "Add 30-day written cancellation notice requirement",
    ],
    costHigh: "Elevated risk of unexpected charges within the first 12 months.",
    costLow: "Moderate cost predictability based on current clause mix.",
    notAgreement:
      "This does not look like a loan or financial agreement. It reads like a report or description rather than a contract with binding terms, so no risk score was given. Upload the actual agreement, sanction letter or terms and conditions to check it.",
  },
  hi: {
    summary: (trust: number, high: number, caution: number) =>
      high > 0
        ? `भरोसा स्कोर: ${trust}/100। हस्ताक्षर से पहले ${high} उच्च-जोखिम शर्तों पर ध्यान दें${caution ? `, और ${caution} शर्तें जाँचें` : ""}।`
        : caution > 0
          ? `भरोसा स्कोर: ${trust}/100। कोई गंभीर खतरा नहीं मिला। हस्ताक्षर से पहले ${caution} शर्तें समझ लें।`
          : `भरोसा स्कोर: ${trust}/100। कोई जोखिम वाली शर्त नहीं मिली।`,
    warning: "चेतावनी: इस दस्तावेज़ में ऐसा टेक्स्ट है जो आपसे छिपाया गया है या स्वचालित जाँच को गुमराह करने के लिए डाला गया है।",
    suggestions: [
      "अपने आप नवीनीकरण की शर्त हटवाएँ या सीमित करवाएँ",
      "बदलने वाली ब्याज दर की जगह तय (फिक्स्ड) दर माँगें",
      "रद्द करने के लिए 30 दिन की लिखित सूचना की शर्त जुड़वाएँ",
    ],
    costHigh: "पहले 12 महीनों में अप्रत्याशित शुल्क लगने का खतरा ज़्यादा है।",
    costLow: "मौजूदा शर्तों के आधार पर खर्च का अनुमान लगाना मध्यम रूप से संभव है।",
    notAgreement:
      "यह कोई ऋण या वित्तीय समझौता नहीं लगता। यह बाध्यकारी शर्तों वाले अनुबंध की जगह किसी रिपोर्ट या विवरण जैसा है, इसलिए जोखिम स्कोर नहीं दिया गया। जाँच के लिए असली समझौता, सैंक्शन लेटर या नियम और शर्तें अपलोड करें।",
  },
};

export function templateSummary(
  clauses: ClauseAnalysis[],
  scores: { trustScore: number },
  lang: ExplanationLanguage = "en",
  hasSecurityFlags = false,
  isAgreement = true
) {
  const t = SUMMARY_TEXT[lang];
  if (!isAgreement) {
    return { summary: (hasSecurityFlags ? `${t.warning} ` : "") + t.notAgreement, negotiationSuggestions: [], futureCostPrediction: "" };
  }
  const high = clauses.filter((c) => c.riskLevel === "high").length;
  return {
    summary: (hasSecurityFlags ? `${t.warning} ` : "") + t.summary(scores.trustScore, high, clauses.filter((c) => c.riskLevel === "caution").length),
    negotiationSuggestions: t.suggestions,
    futureCostPrediction: high > 2 ? t.costHigh : t.costLow,
  };
}

/**
 * Returns the analysis with explanations in the requested language. When the stored analysis is
 * already in that language (possibly written by the AI) it is returned unchanged.
 */
export function localizeAgreement(agreement: AgreementAnalysis, lang: ExplanationLanguage): AgreementAnalysis {
  const stored = agreement.language?.explanation ?? "en";
  if (stored === lang || agreement.status !== "completed") return agreement;
  const clauses = agreement.clauses.map((c) => ({ ...c, ...templateExplanation(c.text, c.riskLevel, c.category, lang) }));
  return {
    ...agreement,
    clauses,
    ...templateSummary(clauses, agreement.scores, lang, agreement.securityFlags.length > 0, agreement.documentCheck?.isAgreement !== false),
  };
}
